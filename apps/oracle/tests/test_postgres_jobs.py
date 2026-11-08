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
    QueueSaturatedError,
)
from oracle.migrate import apply_migrations
from oracle.schemas import EvidenceRef, JobStatus, Provenance
from oracle.settings import Settings

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="TEST_DATABASE_URL is not configured")
APP_ROLE = "oracle_app_test"
APP_PASSWORD = "oracle-app-integration-only"


def database_url_for_role(role: str, password: str) -> str:
    assert TEST_DATABASE_URL
    parts = urlsplit(TEST_DATABASE_URL)
    user_info = f"{quote(role, safe='')}:{quote(password, safe='')}"
    netloc = user_info + "@" + parts.hostname
    if parts.port:
        netloc += f":{parts.port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


async def prepare_database() -> str:
    assert TEST_DATABASE_URL
    admin = await asyncpg.connect(TEST_DATABASE_URL)
    try:
        if not await admin.fetchval(
            "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oracle_migrator_test')"
        ):
            await admin.execute(
                "CREATE ROLE oracle_migrator_test LOGIN PASSWORD 'oracle-migrator-integration-only' "
                "NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION"
            )
        if not await admin.fetchval(
            "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oracle_app_test')"
        ):
            await admin.execute(
                "CREATE ROLE oracle_app_test LOGIN PASSWORD 'oracle-app-integration-only' "
                "NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION"
            )
        await admin.execute(
            "ALTER ROLE oracle_migrator_test WITH LOGIN PASSWORD 'oracle-migrator-integration-only' "
            "NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION"
        )
        await admin.execute(
            "ALTER ROLE oracle_app_test WITH LOGIN PASSWORD 'oracle-app-integration-only' "
            "NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION"
        )
        database_name = await admin.fetchval("SELECT current_database()")
        await admin.execute(
            f"GRANT CONNECT ON DATABASE {database_name} TO oracle_migrator_test, oracle_app_test"
        )
        await admin.execute(
            f"REVOKE CREATE ON DATABASE {database_name} FROM oracle_migrator_test, oracle_app_test"
        )
        await admin.execute("CREATE SCHEMA IF NOT EXISTS oracle AUTHORIZATION oracle_migrator_test")
        await admin.execute("ALTER SCHEMA oracle OWNER TO oracle_migrator_test")
        await admin.execute("REVOKE ALL ON SCHEMA oracle FROM PUBLIC, oracle_app_test")
        await admin.execute("GRANT USAGE ON SCHEMA oracle TO oracle_app_test")
        await admin.execute("GRANT USAGE, CREATE ON SCHEMA oracle TO oracle_migrator_test")
        await admin.execute(
            "REVOKE ALL ON SCHEMA public FROM oracle_migrator_test, oracle_app_test"
        )
        await admin.execute(
            "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM oracle_migrator_test, oracle_app_test"
        )
        await admin.execute(
            "REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM oracle_migrator_test, oracle_app_test"
        )
        await admin.execute(
            "ALTER DEFAULT PRIVILEGES FOR ROLE oracle_migrator_test IN SCHEMA oracle "
            "REVOKE ALL ON TABLES FROM oracle_app_test"
        )
    finally:
        await admin.close()

    migrator_dsn = database_url_for_role(
        "oracle_migrator_test",
        "oracle-migrator-integration-only",
    )
    await apply_migrations(migrator_dsn, runtime_role=APP_ROLE)
    await apply_migrations(migrator_dsn, runtime_role=APP_ROLE)

    admin = await asyncpg.connect(TEST_DATABASE_URL)
    try:
        # Simulate role bootstrap on an existing volume: remove all previous
        # runtime table grants, then require the migration runner to restore only
        # the approved oracle.jobs permissions on its next idempotent invocation.
        await admin.execute("REVOKE ALL ON ALL TABLES IN SCHEMA oracle FROM oracle_app_test")
        await admin.execute("DELETE FROM oracle.jobs")
        migration_history_writable = await admin.fetchval(
            "SELECT has_table_privilege($1, 'oracle.schema_migrations', 'UPDATE')",
            APP_ROLE,
        )
        assert migration_history_writable is False
        database_create = await admin.fetchval(
            "SELECT has_database_privilege($1, current_database(), 'CREATE')",
            APP_ROLE,
        )
        schema_create = await admin.fetchval(
            "SELECT has_schema_privilege($1, 'oracle', 'CREATE')",
            APP_ROLE,
        )
        assert database_create is False
        assert schema_create is False
        app_flags = await admin.fetchrow(
            "SELECT rolinherit, rolcreatedb, rolcreaterole, rolreplication "
            "FROM pg_roles WHERE rolname = $1",
            APP_ROLE,
        )
        assert app_flags == {
            "rolinherit": False,
            "rolcreatedb": False,
            "rolcreaterole": False,
            "rolreplication": False,
        }
    finally:
        await admin.close()

    await apply_migrations(migrator_dsn, runtime_role=APP_ROLE)
    admin = await asyncpg.connect(TEST_DATABASE_URL)
    try:
        job_table_writable = await admin.fetchval(
            "SELECT has_table_privilege($1, 'oracle.jobs', 'INSERT')",
            APP_ROLE,
        )
        migration_history_writable = await admin.fetchval(
            "SELECT has_table_privilege($1, 'oracle.schema_migrations', 'UPDATE')",
            APP_ROLE,
        )
        assert job_table_writable is True
        assert migration_history_writable is False
    finally:
        await admin.close()

    return database_url_for_role(APP_ROLE, APP_PASSWORD)


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
            assert (
                await first._complete(
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
                )
                is False
            )

            provenance = Provenance(
                method_id="test.method",
                method_version="1",
                engine="ORACLE",
                engine_version="test",
                input_digest="a" * 64,
                output_digest="b" * 64,
                evidence=[],
                completed_at=datetime.now(UTC),
            )
            assert (
                await second._complete(
                    record.job_id,
                    current_token,
                    {"count": 3},
                    provenance,
                )
                is True
            )
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
        assert ready.status_code == 503
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

        # Only terminal rows older than the retention window are pruned; idempotency
        # replay expires with the owning retained job row.
        await prepare_database()
        retention_coordinator = PostgresJobCoordinator(
            make_settings(app_dsn, max_queue_size=10, max_retained_jobs=2, job_retention_seconds=60)
        )
        await retention_coordinator._connect(start_workers=False)
        try:
            old_record, _ = await retention_coordinator.submit(
                task_type="statistics.describe",
                input_payload={"values": [4, 5]},
                evidence=[],
                idempotency_key="retention-old-key",
            )
            admin = await asyncpg.connect(TEST_DATABASE_URL)
            try:
                await admin.execute(
                    """
                    UPDATE oracle.jobs
                    SET status = 'failed',
                        completed_at = now() - interval '120 seconds',
                        error = '{"code":"test","message":"expired test row"}'::jsonb
                    WHERE job_id = $1
                    """,
                    old_record.job_id,
                )
            finally:
                await admin.close()

            replacement, replayed = await retention_coordinator.submit(
                task_type="statistics.describe",
                input_payload={"values": [4, 5]},
                evidence=[],
                idempotency_key="retention-old-key",
            )
            assert replayed is False
            assert replacement.job_id != old_record.job_id
            assert await retention_coordinator.get(old_record.job_id) is None
        finally:
            await retention_coordinator.stop()

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
            assert (
                await coordinator._complete(
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
                )
                is False
            )
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
            await admin.execute(
                "GRANT CONNECT ON DATABASE oracle_unmigrated_test TO oracle_app_test"
            )
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




