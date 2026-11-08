from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime
from pathlib import Path

import asyncpg
import pytest

from oracle.job_store import PostgresJobStore
from oracle.jobs import IdempotencyConflictError, QueueSaturatedError
from oracle.provenance import sha256_digest
from oracle.schemas import EvidenceRef, Provenance
from oracle.settings import Settings


@pytest.fixture
def postgres_database():
    dsn = os.environ.get("ORACLE_TEST_DATABASE_URL")
    if not dsn:
        pytest.skip("ORACLE_TEST_DATABASE_URL is not configured")

    migration = (Path(__file__).parents[1] / "migrations" / "001_oracle_jobs.sql").read_text()

    async def prepare() -> None:
        connection = await asyncpg.connect(dsn)
        try:
            await connection.execute(migration)
            await connection.execute(migration)
            await connection.execute("TRUNCATE oracle.jobs")
        finally:
            await connection.close()

    asyncio.run(prepare())
    yield dsn

    async def clean() -> None:
        connection = await asyncpg.connect(dsn)
        try:
            await connection.execute("TRUNCATE oracle.jobs")
        finally:
            await connection.close()

    asyncio.run(clean())


def make_settings(dsn: str, **overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "test",
        "host": "127.0.0.1",
        "database_url": dsn,
        "worker_count": 2,
        "max_queue_size": 10,
        "max_retained_jobs": 20,
        "job_lease_seconds": 5,
        "max_job_attempts": 2,
        "job_retention_seconds": 60,
    }
    values.update(overrides)
    return Settings(**values)


def submission(values: list[float] | None = None) -> dict[str, object]:
    return {
        "task_type": "statistics.describe",
        "input_payload": {"values": values or [2, 4, 6]},
        "evidence": [EvidenceRef(ref="witness:test:oracle")],
    }


def provenance(record, result: dict[str, object]) -> Provenance:
    return Provenance(
        method_id="oracle.statistics.describe",
        method_version="1",
        engine="ORACLE",
        engine_version="0.1.0",
        input_digest=record.input_digest,
        output_digest=sha256_digest(result),
        evidence=record.evidence,
        completed_at=datetime.now(UTC),
        limitations=["integration-test"],
    )


def test_postgres_submission_is_atomic_and_replays_the_original_job(postgres_database: str) -> None:
    async def scenario() -> None:
        store = PostgresJobStore(make_settings(postgres_database))
        await store.start()
        try:
            payload = submission()
            results = await asyncio.gather(
                *(
                    store.submit(**payload, idempotency_key="concurrent-request-01")
                    for _ in range(8)
                )
            )
            job_ids = {record.job_id for record, _ in results}
            assert len(job_ids) == 1
            assert sum(not replayed for _, replayed in results) == 1
            assert sum(replayed for _, replayed in results) == 7

            original, replayed = await store.submit(
                **payload,
                idempotency_key="concurrent-request-01",
            )
            assert replayed is True
            assert original.job_id in job_ids

            with pytest.raises(IdempotencyConflictError):
                await store.submit(
                    **submission([2, 4, 99]),
                    idempotency_key="concurrent-request-01",
                )

            ready, depth = await store.readiness()
            assert ready is True
            assert depth == 1
        finally:
            await store.close()

    asyncio.run(scenario())


def test_postgres_queue_capacity_is_enforced_transactionally(postgres_database: str) -> None:
    async def scenario() -> None:
        store = PostgresJobStore(make_settings(postgres_database, max_queue_size=1))
        await store.start()
        try:
            await store.submit(**submission(), idempotency_key="capacity-first")
            with pytest.raises(QueueSaturatedError):
                await store.submit(**submission([7]), idempotency_key="capacity-second")
            ready, depth = await store.readiness()
            assert ready is True
            assert depth == 1
        finally:
            await store.close()

    asyncio.run(scenario())


def test_postgres_claims_are_exclusive_and_stale_workers_are_fenced(postgres_database: str) -> None:
    async def scenario() -> None:
        store = PostgresJobStore(make_settings(postgres_database))
        await store.start()
        try:
            submitted, replayed = await store.submit(
                **submission(),
                idempotency_key="lease-fencing-01",
            )
            assert replayed is False

            first = await store.claim("worker-a")
            assert first is not None
            assert first.job_id == submitted.job_id

            await store._require_pool().execute(
                """
                UPDATE oracle.jobs
                SET lease_until = now() - INTERVAL '1 second'
                WHERE job_id = $1
                """,
                submitted.job_id,
            )
            second = await store.claim("worker-b")
            assert second is not None
            assert second.job_id == submitted.job_id

            result = {"count": 3, "mean": 4}
            proof = provenance(second, result)
            stale_write = await store.complete(
                job_id=submitted.job_id,
                worker_id="worker-a",
                result={"count": -1},
                provenance=proof,
            )
            assert stale_write is False

            accepted_write = await store.complete(
                job_id=submitted.job_id,
                worker_id="worker-b",
                result=result,
                provenance=proof,
            )
            assert accepted_write is True
            persisted = await store.get(submitted.job_id)
            assert persisted is not None
            assert persisted.status.value == "succeeded"
            assert persisted.result == result
            assert persisted.provenance is not None
            assert persisted.provenance.output_digest == proof.output_digest
        finally:
            await store.close()

    asyncio.run(scenario())


