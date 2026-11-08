"""Explicit, checksum-verified ORACLE PostgreSQL migration runner."""

from __future__ import annotations

import asyncio
import hashlib
import os
import re
from pathlib import Path

import asyncpg


def _resolve_migrations_dir() -> Path:
    candidates: list[Path] = []
    configured = os.environ.get("ORACLE_MIGRATIONS_DIR")
    if configured:
        candidates.append(Path(configured).expanduser().resolve())
    candidates.extend(
        [
            Path(__file__).resolve().parents[2] / "migrations",
            Path.cwd() / "migrations",
        ]
    )
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    raise RuntimeError(
        "ORACLE SQL migrations directory is missing; set ORACLE_MIGRATIONS_DIR "
        "or include the migrations directory in the application image"
    )


async def apply_migrations(
    database_url: str | None = None,
    *,
    runtime_role: str = "oracle_app",
) -> None:
    dsn = (
        database_url
        or os.environ.get("ORACLE_MIGRATION_DATABASE_URL")
        or os.environ.get("ORACLE_DATABASE_URL")
    )
    if not dsn:
        raise RuntimeError("ORACLE_MIGRATION_DATABASE_URL is required")
    if not re.fullmatch(r"[a-z_][a-z0-9_]*", runtime_role):
        raise ValueError("ORACLE_APP_DB_ROLE must be a simple PostgreSQL role identifier")

    migrations_dir = _resolve_migrations_dir()
    migration_files = sorted(migrations_dir.glob("[0-9][0-9][0-9]_*.sql"))
    if not migration_files:
        raise RuntimeError(f"No ORACLE SQL migration files found in {migrations_dir}")

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
        await connection.execute(
            "REVOKE ALL PRIVILEGES ON TABLE oracle.schema_migrations FROM PUBLIC"
        )
        await connection.execute(
            f'REVOKE ALL PRIVILEGES ON TABLE oracle.schema_migrations FROM "{runtime_role}"'
        )

        for path in migration_files:
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
