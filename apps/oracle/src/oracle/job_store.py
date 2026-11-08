"""PostgreSQL-backed ORACLE job queue with atomic idempotency and worker leases."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any
from uuid import UUID, uuid4

import asyncpg

from .jobs import (
    IdempotencyConflictError,
    JobRecord,
    QueueSaturatedError,
    StorageUnavailableError,
)
from .schemas import EvidenceRef, JobError, JobStatus, Provenance
from .settings import Settings

logger = logging.getLogger("oracle.job_store")

# Serialize submissions so queue/retention limits and key lookup are atomic across replicas.
_SUBMISSION_ADVISORY_LOCK = 1_338_039_620


def _decode_json(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, bytes, bytearray)):
        return json.loads(value)
    return value


def _encode_json(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"), sort_keys=True)


def _map_record(row: asyncpg.Record) -> JobRecord:
    evidence = _decode_json(row["evidence"])
    result = _decode_json(row["result_payload"])
    error = _decode_json(row["error_payload"])
    provenance = _decode_json(row["provenance_payload"])
    return JobRecord(
        job_id=row["job_id"],
        task_type=row["task_type"],
        input_payload=_decode_json(row["input_payload"]),
        evidence=[EvidenceRef.model_validate(item) for item in evidence],
        input_digest=row["input_digest"].strip(),
        submitted_at=row["submitted_at"],
        status=JobStatus(row["status"]),
        started_at=row["started_at"],
        completed_at=row["completed_at"],
        result=result,
        error=JobError.model_validate(error) if error is not None else None,
        provenance=Provenance.model_validate(provenance) if provenance is not None else None,
    )


class PostgresJobStore:
    """Owns ORACLE computation-job persistence, not caller identity or audit history."""

    def __init__(self, settings: Settings) -> None:
        if not settings.database_url:
            raise ValueError("ORACLE_DATABASE_URL is required for PostgreSQL job storage")
        self.settings = settings
        self._pool: asyncpg.Pool | None = None
        self._pool_lock = asyncio.Lock()
        self._next_pool_attempt = 0.0

    async def start(self) -> None:
        # A database outage must make readiness false and writes return 503, not prevent
        # the HTTP process from exposing its health and diagnostic routes.
        await self._ensure_pool()

    async def close(self) -> None:
        pool = self._pool
        self._pool = None
        if pool is not None:
            await pool.close()

    async def _ensure_pool(self) -> bool:
        if self._pool is not None and not self._pool.is_closing():
            return True
        if time.monotonic() < self._next_pool_attempt:
            return False
        async with self._pool_lock:
            if self._pool is not None and not self._pool.is_closing():
                return True
            if time.monotonic() < self._next_pool_attempt:
                return False
            try:
                self._pool = await asyncpg.create_pool(
                    dsn=self.settings.database_url,
                    min_size=1,
                    max_size=max(4, self.settings.worker_count + 2),
                    command_timeout=10,
                    server_settings={"application_name": "moonwitness-oracle"},
                )
                self._next_pool_attempt = 0.0
                return True
            except Exception as exc:
                self._next_pool_attempt = time.monotonic() + 2.0
                logger.warning(
                    "ORACLE PostgreSQL pool unavailable",
                    extra={"event": "job_store_unavailable", "error_type": type(exc).__name__},
                )
                return False

    def _require_pool(self) -> asyncpg.Pool:
        if self._pool is None or self._pool.is_closing():
            raise StorageUnavailableError
        return self._pool

    async def readiness(self) -> tuple[bool, int]:
        if not await self._ensure_pool():
            return False, 0
        try:
            async with self._require_pool().acquire() as connection:
                migrated = await connection.fetchval(
                    "SELECT to_regclass('oracle.jobs') IS NOT NULL"
                )
                if not migrated:
                    return False, 0
                depth = await connection.fetchval(
                    "SELECT count(*)::integer FROM oracle.jobs WHERE status = 'queued'"
                )
                return True, int(depth)
        except Exception:
            return False, 0

    async def submit(
        self,
        *,
        task_type: str,
        input_payload: dict[str, Any],
        evidence: list[EvidenceRef],
        idempotency_key: str | None,
    ) -> tuple[JobRecord, bool]:
        if not await self._ensure_pool():
            raise StorageUnavailableError

        request_body = {
            "task_type": task_type,
            "input": input_payload,
            "evidence": [item.model_dump(mode="json") for item in evidence],
        }
        from .provenance import sha256_digest

        request_digest = sha256_digest(request_body)
        job_id = uuid4()
        try:
            async with self._require_pool().acquire() as connection:
                async with connection.transaction():
                    await connection.execute(
                        "SELECT pg_advisory_xact_lock($1::bigint)",
                        _SUBMISSION_ADVISORY_LOCK,
                    )
                    if idempotency_key:
                        existing = await connection.fetchrow(
                            "SELECT * FROM oracle.jobs WHERE idempotency_key = $1",
                            idempotency_key,
                        )
                        if existing is not None:
                            if existing["request_digest"].strip() != request_digest:
                                raise IdempotencyConflictError
                            return _map_record(existing), True

                    # Idempotency is guaranteed while a job is retained. Expired terminal
                    # jobs are pruned first; queued/running work is never removed.
                    await connection.execute(
                        """
                        DELETE FROM oracle.jobs
                        WHERE status IN ('succeeded', 'failed')
                          AND completed_at < now() - ($1::integer * INTERVAL '1 second')
                        """,
                        self.settings.job_retention_seconds,
                    )
                    retained = await connection.fetchval(
                        "SELECT count(*)::integer FROM oracle.jobs"
                    )
                    if retained >= self.settings.max_retained_jobs:
                        removable = retained - self.settings.max_retained_jobs + 1
                        await connection.execute(
                            """
                            DELETE FROM oracle.jobs
                            WHERE job_id IN (
                              SELECT job_id FROM oracle.jobs
                              WHERE status IN ('succeeded', 'failed')
                              ORDER BY completed_at ASC, job_id ASC
                              LIMIT $1
                            )
                            """,
                            removable,
                        )
                        retained = await connection.fetchval(
                            "SELECT count(*)::integer FROM oracle.jobs"
                        )
                    if retained >= self.settings.max_retained_jobs:
                        raise QueueSaturatedError("ORACLE retained-job capacity is full")

                    queued = await connection.fetchval(
                        "SELECT count(*)::integer FROM oracle.jobs WHERE status = 'queued'"
                    )
                    if queued >= self.settings.max_queue_size:
                        raise QueueSaturatedError("ORACLE job queue is full")

                    row = await connection.fetchrow(
                        """
                        INSERT INTO oracle.jobs (
                          job_id, task_type, input_payload, evidence,
                          request_digest, input_digest, idempotency_key
                        )
                        VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $5, $6)
                        RETURNING *
                        """,
                        job_id,
                        task_type,
                        _encode_json(input_payload),
                        _encode_json(request_body["evidence"]),
                        request_digest,
                        idempotency_key,
                    )
                    return _map_record(row), False
        except (IdempotencyConflictError, QueueSaturatedError):
            raise
        except Exception as exc:
            raise StorageUnavailableError from exc

    async def get(self, job_id: UUID) -> JobRecord | None:
        if not await self._ensure_pool():
            raise StorageUnavailableError
        try:
            async with self._require_pool().acquire() as connection:
                row = await connection.fetchrow(
                    "SELECT * FROM oracle.jobs WHERE job_id = $1",
                    job_id,
                )
                return _map_record(row) if row is not None else None
        except Exception as exc:
            raise StorageUnavailableError from exc

    async def claim(self, worker_id: str) -> JobRecord | None:
        if not await self._ensure_pool():
            raise StorageUnavailableError
        exhausted_error = _encode_json(
            {
                "code": "worker_lease_expired",
                "message": "The analysis worker stopped before completing this job.",
            }
        )
        try:
            async with self._require_pool().acquire() as connection:
                async with connection.transaction():
                    await connection.execute(
                        """
                        UPDATE oracle.jobs
                        SET status = 'failed',
                            completed_at = now(),
                            error_payload = $1::jsonb,
                            lease_owner = NULL,
                            lease_until = NULL
                        WHERE status = 'running'
                          AND lease_until <= now()
                          AND attempt_count >= $2
                        """,
                        exhausted_error,
                        self.settings.max_job_attempts,
                    )
                    row = await connection.fetchrow(
                        """
                        WITH candidate AS (
                          SELECT job_id
                          FROM oracle.jobs
                          WHERE (
                            status = 'queued'
                            OR (status = 'running' AND lease_until <= now())
                          )
                            AND attempt_count < $2
                          ORDER BY submitted_at ASC, job_id ASC
                          LIMIT 1
                          FOR UPDATE SKIP LOCKED
                        )
                        UPDATE oracle.jobs AS job
                        SET status = 'running',
                            attempt_count = job.attempt_count + 1,
                            started_at = COALESCE(job.started_at, now()),
                            lease_owner = $1,
                            lease_until = now() + ($3::integer * INTERVAL '1 second')
                        FROM candidate
                        WHERE job.job_id = candidate.job_id
                        RETURNING job.*
                        """,
                        worker_id,
                        self.settings.max_job_attempts,
                        self.settings.job_lease_seconds,
                    )
                    return _map_record(row) if row is not None else None
        except Exception as exc:
            raise StorageUnavailableError from exc

    async def complete(
        self,
        *,
        job_id: UUID,
        worker_id: str,
        result: dict[str, Any],
        provenance: Provenance,
    ) -> bool:
        if not await self._ensure_pool():
            raise StorageUnavailableError
        try:
            async with self._require_pool().acquire() as connection:
                row = await connection.fetchrow(
                    """
                    UPDATE oracle.jobs
                    SET status = 'succeeded',
                        completed_at = now(),
                        result_payload = $1::jsonb,
                        provenance_payload = $2::jsonb,
                        lease_owner = NULL,
                        lease_until = NULL
                    WHERE job_id = $3
                      AND status = 'running'
                      AND lease_owner = $4
                    RETURNING job_id
                    """,
                    _encode_json(result),
                    _encode_json(provenance.model_dump(mode="json")),
                    job_id,
                    worker_id,
                )
                return row is not None
        except Exception as exc:
            raise StorageUnavailableError from exc

    async def fail(self, *, job_id: UUID, worker_id: str, error: JobError) -> bool:
        if not await self._ensure_pool():
            raise StorageUnavailableError
        try:
            async with self._require_pool().acquire() as connection:
                row = await connection.fetchrow(
                    """
                    UPDATE oracle.jobs
                    SET status = 'failed',
                        completed_at = now(),
                        error_payload = $1::jsonb,
                        lease_owner = NULL,
                        lease_until = NULL
                    WHERE job_id = $2
                      AND status = 'running'
                      AND lease_owner = $3
                    RETURNING job_id
                    """,
                    _encode_json(error.model_dump(mode="json")),
                    job_id,
                    worker_id,
                )
                return row is not None
        except Exception as exc:
            raise StorageUnavailableError from exc
