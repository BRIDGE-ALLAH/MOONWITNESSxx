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
