"""CLI entry point for local ORACLE development."""

from __future__ import annotations

import uvicorn

from .logging_config import configure_logging
from .settings import Settings


def main() -> None:
    settings = Settings.from_env()
    configure_logging()
    uvicorn.run(
        "oracle.api:create_app",
        factory=True,
        host=settings.host,
        port=settings.port,
        reload=settings.environment == "development",
        log_level="info",
        log_config=None,
    )


if __name__ == "__main__":
    main()
