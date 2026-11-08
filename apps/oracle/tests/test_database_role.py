from __future__ import annotations

import asyncio
import os
from pathlib import Path

import asyncpg
import pytest

from oracle.job_store import PostgresJobStore
from oracle.schemas import EvidenceRef
from oracle.settings import Settings


def test_oracle_app_role_is_confined_to_oracle_schema() -> None:
    admin_dsn = os.environ.get("ORACLE_TEST_DATABASE_URL")
    app_dsn = os.environ.get("ORACLE_TEST_APP_DATABASE_URL")
    if not admin_dsn or not app_dsn:
        pytest.skip("ORACLE_TEST_DATABASE_URL and ORACLE_TEST_APP_DATABASE_URL are required")

    async def scenario() -> None:
        admin = await asyncpg.connect(admin_dsn)
        try:
            migration_path = Path(__file__).parents[1] / "migrations" / "001_oracle_jobs.sql"
            migration = migration_path.read_text()
            await admin.execute(migration)
            owner = await admin.fetchval(
                "SELECT tableowner FROM pg_tables "
                "WHERE schemaname = 'oracle' AND tablename = 'jobs'"
            )
            assert owner == "oracle_migrator"
            migrator_database_create = await admin.fetchval(
                "SELECT has_database_privilege('oracle_migrator', current_database(), 'CREATE')"
            )
            migrator_schema_create = await admin.fetchval(
                "SELECT has_schema_privilege('oracle_migrator', 'oracle', 'CREATE')"
            )
            assert migrator_database_create is False
            assert migrator_schema_create is True
            app_database_create = await admin.fetchval(
                "SELECT has_database_privilege('oracle_app', current_database(), 'CREATE')"
            )
            app_schema_create = await admin.fetchval(
                "SELECT has_schema_privilege('oracle_app', 'oracle', 'CREATE')"
            )
            assert app_database_create is False
            assert app_schema_create is False
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
                INSERT INTO public.arsy_login_attempts_probe(owner_id, attempt_count)
                VALUES ('probe', 1)
                """
            )
        finally:
            await admin.close()

        app = await asyncpg.connect(app_dsn)
        try:
            await app.fetchval("SELECT count(*) FROM oracle.jobs")
            store = PostgresJobStore(
                Settings.from_env(
                    {
                        "ORACLE_ENV": "test",
                        "ORACLE_HOST": "127.0.0.1",
                        "ORACLE_DATABASE_URL": app_dsn,
                    }
                )
            )
            await store.start()
            try:
                record, replayed = await store.submit(
                    task_type="statistics.describe",
                    input_payload={"values": [1, 2, 3]},
                    evidence=[EvidenceRef(ref="witness:test:role-isolation")],
                    idempotency_key="oracle-role-positive",
                )
                assert replayed is False
                assert await store.get(record.job_id) is not None
                await app.execute(
                    "UPDATE oracle.jobs SET submitted_at = now() WHERE job_id = $1",
                    record.job_id,
                )
                await app.execute("DELETE FROM oracle.jobs WHERE job_id = $1", record.job_id)
            finally:
                await store.close()

            with pytest.raises(asyncpg.InsufficientPrivilegeError):
                await app.fetch("SELECT * FROM public.arsy_login_attempts_probe")
            with pytest.raises(asyncpg.InsufficientPrivilegeError):
                await app.execute("CREATE SCHEMA oracle_app_must_not_create")
            with pytest.raises(asyncpg.InsufficientPrivilegeError):
                await app.execute("ALTER TABLE oracle.jobs ADD COLUMN forbidden text")
        finally:
            await app.close()

        admin = await asyncpg.connect(admin_dsn)
        try:
            await admin.execute(
                "DELETE FROM oracle.jobs WHERE idempotency_key = 'oracle-role-positive'"
            )
            await admin.execute("DROP TABLE IF EXISTS public.arsy_login_attempts_probe")
            await admin.execute("DROP SCHEMA IF EXISTS oracle_app_must_not_create CASCADE")
        finally:
            await admin.close()

    asyncio.run(scenario())
