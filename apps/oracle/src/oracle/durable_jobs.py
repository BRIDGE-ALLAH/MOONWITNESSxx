"""PostgreSQL-backed ORACLE job lifecycle with atomic submission and fenced leases."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import asyncpg

from . import __version__
from .analysis import METHODS, run_analysis
from .jobs import IdempotencyConflictError, JobRecord, QueueSaturatedError
from .provenance import sha256_digest
from .schemas import EvidenceRef, JobError, JobStatus, Provenance
from .settings import Settings

logger = logging.getLogger("oracle.durable_jobs")
_CAPACITY_LOCK_KEY = 1_330_796_867


class PersistenceUnavailableError(Exception):
    """Raised when durable persistence is configured but unavailable or unready."""


def _json_value(value: Any) -> Any:
    if value is None:
        return None
    return json.loads(value) if isinstance(value, str) else value


def _to_record(row: asyncpg.Record) -> JobRecord:
    evidence_value = _json_value(row["evidence"]) or []
    return JobRecord(
        job_id=row["job_id"],
        task_type=row["task_type"],
        input_payload=_json_value(row["input_payload"]),
        evidence=[EvidenceRef.model_validate(item) for item in evidence_value],
        input_digest=row["input_digest"].strip(),
        submitted_at=row["submitted_at"],
        status=JobStatus(row["status"]),
        started_at=row["started_at"],
        completed_at=row["completed_at"],
        result=_json_value(row["result"]),
        error=JobError.model_validate(_json_value(row["error"])) if row["error"] else None,
        provenance=(
            Provenance.model_validate(_json_value(row["provenance"]))
            if row["provenance"]
            else None
        ),
    )


class PostgresJobCoordinator:
    """Durable queue consumer. Database state is authoritative across process restarts."""

    def __init__(self, settings: Settings) -> None:
        if not settings.database_url:
            raise ValueError("PostgreSQL coordinator requires ORACLE_DATABASE_URL")
        self.settings = settings
        self._pool: asyncpg.Pool | None = None
        self._workers: list[asyncio.Task[None]] = []
        self._accepting = False
        self._database_available = False
        self._active_jobs = 0

    @property
    def accepting(self) -> bool:
        return (
            self._accepting
            and self._database_available
            and (not self._workers or all(not worker.done() for worker in self._workers))
        )

    @property
    def queue_depth(self) -> int:
        return 0

    async def start(self) -> None:
        await self._connect(start_workers=True)

    async def _connect(self, *, start_workers: bool) -> None:
        try:
            self._pool = await asyncpg.create_pool(
                self.settings.database_url,
                min_size=self.settings.database_min_pool_size,
                max_size=self.settings.database_max_pool_size,
                timeout=5,
                command_timeout=15,
            )
            async with self._pool.acquire() as connection:
                await connection.execute("SELECT 1")
                await connection.execute("SELECT job_id FROM oracle.jobs LIMIT 0")
        except Exception as exc:
            logger.error(
                "ORACLE durable job store is unavailable or not migrated",
                extra={"event": "durable_store_unavailable", "error_type": type(exc).__name__},
            )
            self._database_available = False
            if self._pool is not None:
                await self._pool.close()
                self._pool = None
            return

        self._database_available = True
        self._accepting = True
        if start_workers:
            if not self._workers or all(worker.done() for worker in self._workers):
                self._workers = [
                    asyncio.create_task(self._worker_loop(), name=f"oracle-db-worker-{index + 1}")
                    for index in range(self.settings.worker_count)
                ]
            logger.info(
                "ORACLE durable workers started",
                extra={
                    "event": "durable_workers_started",
                    "worker_count": len(self._workers),
                },
            )

    async def stop(self) -> None:
        self._accepting = False
        if self._workers:
            done, pending = await asyncio.wait(
                self._workers,
                timeout=self.settings.shutdown_grace_seconds,
            )
            for worker in pending:
                worker.cancel()
            await asyncio.gather(*done, *pending, return_exceptions=True)
            self._workers.clear()
        # Running rows are intentionally left leased. A restarted worker reclaims them
        # after expiry; marking them failed here would lose recoverable work.
        if self._pool is not None:
            await self._pool.close()
            self._pool = None
        self._database_available = False
        logger.info("ORACLE durable workers stopped", extra={"event": "durable_workers_stopped"})

    async def readiness(self) -> dict[str, Any]:
        if self._pool is None:
            await self._connect(start_workers=True)
        if self._pool is None:
            return {
                "ready": False,
                "queue_depth": 0,
                "database_available": False,
                "workers": 0,
            }
        try:
            queued = await self._pool.fetchval(
                "SELECT count(*)::int FROM oracle.jobs WHERE status = 'queued'"
            )
        except Exception as exc:
            logger.error(
                "ORACLE durable readiness query failed",
                extra={"event": "durable_readiness_failed", "error_type": type(exc).__name__},
            )
            self._database_available = False
            pool, self._pool = self._pool, None
            if pool is not None:
                await pool.close()
            return {
                "ready": False,
                "queue_depth": 0,
                "database_available": False,
                "workers": len(self._workers),
            }
        self._database_available = True
        workers_ready = (
            self._accepting
            and bool(self._workers)
            and all(not worker.done() for worker in self._workers)
        )
        return {
            "ready": workers_ready,
            "queue_depth": queued,
            "database_available": True,
            "workers": len(self._workers),
        }

    async def submit(
        self,
        *,
        task_type: str,
        input_payload: dict[str, Any],
        evidence: list[EvidenceRef],
        idempotency_key: str | None,
    ) -> tuple[JobRecord, bool]:
        pool = self._require_pool()
        request_body = {
            "task_type": task_type,
            "input": input_payload,
            "evidence": [item.model_dump(mode="json") for item in evidence],
        }
        request_digest = sha256_digest(request_body)
        submitted_id = uuid4()

        try:
            async with pool.acquire() as connection:
                async with connection.transaction():
                    # Serialize the small bounded-capacity check. This prevents concurrent
                    # submitters from exceeding queue/retained-job ceilings.
                    await connection.execute(
                        "SELECT pg_advisory_xact_lock($1::bigint)",
                        _CAPACITY_LOCK_KEY,
                    )
                    # Enforce the retention boundary before idempotency lookup. Once a
                    # terminal row expires, its key is eligible for a new operation.
                    await connection.execute(
                        """
                        DELETE FROM oracle.jobs
                        WHERE status IN ('succeeded', 'failed')
                          AND completed_at < now() - make_interval(secs => $1::double precision)
                        """,
                        self.settings.job_retention_seconds,
                    )
                    if idempotency_key:
                        existing = await connection.fetchrow(
                            """
                            SELECT * FROM oracle.jobs
                            WHERE idempotency_key = $1
                            """,
                            idempotency_key,
                        )
                        if existing:
                            if existing["request_digest"].strip() != request_digest:
                                raise IdempotencyConflictError
                            return _to_record(existing), True

                    counts = await connection.fetchrow(
                        """
                        SELECT
                          count(*)::int AS retained,
                          count(*) FILTER (WHERE status = 'queued')::int AS queued
                        FROM oracle.jobs
                        """
                    )
                    if counts["retained"] >= self.settings.max_retained_jobs:
                        raise QueueSaturatedError("ORACLE retained-job capacity is full")
                    if counts["queued"] >= self.settings.max_queue_size:
                        raise QueueSaturatedError("ORACLE job queue is full")

                    inserted = await connection.fetchrow(
                        """
                        INSERT INTO oracle.jobs (
                          job_id, task_type, input_payload, evidence,
                          input_digest, request_digest, idempotency_key, status
                        )
                        VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, 'queued')
                        RETURNING *
                        """,
                        submitted_id,
                        task_type,
                        json.dumps(input_payload),
                        json.dumps(request_body["evidence"]),
                        request_digest,
                        request_digest,
                        idempotency_key,
                    )
                    return _to_record(inserted), False
        except (IdempotencyConflictError, QueueSaturatedError):
            raise
        except Exception as exc:
            raise PersistenceUnavailableError from exc

    async def get(self, job_id: UUID) -> JobRecord | None:
        pool = self._require_pool()
        try:
            row = await pool.fetchrow(
                "SELECT * FROM oracle.jobs WHERE job_id = $1",
                job_id,
            )
            return _to_record(row) if row else None
        except Exception as exc:
            raise PersistenceUnavailableError from exc

    def _require_pool(self) -> asyncpg.Pool:
        # Keep attempting bounded database operations after a transient outage. The
        # readiness probe restores the availability flag once PostgreSQL recovers.
        if not self._accepting or self._pool is None:
            raise PersistenceUnavailableError
        return self._pool

    async def _claim_one(self, worker_id: UUID) -> tuple[JobRecord, UUID] | None:
        pool = self._require_pool()
        lease_token = uuid4()
        try:
            async with pool.acquire() as connection:
                async with connection.transaction():
                    await connection.execute(
                        """
                        UPDATE oracle.jobs
                        SET status = 'failed',
                            completed_at = now(),
                            error = '{"code":"worker_lease_expired","message":"The job could not be recovered within its retry limit."}'::jsonb,
                            lease_owner = NULL,
                            lease_token = NULL,
                            lease_expires_at = NULL,
                            updated_at = now()
                        WHERE status = 'running'
                          AND lease_expires_at <= now()
                          AND attempt_count >= $1
                        """,
                        self.settings.max_attempts,
                    )
                    row = await connection.fetchrow(
                        """
                        WITH candidate AS (
                          SELECT job_id
                          FROM oracle.jobs
                          WHERE (
                            status = 'queued'
                            OR (status = 'running' AND lease_expires_at <= now())
                          )
                            AND attempt_count < $1
                          ORDER BY submitted_at, job_id
                          LIMIT 1
                          FOR UPDATE SKIP LOCKED
                        )
                        UPDATE oracle.jobs AS job
                        SET status = 'running',
                            started_at = COALESCE(job.started_at, now()),
                            attempt_count = job.attempt_count + 1,
                            lease_owner = $2,
                            lease_token = $3,
                            lease_expires_at = now() + make_interval(secs => $4::double precision),
                            updated_at = now()
                        FROM candidate
                        WHERE job.job_id = candidate.job_id
                        RETURNING job.*
                        """,
                        self.settings.max_attempts,
                        worker_id,
                        lease_token,
                        self.settings.lease_seconds,
                    )
                    if row is None:
                        return None
                    return _to_record(row), lease_token
        except Exception as exc:
            raise PersistenceUnavailableError from exc

    async def _renew_lease(self, job_id: UUID, lease_token: UUID) -> bool:
        pool = self._require_pool()
        try:
            updated = await pool.fetchval(
                """
                UPDATE oracle.jobs
                SET lease_expires_at = now() + make_interval(secs => $3::double precision),
                    updated_at = now()
                WHERE job_id = $1
                  AND status = 'running'
                  AND lease_token = $2
                  AND lease_expires_at > now()
                RETURNING true
                """,
                job_id,
                lease_token,
                self.settings.lease_seconds,
            )
            return bool(updated)
        except Exception as exc:
            raise PersistenceUnavailableError from exc

    async def _complete(
        self,
        job_id: UUID,
        lease_token: UUID,
        result: dict[str, Any],
        provenance: Provenance,
    ) -> bool:
        pool = self._require_pool()
        try:
            updated = await pool.fetchval(
                """
                UPDATE oracle.jobs
                SET status = 'succeeded',
                    result = $3::jsonb,
                    provenance = $4::jsonb,
                    completed_at = now(),
                    lease_owner = NULL,
                    lease_token = NULL,
                    lease_expires_at = NULL,
                    updated_at = now()
                WHERE job_id = $1
                  AND status = 'running'
                  AND lease_token = $2
                  AND lease_expires_at > now()
                RETURNING true
                """,
                job_id,
                lease_token,
                json.dumps(result),
                provenance.model_dump_json(),
            )
            return bool(updated)
        except Exception as exc:
            raise PersistenceUnavailableError from exc

    async def _fail(self, job_id: UUID, lease_token: UUID) -> bool:
        pool = self._require_pool()
        try:
            updated = await pool.fetchval(
                """
                UPDATE oracle.jobs
                SET status = 'failed',
                    error = '{"code":"analysis_failed","message":"The analysis job failed; no result was produced."}'::jsonb,
                    completed_at = now(),
                    lease_owner = NULL,
                    lease_token = NULL,
                    lease_expires_at = NULL,
                    updated_at = now()
                WHERE job_id = $1
                  AND status = 'running'
                  AND lease_token = $2
                  AND lease_expires_at > now()
                RETURNING true
                """,
                job_id,
                lease_token,
            )
            return bool(updated)
        except Exception as exc:
            raise PersistenceUnavailableError from exc

    async def _worker_loop(self) -> None:
        worker_id = uuid4()
        while self._accepting:
            try:
                claimed = await self._claim_one(worker_id)
            except PersistenceUnavailableError:
                await asyncio.sleep(0.5)
                continue
            if claimed is None:
                await asyncio.sleep(0.2)
                continue

            record, lease_token = claimed
            self._active_jobs += 1
            lost_lease = asyncio.Event()
            stop_heartbeat = asyncio.Event()
            heartbeat = asyncio.create_task(
                self._heartbeat(record.job_id, lease_token, stop_heartbeat, lost_lease)
            )
            try:
                result = await asyncio.to_thread(
                    run_analysis,
                    record.task_type,
                    record.input_payload,
                )
                if lost_lease.is_set():
                    logger.warning(
                        "ORACLE discarded a result after lease loss",
                        extra={"event": "job_result_fenced", "job_id": record.job_id},
                    )
                    continue

                method_id, method_version, limitations = METHODS[record.task_type]
                completed_at = datetime.now(UTC)
                provenance = Provenance(
                    method_id=method_id,
                    method_version=method_version,
                    engine="ORACLE",
                    engine_version=__version__,
                    input_digest=record.input_digest,
                    output_digest=sha256_digest(result),
                    evidence=record.evidence,
                    completed_at=completed_at,
                    limitations=limitations,
                )
                completed = await self._complete(record.job_id, lease_token, result, provenance)
                if completed:
                    logger.info(
                        "ORACLE durable job completed",
                        extra={
                            "event": "job_succeeded",
                            "job_id": record.job_id,
                            "task_type": record.task_type,
                        },
                    )
                else:
                    logger.warning(
                        "ORACLE discarded a result after lease fencing",
                        extra={"event": "job_result_fenced", "job_id": record.job_id},
                    )
            except asyncio.CancelledError:
                # The lease remains in PostgreSQL and is reclaimed after expiry.
                raise
            except PersistenceUnavailableError as exc:
                lost_lease.set()
                logger.error(
                    "ORACLE could not persist a durable job outcome",
                    extra={
                        "event": "job_outcome_persistence_failed",
                        "job_id": record.job_id,
                        "error_type": type(exc).__name__,
                    },
                )
            except Exception as exc:
                logger.error(
                    "ORACLE durable job failed",
                    extra={
                        "event": "job_failed",
                        "job_id": record.job_id,
                        "error_type": type(exc).__name__,
                    },
                )
                if not lost_lease.is_set():
                    try:
                        await self._fail(record.job_id, lease_token)
                    except PersistenceUnavailableError:
                        pass
            finally:
                stop_heartbeat.set()
                heartbeat.cancel()
                await asyncio.gather(heartbeat, return_exceptions=True)
                self._active_jobs -= 1

    async def _heartbeat(
        self,
        job_id: UUID,
        lease_token: UUID,
        stop: asyncio.Event,
        lost: asyncio.Event,
    ) -> None:
        interval = max(1, self.settings.lease_seconds // 3)
        while not stop.is_set():
            try:
                await asyncio.wait_for(stop.wait(), timeout=interval)
                return
            except TimeoutError:
                pass
            try:
                if not await self._renew_lease(job_id, lease_token):
                    lost.set()
                    return
            except PersistenceUnavailableError:
                lost.set()
                return
