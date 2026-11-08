"""Bounded ORACLE job coordinator with in-memory and PostgreSQL backends."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from . import __version__
from .analysis import METHODS, run_analysis
from .provenance import sha256_digest
from .schemas import EvidenceRef, JobError, JobStatus, Provenance
from .settings import Settings

logger = logging.getLogger("oracle.jobs")


class QueueSaturatedError(Exception):
    """Raised when the bounded queue or retained-job ceiling is reached."""


class IdempotencyConflictError(Exception):
    """Raised when a key is reused for a different request body."""


class StorageUnavailableError(Exception):
    """Raised when the configured durable job store cannot accept or read work."""


@dataclass(slots=True)
class JobRecord:
    job_id: UUID
    task_type: str
    input_payload: dict[str, Any]
    evidence: list[EvidenceRef]
    input_digest: str
    submitted_at: datetime
    status: JobStatus = JobStatus.QUEUED
    started_at: datetime | None = None
    completed_at: datetime | None = None
    result: dict[str, Any] | None = None
    error: JobError | None = None
    provenance: Provenance | None = None


@dataclass(slots=True)
class IdempotencyRecord:
    request_digest: str
    job_id: UUID


@dataclass
class JobCoordinator:
    settings: Settings
    _queue: asyncio.Queue[UUID] = field(init=False)
    _jobs: dict[UUID, JobRecord] = field(default_factory=dict, init=False)
    _idempotency: dict[str, IdempotencyRecord] = field(default_factory=dict, init=False)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False)
    _workers: list[asyncio.Task[None]] = field(default_factory=list, init=False)
    _accepting: bool = field(default=False, init=False)
    _store: Any = field(default=None, init=False)
    _instance_id: str = field(default_factory=lambda: uuid4().hex, init=False)

    def __post_init__(self) -> None:
        self._queue = asyncio.Queue(maxsize=self.settings.max_queue_size)

    @property
    def accepting(self) -> bool:
        return (
            self._accepting
            and bool(self._workers)
            and all(not task.done() for task in self._workers)
        )

    @property
    def queue_depth(self) -> int:
        return self._queue.qsize()

    @property
    def durable_jobs(self) -> bool:
        return self._store is not None

    async def readiness(self) -> tuple[bool, int]:
        if self._store is not None:
            ready, depth = await self._store.readiness()
            return self.accepting and ready, depth
        return self.accepting, self._queue.qsize()

    async def start(self) -> None:
        if self._workers:
            return
        if self.settings.database_url:
            from .job_store import PostgresJobStore

            self._store = PostgresJobStore(self.settings)
            await self._store.start()
            self._accepting = True
            self._workers = [
                asyncio.create_task(
                    self._persistent_worker_loop(index),
                    name=f"oracle-persistent-worker-{index + 1}",
                )
                for index in range(self.settings.worker_count)
            ]
        else:
            self._accepting = True
            self._workers = [
                asyncio.create_task(self._worker_loop(), name=f"oracle-worker-{index + 1}")
                for index in range(self.settings.worker_count)
            ]
        logger.info(
            "ORACLE workers started",
            extra={
                "event": "workers_started",
                "worker_count": len(self._workers),
                "durable_jobs": self.durable_jobs,
            },
        )

    async def stop(self) -> None:
        self._accepting = False
        if self._store is not None:
            try:
                await asyncio.wait_for(
                    asyncio.gather(*self._workers, return_exceptions=True),
                    timeout=self.settings.shutdown_grace_seconds,
                )
            except TimeoutError:
                for worker in self._workers:
                    worker.cancel()
                await asyncio.gather(*self._workers, return_exceptions=True)
            self._workers.clear()
            await self._store.close()
            self._store = None
            logger.info("ORACLE durable workers stopped")
            return

        if not self._workers:
            return
        try:
            await asyncio.wait_for(self._queue.join(), timeout=self.settings.shutdown_grace_seconds)
        except TimeoutError:
            logger.warning(
                "ORACLE shutdown grace period expired",
                extra={"event": "shutdown_grace_expired", "pending_jobs": self.queue_depth},
            )
        for worker in self._workers:
            worker.cancel()
        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()
        async with self._lock:
            stopped_at = datetime.now(UTC)
            for record in self._jobs.values():
                if record.status in {JobStatus.QUEUED, JobStatus.RUNNING}:
                    record.status = JobStatus.FAILED
                    record.completed_at = stopped_at
                    record.error = JobError(
                        code="service_stopped",
                        message="The service stopped before this job completed; submit it again.",
                    )
        logger.info("ORACLE workers stopped")

    async def submit(
        self,
        *,
        task_type: str,
        input_payload: dict[str, Any],
        evidence: list[EvidenceRef],
        idempotency_key: str | None,
    ) -> tuple[JobRecord, bool]:
        request_body = {
            "task_type": task_type,
            "input": input_payload,
            "evidence": [item.model_dump(mode="json") for item in evidence],
        }
        request_digest = sha256_digest(request_body)
        input_digest = request_digest

        if not self.accepting:
            raise QueueSaturatedError("ORACLE is not accepting jobs")
        if self._store is not None:
            return await self._store.submit(
                task_type=task_type,
                input_payload=input_payload,
                evidence=evidence,
                idempotency_key=idempotency_key,
            )

        async with self._lock:
            if not self._accepting:
                raise QueueSaturatedError("ORACLE is not accepting jobs")

            if idempotency_key:
                existing = self._idempotency.get(idempotency_key)
                if existing:
                    if existing.request_digest != request_digest:
                        raise IdempotencyConflictError
                    record = self._jobs.get(existing.job_id)
                    if record is not None:
                        return record, True
                    # A retained-job cleanup should also remove the key; this is a fail-safe.
                    self._idempotency.pop(idempotency_key, None)

            self._prune_completed_jobs()
            if len(self._jobs) >= self.settings.max_retained_jobs:
                raise QueueSaturatedError("ORACLE retained-job capacity is full")
            if self._queue.full():
                raise QueueSaturatedError("ORACLE job queue is full")

            record = JobRecord(
                job_id=uuid4(),
                task_type=task_type,
                input_payload=input_payload,
                evidence=evidence,
                input_digest=input_digest,
                submitted_at=datetime.now(UTC),
            )
            self._jobs[record.job_id] = record
            if idempotency_key:
                self._idempotency[idempotency_key] = IdempotencyRecord(
                    request_digest=request_digest,
                    job_id=record.job_id,
                )
            self._queue.put_nowait(record.job_id)
            return record, False

    async def get(self, job_id: UUID) -> JobRecord | None:
        if self._store is not None:
            return await self._store.get(job_id)
        async with self._lock:
            return self._jobs.get(job_id)

    async def _persistent_worker_loop(self, worker_index: int) -> None:
        store = self._store
        if store is None:
            return
        worker_id = f"{self._instance_id}:{worker_index}"
        while self._accepting:
            try:
                record = await store.claim(worker_id)
            except StorageUnavailableError:
                await asyncio.sleep(1.0)
                continue
            if record is None:
                await asyncio.sleep(0.15)
                continue

            try:
                result = await asyncio.to_thread(
                    run_analysis, record.task_type, record.input_payload
                )
            except asyncio.CancelledError:
                # Leave the database lease intact. It becomes reclaimable after expiry.
                raise
            except Exception as exc:
                logger.error(
                    "ORACLE job failed",
                    extra={
                        "event": "job_failed",
                        "job_id": record.job_id,
                        "error_type": type(exc).__name__,
                    },
                )
                try:
                    await store.fail(
                        job_id=record.job_id,
                        worker_id=worker_id,
                        error=JobError(
                            code="analysis_failed",
                            message="The analysis job failed; no result was produced.",
                        ),
                    )
                except StorageUnavailableError:
                    # The current lease expires and is retried after the database returns.
                    await asyncio.sleep(1.0)
                continue

            completed_at = datetime.now(UTC)
            method_id, method_version, limitations = METHODS[record.task_type]
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
            try:
                persisted = await store.complete(
                    job_id=record.job_id,
                    worker_id=worker_id,
                    result=result,
                    provenance=provenance,
                )
                if not persisted:
                    logger.warning(
                        "ORACLE worker lost its job lease before completion",
                        extra={"event": "job_lease_lost", "job_id": record.job_id},
                    )
                else:
                    logger.info(
                        "ORACLE job succeeded",
                        extra={
                            "event": "job_succeeded",
                            "job_id": record.job_id,
                            "task_type": record.task_type,
                        },
                    )
            except StorageUnavailableError:
                # Do not acknowledge success in memory; an expired lease is retried.
                await asyncio.sleep(1.0)

    def _prune_completed_jobs(self) -> None:
        if len(self._jobs) < self.settings.max_retained_jobs:
            return
        removable = sorted(
            (
                record
                for record in self._jobs.values()
                if record.status in {JobStatus.SUCCEEDED, JobStatus.FAILED}
            ),
            key=lambda record: record.completed_at or record.submitted_at,
        )
        while len(self._jobs) >= self.settings.max_retained_jobs and removable:
            record = removable.pop(0)
            self._jobs.pop(record.job_id, None)
            for key, value in list(self._idempotency.items()):
                if value.job_id == record.job_id:
                    self._idempotency.pop(key, None)

    async def _worker_loop(self) -> None:
        while True:
            job_id = await self._queue.get()
            try:
                async with self._lock:
                    record = self._jobs.get(job_id)
                    if record is None:
                        continue
                    record.status = JobStatus.RUNNING
                    record.started_at = datetime.now(UTC)

                result = await asyncio.to_thread(
                    run_analysis, record.task_type, record.input_payload
                )
                completed_at = datetime.now(UTC)
                method_id, method_version, limitations = METHODS[record.task_type]
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
                async with self._lock:
                    record.result = result
                    record.provenance = provenance
                    record.status = JobStatus.SUCCEEDED
                    record.completed_at = completed_at
                logger.info(
                    "ORACLE job succeeded",
                    extra={
                        "event": "job_succeeded",
                        "job_id": record.job_id,
                        "task_type": record.task_type,
                    },
                )
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # Do not log the submitted payload or exception text.
                logger.error(
                    "ORACLE job failed",
                    extra={
                        "event": "job_failed",
                        "job_id": job_id,
                        "error_type": type(exc).__name__,
                    },
                )
                async with self._lock:
                    record = self._jobs.get(job_id)
                    if record is not None:
                        record.status = JobStatus.FAILED
                        record.completed_at = datetime.now(UTC)
                        record.error = JobError(
                            code="analysis_failed",
                            message="The analysis job failed; no result was produced.",
                        )
            finally:
                self._queue.task_done()
