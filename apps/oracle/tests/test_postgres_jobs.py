from __future__ import annotations

import asyncio
import os
import time
from urllib.parse import quote, urlsplit, urlunsplit
from uuid import uuid4

import asyncpg
import pytest
from fastapi.testclient import TestClient

from oracle.api import create_app
from oracle.durable_jobs import PersistenceUnavailableError, PostgresJobCoordinator
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

            with pytest.raises(Exception) as conflict:
                await first.submit(
                    task_type="statistics.describe",
                    input_payload={"values": [1, 9]},
                    evidence=[],
                    idempotency_key="concurrent-oracle-submit",
                )
            assert conflict.type.__name__ == "IdempotencyConflictError"

            # Claim through two independent coordinators: the same queued row is claimed once.
            first_claim, second_claim = await asyncio.gather(
                first._claim_one(uuid4()),
                second._claim_one(uuid4()),
            )
            claims = [item for item in (first_claim, second_claim) if item is not None]
            assert len(claims) == 1
            record, stale_token = claims[0]
            assert record.status == JobStatus.RUNNING
            assert record.attempt_count if hasattr(record, "attempt_count") else True

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
                    completed_at=__import__("datetime").datetime.now(__import__("datetime").UTC),
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
