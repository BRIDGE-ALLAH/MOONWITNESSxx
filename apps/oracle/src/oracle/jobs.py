"""Bounded in-process job lifecycle used only by the stage-1 development service."""

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

    async def start(self) -> None:
        if self._workers:
            return
        self._accepting = True
        self._workers = [
            asyncio.create_task(self._worker_loop(), name=f"oracle-worker-{index + 1}")
            for index in range(self.settings.worker_count)
        ]
        logger.info(
            "ORACLE workers started",
            extra={"event": "workers_started", "worker_count": len(self._workers)},
        )

    async def stop(self) -> None:
        self._accepting = False
        if not self._workers:
            return
        try:
            await asyncio.wait_for(
                self._queue.join(), timeout=self.settings.shutdown_grace_seconds
            )
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
        logger.info("ORACLE workers stopped", extra={"event": "workers_stopped"})

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
        async with self._lock:
            return self._jobs.get(job_id)

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
