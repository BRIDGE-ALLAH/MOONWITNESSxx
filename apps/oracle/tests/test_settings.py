from __future__ import annotations

import pytest

from oracle.settings import Settings


def test_loopback_development_can_run_without_service_token() -> None:
    settings = Settings.from_env({"ORACLE_ENV": "test", "ORACLE_HOST": "127.0.0.1"})

    assert settings.service_token is None


def test_non_loopback_requires_service_token() -> None:
    with pytest.raises(ValueError, match="ORACLE_SERVICE_TOKEN is required"):
        Settings.from_env({"ORACLE_ENV": "test", "ORACLE_HOST": "0.0.0.0"})


def test_non_loopback_accepts_strong_service_token() -> None:
    settings = Settings.from_env(
        {
            "ORACLE_ENV": "test",
            "ORACLE_HOST": "0.0.0.0",
            "ORACLE_SERVICE_TOKEN": "x" * 40,
        }
    )

    assert settings.host == "0.0.0.0"


def test_production_mode_fails_closed() -> None:
    with pytest.raises(ValueError, match="production mode is blocked"):
        Settings.from_env({"ORACLE_ENV": "production"})


def test_postgres_job_store_settings_are_bounded_and_explicit() -> None:
    settings = Settings.from_env(
        {
            "ORACLE_ENV": "test",
            "ORACLE_HOST": "127.0.0.1",
            "ORACLE_DATABASE_URL": "postgresql://oracle:test@127.0.0.1:5432/oracle",
            "ORACLE_JOB_LEASE_SECONDS": "30",
            "ORACLE_MAX_JOB_ATTEMPTS": "4",
            "ORACLE_JOB_RETENTION_SECONDS": "3600",
        }
    )

    assert settings.database_url.startswith("postgresql://")
    assert settings.job_lease_seconds == 30
    assert settings.max_job_attempts == 4
    assert settings.job_retention_seconds == 3600


def test_non_postgres_job_store_url_is_rejected() -> None:
    with pytest.raises(ValueError, match="ORACLE_DATABASE_URL must use the PostgreSQL URL scheme"):
        Settings.from_env(
            {
                "ORACLE_ENV": "test",
                "ORACLE_DATABASE_URL": "sqlite:///oracle.db",
            }
        )


def test_production_remains_blocked_even_when_durable_storage_is_configured() -> None:
    with pytest.raises(ValueError, match="production mode is blocked"):
        Settings.from_env(
            {
                "ORACLE_ENV": "production",
                "ORACLE_DATABASE_URL": "postgresql://oracle:test@127.0.0.1:5432/oracle",
                "ORACLE_SERVICE_TOKEN": "x" * 40,
                "ORACLE_HOST": "0.0.0.0",
            }
        )