def test_runtime_role_is_confined_to_oracle_jobs() -> None:
    async def scenario() -> None:
        app_dsn = await prepare_database()
        admin = await asyncpg.connect(TEST_DATABASE_URL)
        try:
            await admin.execute(
                """
                CREATE TABLE IF NOT EXISTS public.arsy_login_attempts_probe (
                  owner_id text PRIMARY KEY,
                  attempt_count integer NOT NULL
                )
                """
            )
            await admin.execute("TRUNCATE public.arsy_login_attempts_probe")
            await admin.execute(
                """
                INSERT INTO public.arsy_login_attempts_probe (owner_id, attempt_count)
                VALUES ('probe', 1)
                """
            )
            app_db_create = await admin.fetchval(
                "SELECT has_database_privilege($1, current_database(), 'CREATE')",
                APP_ROLE,
            )
            app_oracle_create = await admin.fetchval(
                "SELECT has_schema_privilege($1, 'oracle', 'CREATE')",
                APP_ROLE,
            )
            migrator_db_create = await admin.fetchval(
                "SELECT has_database_privilege('oracle_migrator_test', current_database(), 'CREATE')"
            )
            migrator_oracle_create = await admin.fetchval(
                "SELECT has_schema_privilege('oracle_migrator_test', 'oracle', 'CREATE')"
            )
            assert app_db_create is False
            assert app_oracle_create is False
            assert migrator_db_create is False
            assert migrator_oracle_create is True
        finally:
            await admin.close()

        app = await asyncpg.connect(app_dsn)
        try:
            assert await app.fetchval("SELECT count(*) FROM oracle.jobs") >= 0
            with pytest.raises(asyncpg.InsufficientPrivilegeError):
                await app.fetch("SELECT * FROM public.arsy_login_attempts_probe")
            with pytest.raises(asyncpg.InsufficientPrivilegeError):
                await app.fetch("SELECT * FROM oracle.schema_migrations")
            with pytest.raises(asyncpg.InsufficientPrivilegeError):
                await app.execute("CREATE SCHEMA oracle_app_must_not_create")
            with pytest.raises(asyncpg.InsufficientPrivilegeError):
                await app.execute("CREATE TABLE oracle.app_must_not_create (id integer)")
            with pytest.raises(asyncpg.InsufficientPrivilegeError):
                await app.execute("ALTER TABLE oracle.jobs ADD COLUMN forbidden text")
            with pytest.raises(asyncpg.InsufficientPrivilegeError):
                await app.execute("DROP TABLE oracle.jobs")
            with pytest.raises(asyncpg.InsufficientPrivilegeError):
                await app.execute("SET ROLE oracle_migrator_test")
        finally:
            await app.close()

            cleanup = await asyncpg.connect(TEST_DATABASE_URL)
            try:
                await cleanup.execute("DROP TABLE IF EXISTS public.arsy_login_attempts_probe")
            finally:
                await cleanup.close()

    asyncio.run(scenario())
