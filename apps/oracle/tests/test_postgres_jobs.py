from __future__ import annotations

import asyncio
import os
import time
from datetime import UTC, datetime
from urllib.parse import quote, urlsplit, urlunsplit
from uuid import uuid4

import asyncpg
import pytest
from fastapi.testclient import TestClient

from oracle.api import create_app
from oracle.durable_jobs import (
    IdempotencyConflictError,
    PostgresJobCoordinator,
)
from oracle.migrate import apply_migrations
from oracle.schemas import EvidenceRef, JobStatus, Provenance
from oracle.settings import Settings

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="TEST_DATABASE_URL is not configured")
APP_ROLE = "oracle_app_test"
APP_PASSWORD = "oracle-app-integration-only"


async def prepare_database() -> str:
    assert TEST_DATABASE_URL
    await apply_migrations(TEST_DATABASE_URL)
    await apply_migrations(TEST_DATABASE_URL)

    admin = await asyncpg.connect(TEST_DATABASE_URL)
    try:
        await admin.execute(
            f"""
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{APP_ROLE}') THEN
                CREATE ROLE {APP_ROLE} LOGIN PASSWORD '{APP_PASSWORD}';
              END IF;
            END
            $$;
            """
        )
        await admin.execute(f"ALTER ROLE {APP_ROLE} WITH LOGIN PASSWORD '{APP_PASSWORD}'")
        await admin.execute(f"GRANT CONNECT ON DATABASE {await admin.fetchval('SELECT current_database()')} TO {APP_ROLE}")
        await admin.execute(f"GRANT USAGE ON SCHEMA oracle TO {APP_ROLE}")
        await admin.execute(
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA oracle TO {APP_ROLE}"
        )
        await admin.execute("DELETE FROM oracle.jobs")
        is_superuser = await admin.fetchval(
            "SELECT rolsuper FROM pg_roles WHERE rolname = $1",
            APP_ROLE,
        )
        assert is_superuser is False
    finally:
        await admin.close()

    parts = urlsplit(TEST_DATABASE_URL)
    user_info = f"{APP_ROLE}:{quote(APP_PASSWORD, safe='')}"
    netloc = user_info + "@" + parts.hostname
    if parts.port:
        netloc += f":{parts.port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


def make_settings(database_url: str, **overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "test",
        "host": "127.0.0.1",
        "database_url": database_url,
        "worker_count": 1,
        "max_queue_size": 10,
        "max_retained_jobs": 20,
        "lease_seconds": 15,
        "max_attempts": 3,
        "job_retention_seconds": 60,
    }
    values.update(overrides)
    return Settings(**values)  # type: ignore[arg-type]


def test_migrations_atomic_idempotency_capacity_and_lease_fencing() -> None:
    async def run() -> None:
        app_dsn = await prepare_database()
        settings = make_settings(app_dsn)
        first = PostgresJobCoordinator(settings)
        second = PostgresJobCoordinator(settings)
        await first._connect(start_workers=False)
        await second._connect(start_workers=False)
        assert first.accepting and second.accepting

        try:
            submissions = await asyncio.gather(
                *[
                    first.submit(
                        task_type="statistics.describe",
                        input_payload={"values": [1, 2, 3]},
                        evidence=[EvidenceRef(ref="witness:concurrency-test")],
                        idempotency_key="concurrent-oracle-submit",
                    )
                    for _ in range(12)
                ]
            )
            job_ids = {record.job_id for record, _ in submissions}
            assert len(job_ids) == 1
            assert sum(not replayed for _, replayed in submissions) == 1
            assert sum(replayed for _, replayed in submissions) == 11

            with pytest.raises(IdempotencyConflictError):
                await first.submit(
                    task_type="statistics.describe",
                    input_payload={"values": [1, 9]},
                    evidence=[],
                    idempotency_key="concurrent-oracle-submit",
                )
            # Claim through two independent coordinators: the same queued row is claimed once.
            first_claim, second_claim = await asyncio.gather(
                first._claim_one(uuid4()),
                second._claim_one(uuid4()),
            )
            claims = [item for item in (first_claim, second_claim) if item is not None]
            assert len(claims) == 1
            record, stale_token = claims[0]
            assert record.status == JobStatus.RUNNING
            admin = await asyncpg.connect(TEST_DATABASE_URL)
            try:
                await admin.execute(
                    "UPDATE oracle.jobs SET lease_expires_at = now() - interval '1 second' WHERE job_id = $1",
                    record.job_id,
                )
            finally:
                await admin.close()

            recovered = await second._claim_one(uuid4())
            assert recovered is not None
            recovered_record, current_token = recovered
            assert recovered_record.job_id == record.job_id
            assert recovered_record.status == JobStatus.RUNNING
            assert await first._complete(
                record.job_id,
                stale_token,
                {"count": 3},
                Provenance(
                    method_id="test.method",
                    method_version="1",
                    engine="ORACLE",
                    engine_version="test",
                    input_digest="a" * 64,
                    output_digest="b" * 64,
                    evidence=[],
                    completed_at=datetime.now(UTC),
                ),
            ) is False

            provenance = Provenance(
                method_id="test.method",
                method_version="1",
                engine="ORACLE",
                engine_version="test",
                input_digest="a" * 64,
                output_digest="b" * 64,
                evidence=[],
                completed_at=__import__("datetime").datetime.now(__import__("datetime").UTC),
            )
            assert await second._complete(
                record.job_id,
                current_token,
                {"count": 3},
                provenance,
            ) is True
            finished = await first.get(record.job_id)
            assert finished is not None
            assert finished.status == JobStatus.SUCCEEDED
            assert finished.result == {"count": 3}
            assert finished.provenance is not None
            assert finished.provenance.output_digest == "b" * 64

            # Same idempotency key resolves to the stored terminal job.
            replay, replayed = await first.submit(
                task_type="statistics.describe",
                input_payload={"values": [1, 2, 3]},
                evidence=[EvidenceRef(ref="witness:concurrency-test")],
                idempotency_key="concurrent-oracle-submit",
            )
            assert replayed is True
            assert replay.job_id == record.job_id
        finally:
            await first.stop()
            await second.stop()

    asyncio.run(run())


