"""Environment configuration and fail-closed runtime checks."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from ipaddress import ip_address


@dataclass(frozen=True, slots=True)
class Settings:
    environment: str = "development"
    host: str = "127.0.0.1"
    port: int = 8010
    service_token: str | None = None
    worker_count: int = 1
    max_queue_size: int = 100
    max_retained_jobs: int = 1_000
    max_numeric_values: int = 10_000
    max_text_chars: int = 100_000
    shutdown_grace_seconds: int = 5
    database_url: str | None = None
    job_lease_seconds: int = 120
    max_job_attempts: int = 3
    job_retention_seconds: int = 86_400

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> Settings:
        values = os.environ if environ is None else environ

        def positive_int(name: str, default: int, *, minimum: int = 1) -> int:
            raw = values.get(name, str(default))
            try:
                parsed = int(raw)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"{name} must be an integer") from exc
            if parsed < minimum:
                raise ValueError(f"{name} must be at least {minimum}")
            return parsed

        token = (values.get("ORACLE_SERVICE_TOKEN") or "").strip() or None
        settings = cls(
            environment=values.get("ORACLE_ENV", "development").strip().lower(),
            host=values.get("ORACLE_HOST", "127.0.0.1").strip(),
            port=positive_int("ORACLE_PORT", 8010),
            service_token=token,
            worker_count=positive_int("ORACLE_WORKER_COUNT", 1),
            max_queue_size=positive_int("ORACLE_MAX_QUEUE_SIZE", 100),
            max_retained_jobs=positive_int("ORACLE_MAX_RETAINED_JOBS", 1_000),
            max_numeric_values=positive_int("ORACLE_MAX_NUMERIC_VALUES", 10_000),
            max_text_chars=positive_int("ORACLE_MAX_TEXT_CHARS", 100_000),
            shutdown_grace_seconds=positive_int("ORACLE_SHUTDOWN_GRACE_SECONDS", 5, minimum=0),
            database_url=(values.get("ORACLE_DATABASE_URL") or "").strip() or None,
            job_lease_seconds=positive_int("ORACLE_JOB_LEASE_SECONDS", 120),
            max_job_attempts=positive_int("ORACLE_MAX_JOB_ATTEMPTS", 3),
            job_retention_seconds=positive_int("ORACLE_JOB_RETENTION_SECONDS", 86_400),
        )
        settings.validate()
        return settings

    def validate(self) -> None:
        if not 1 <= self.port <= 65_535:
            raise ValueError("ORACLE_PORT must be between 1 and 65535")
        if self.shutdown_grace_seconds < 0:
            raise ValueError("ORACLE_SHUTDOWN_GRACE_SECONDS must be zero or greater")
        if not 1 <= self.worker_count <= 16:
            raise ValueError("ORACLE_WORKER_COUNT must be between 1 and 16")
        if not 1 <= self.max_queue_size <= 10_000:
            raise ValueError("ORACLE_MAX_QUEUE_SIZE must be between 1 and 10000")
        if not self.max_queue_size <= self.max_retained_jobs <= 10_000:
            raise ValueError("ORACLE_MAX_RETAINED_JOBS must be between queue size and 10000")
        if not 1 <= self.max_numeric_values <= 10_000:
            raise ValueError("ORACLE_MAX_NUMERIC_VALUES must be between 1 and 10000")
        if not 1 <= self.max_text_chars <= 100_000:
            raise ValueError("ORACLE_MAX_TEXT_CHARS must be between 1 and 100000")
        if not 5 <= self.job_lease_seconds <= 3_600:
            raise ValueError("ORACLE_JOB_LEASE_SECONDS must be between 5 and 3600")
        if not 1 <= self.max_job_attempts <= 10:
            raise ValueError("ORACLE_MAX_JOB_ATTEMPTS must be between 1 and 10")
        if not 60 <= self.job_retention_seconds <= 2_592_000:
            raise ValueError("ORACLE_JOB_RETENTION_SECONDS must be between 60 and 2592000")
        if self.database_url is not None and not self.database_url.startswith(("postgresql://", "postgres://")):
            raise ValueError("ORACLE_DATABASE_URL must use the PostgreSQL URL scheme")
        if self.environment not in {"development", "test"}:
            if self.environment == "production":
                raise ValueError(
                    "ORACLE production mode is blocked until managed database credentials, "
                    "backups and restore, production observability, network policy, and deployment/rollback controls are verified"
                )
            raise ValueError("ORACLE_ENV must be development or test until production controls are approved")

        try:
            is_loopback = ip_address(self.host).is_loopback
        except ValueError as exc:
            raise ValueError("ORACLE_HOST must be an IP address in stage 1") from exc

        if not is_loopback and not self.service_token:
            raise ValueError("ORACLE_SERVICE_TOKEN is required when ORACLE_HOST is not loopback")
        if self.service_token is not None and len(self.service_token) < 32:
            raise ValueError("ORACLE_SERVICE_TOKEN must contain at least 32 characters")
