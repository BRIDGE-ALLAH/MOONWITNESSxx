"""Explicit, checksum-verified ORACLE PostgreSQL migration runner."""

from __future__ import annotations

import asyncio
import hashlib
import os
from pathlib import Path

import asyncpg

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent.parent / "migrations"


async def apply_migrations(database_url: str | None = None) -> None:
    dsn = (
        database_url
        or os.environ.get("ORACLE_MIGRATION_DATABASE_URL")
        or os.environ.get("ORACLE_DATABASE_URL")
    )
    if not dsn:
        raise RuntimeError("ORACLE_MIGRATION_DATABASE_URL is required")

    connection = await asyncpg.connect(dsn, command_timeout=15)
    try:
        schema_exists = await connection.fetchval(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.schemata
                WHERE schema_name = 'oracle'
            )
            """
        )
        if not schema_exists:
            raise RuntimeError(
                "ORACLE schema is missing; run the privileged role/bootstrap step before migrations"
            )

        await connection.execute(
            """
            CREATE TABLE IF NOT EXISTS oracle.schema_migrations (
              version text PRIMARY KEY,
              checksum char(64) NOT NULL,
              applied_at timestamptz NOT NULL DEFAULT now()
            )
            """
        )

        for path in sorted(MIGRATIONS_DIR.glob("[0-9][0-9][0-9]_*.sql")):
            sql = path.read_text(encoding="utf-8")
            checksum = hashlib.sha256(sql.encode("utf-8")).hexdigest()
            existing = await connection.fetchrow(
                "SELECT checksum FROM oracle.schema_migrations WHERE version = $1",
                path.name,
            )
            if existing:
                if existing["checksum"].strip() != checksum:
                    raise RuntimeError(f"Applied migration checksum changed: {path.name}")
                continue

            async with connection.transaction():
                await connection.execute(sql)
                await connection.execute(
                    """
                    INSERT INTO oracle.schema_migrations (version, checksum)
                    VALUES ($1, $2)
                    """,
                    path.name,
                    checksum,
                )
    finally:
        await connection.close()


def main() -> None:
    asyncio.run(apply_migrations())


if __name__ == "__main__":
    main()