def test_durable_job_result_and_idempotency_survive_oracle_restart() -> None:
    app_dsn = asyncio.run(prepare_database())
    settings = make_settings(app_dsn, worker_count=2)
    payload = {
        "task_type": "statistics.describe",
        "input": {"values": [10, 12, 15, 19]},
        "evidence": [{"ref": "witness:restart-test"}],
    }
    headers = {"Idempotency-Key": "oracle-restart-persistence"}

    with TestClient(create_app(settings)) as first_client:
        readiness = first_client.get("/health/ready").json()
        assert readiness["ready"] is True
        assert readiness["durable_jobs"] is True
        assert readiness["database_available"] is True

        submitted = first_client.post("/v1/jobs", headers=headers, json=payload)
        assert submitted.status_code == 202
        job_id = submitted.json()["job"]["job_id"]
        deadline = time.monotonic() + 10
        job = submitted.json()["job"]
        while time.monotonic() < deadline:
            response = first_client.get(f"/v1/jobs/{job_id}")
            assert response.status_code == 200
            job = response.json()
            if job["status"] in {"succeeded", "failed"}:
                break
            time.sleep(0.02)
        assert job["status"] == "succeeded"
        assert job["result"]["mean"] == 14

    with TestClient(create_app(settings)) as restarted_client:
        persisted = restarted_client.get(f"/v1/jobs/{job_id}")
        assert persisted.status_code == 200
        assert persisted.json()["status"] == "succeeded"
        assert persisted.json()["result"]["mean"] == 14

        replay = restarted_client.post("/v1/jobs", headers=headers, json=payload)
        assert replay.status_code == 202
        assert replay.json()["replayed"] is True
        assert replay.json()["job"]["job_id"] == job_id


def test_durable_mode_fails_closed_without_database_or_migration() -> None:
    settings = make_settings(
        "postgresql://oracle_app:wrong-password@127.0.0.1:1/oracle_missing",
        worker_count=1,
    )
    with TestClient(create_app(settings)) as client:
        assert client.get("/health/live").status_code == 200
        ready = client.get("/health/ready")
        assert ready.status_code == 200
        assert ready.json()["ready"] is False
        assert ready.json()["durable_jobs"] is True
        assert ready.json()["database_available"] is False

        submitted = client.post(
            "/v1/jobs",
            json={"task_type": "statistics.describe", "input": {"values": [1, 2]}},
        )
        assert submitted.status_code == 503
        assert submitted.json()["detail"] == (
            "ORACLE durable job persistence is unavailable or not migrated"
        )