def test_expired_lease_without_reclaim_cannot_be_completed(postgres_database: str) -> None:
    async def scenario() -> None:
        store = PostgresJobStore(make_settings(postgres_database))
        await store.start()
        try:
            submitted, _ = await store.submit(
                **submission(),
                idempotency_key="expired-lease-write-01",
            )
            claimed = await store.claim("worker-a")
            assert claimed is not None
            await store._require_pool().execute(
                """
                UPDATE oracle.jobs
                SET lease_until = now() - INTERVAL '1 second'
                WHERE job_id = $1
                """,
                submitted.job_id,
            )
            result = {"count": 3}
            accepted = await store.complete(
                job_id=submitted.job_id,
                worker_id="worker-a",
                result=result,
                provenance=provenance(claimed, result),
            )
            assert accepted is False
            persisted = await store.get(submitted.job_id)
            assert persisted is not None
            assert persisted.status.value == "running"
        finally:
            await store.close()

    asyncio.run(scenario())


def test_expired_leases_exhaust_attempts_without_fabricating_success(
    postgres_database: str,
) -> None:
    async def scenario() -> None:
        store = PostgresJobStore(make_settings(postgres_database, max_job_attempts=2))
        await store.start()
        try:
            submitted, _ = await store.submit(
                **submission(),
                idempotency_key="lease-exhaustion-01",
            )
            first = await store.claim("worker-a")
            assert first is not None
            await store._require_pool().execute(
                """
                UPDATE oracle.jobs
                SET lease_until = now() - INTERVAL '1 second'
                WHERE job_id = $1
                """,
                submitted.job_id,
            )

            second = await store.claim("worker-b")
            assert second is not None
            assert second.job_id == submitted.job_id
            await store._require_pool().execute(
                """
                UPDATE oracle.jobs
                SET lease_until = now() - INTERVAL '1 second'
                WHERE job_id = $1
                """,
                submitted.job_id,
            )

            assert await store.claim("worker-c") is None
            persisted = await store.get(submitted.job_id)
            assert persisted is not None
            assert persisted.status.value == "failed"
            assert persisted.error is not None
            assert persisted.error.code == "worker_lease_expired"
            assert persisted.result is None
        finally:
            await store.close()

    asyncio.run(scenario())


def test_terminal_job_retention_expires_its_idempotency_record(postgres_database: str) -> None:
    async def scenario() -> None:
        store = PostgresJobStore(
            make_settings(
                postgres_database,
                max_queue_size=1,
                max_retained_jobs=1,
                job_retention_seconds=60,
            )
        )
        await store.start()
        try:
            first, _ = await store.submit(
                **submission(),
                idempotency_key="retained-key-01",
            )
            claimed = await store.claim("worker-a")
            assert claimed is not None
            result = {"count": 3}
            await store.complete(
                job_id=first.job_id,
                worker_id="worker-a",
                result=result,
                provenance=provenance(claimed, result),
            )
            await store._require_pool().execute(
                """
                UPDATE oracle.jobs
                SET completed_at = now() - INTERVAL '10 minutes'
                WHERE job_id = $1
                """,
                first.job_id,
            )

            second, replayed = await store.submit(
                **submission([10, 20]),
                idempotency_key="retained-key-01",
            )
            assert replayed is False
            assert second.job_id != first.job_id
            assert await store.get(first.job_id) is None
        finally:
            await store.close()

    asyncio.run(scenario())


def test_missing_migration_keeps_store_unready_and_rejects_submissions(
    postgres_database: str,
) -> None:
    migration = (Path(__file__).parents[1] / "migrations" / "001_oracle_jobs.sql").read_text()

    async def scenario() -> None:
        connection = await asyncpg.connect(postgres_database)
        await connection.execute("DROP TABLE oracle.jobs")
        await connection.close()

        store = PostgresJobStore(make_settings(postgres_database))
        await store.start()
        try:
            ready, depth = await store.readiness()
            assert ready is False
            assert depth == 0
            with pytest.raises(Exception) as captured:
                await store.submit(
                    **submission(),
                    idempotency_key="schema-missing-01",
                )
            assert captured.type.__name__ == "StorageUnavailableError"
        finally:
            await store.close()

        # Restore the fixture schema for teardown and subsequent isolated test runs.
        connection = await asyncpg.connect(postgres_database)
        try:
            await connection.execute(migration)
        finally:
            await connection.close()

    asyncio.run(scenario())