def test_queue_and_retained_job_ceilings_are_enforced_in_postgresql() -> None:
    async def run() -> None:
        app_dsn = await prepare_database()
        queue_limited = PostgresJobCoordinator(
            make_settings(app_dsn, max_queue_size=1, max_retained_jobs=10)
        )
        await queue_limited._connect(start_workers=False)
        try:
            await queue_limited.submit(
                task_type="statistics.describe",
                input_payload={"values": [1, 2]},
                evidence=[],
                idempotency_key="queue-capacity-1",
            )
            with pytest.raises(QueueSaturatedError):
                await queue_limited.submit(
                    task_type="statistics.describe",
                    input_payload={"values": [2, 3]},
                    evidence=[],
                    idempotency_key="queue-capacity-2",
                )
        finally:
            await queue_limited.stop()

        await prepare_database()
        retained_limited = PostgresJobCoordinator(
            make_settings(app_dsn, max_queue_size=10, max_retained_jobs=2)
        )
        await retained_limited._connect(start_workers=False)
        try:
            await retained_limited.submit(
                task_type="statistics.describe",
                input_payload={"values": [1, 2]},
                evidence=[],
                idempotency_key="retained-capacity-1",
            )
            await retained_limited.submit(
                task_type="statistics.describe",
                input_payload={"values": [2, 3]},
                evidence=[],
                idempotency_key="retained-capacity-2",
            )
            with pytest.raises(QueueSaturatedError):
                await retained_limited.submit(
                    task_type="statistics.describe",
                    input_payload={"values": [3, 4]},
                    evidence=[],
                    idempotency_key="retained-capacity-3",
                )
        finally:
            await retained_limited.stop()

    asyncio.run(run())


def test_expired_leases_retry_then_fail_after_bounded_attempts() -> None:
    async def run() -> None:
        app_dsn = await prepare_database()
        coordinator = PostgresJobCoordinator(
            make_settings(app_dsn, max_attempts=2, lease_seconds=15)
        )
        await coordinator._connect(start_workers=False)
        admin = await asyncpg.connect(TEST_DATABASE_URL)
        try:
            submitted, _ = await coordinator.submit(
                task_type="statistics.describe",
                input_payload={"values": [7, 8, 9]},
                evidence=[],
                idempotency_key="lease-retry-limit",
            )
            first = await coordinator._claim_one(uuid4())
            assert first is not None
            _, first_token = first
            await admin.execute(
                "UPDATE oracle.jobs SET lease_expires_at = now() - interval '1 second' WHERE job_id = $1",
                submitted.job_id,
            )

            second = await coordinator._claim_one(uuid4())
            assert second is not None
            _, second_token = second
            assert second_token != first_token
            await admin.execute(
                "UPDATE oracle.jobs SET lease_expires_at = now() - interval '1 second' WHERE job_id = $1",
                submitted.job_id,
            )
            assert await coordinator._claim_one(uuid4()) is None
            failed = await coordinator.get(submitted.job_id)
            assert failed is not None
            assert failed.status == JobStatus.FAILED
            assert failed.error is not None
            assert failed.error.code == "worker_lease_expired"
            assert await coordinator._complete(
                submitted.job_id,
                second_token,
                {"count": 3},
                Provenance(
                    method_id="test.method",
                    method_version="1",
                    engine="ORACLE",
                    engine_version="test",
                    input_digest="a" * 64,
                    output_digest="b" * 64,
                    evidence=[],
                    completed_at=datetime.now(UTC),
                ),
            ) is False
        finally:
            await admin.close()
            await coordinator.stop()

    asyncio.run(run())


def test_missing_migration_keeps_durable_mode_unready_and_returns_503() -> None:
    async def run() -> tuple[str, str]:
        app_dsn = await prepare_database()
        admin = await asyncpg.connect(TEST_DATABASE_URL)
        try:
            await admin.execute("DROP DATABASE IF EXISTS oracle_unmigrated_test WITH (FORCE)")
            await admin.execute("CREATE DATABASE oracle_unmigrated_test")
        finally:
            await admin.close()
        parts = urlsplit(app_dsn)
        missing_dsn = urlunsplit(
            (parts.scheme, parts.netloc, "/oracle_unmigrated_test", parts.query, parts.fragment)
        )
        return missing_dsn, TEST_DATABASE_URL or ""

    missing_dsn, admin_dsn = asyncio.run(run())
    settings = make_settings(missing_dsn)
    try:
        with TestClient(create_app(settings)) as client:
            ready = client.get("/health/ready").json()
            assert ready["ready"] is False
            assert ready["database_available"] is False
            assert ready["durable_jobs"] is True
            rejected = client.post(
                "/v1/jobs",
                json={"task_type": "statistics.describe", "input": {"values": [1, 2]}},
            )
            assert rejected.status_code == 503
    finally:
        async def drop_database() -> None:
            admin = await asyncpg.connect(admin_dsn)
            try:
                await admin.execute("DROP DATABASE IF EXISTS oracle_unmigrated_test WITH (FORCE)")
            finally:
                await admin.close()

        asyncio.run(drop_database())
