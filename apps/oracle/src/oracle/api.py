"""FastAPI application factory for the internal ORACLE service."""

from __future__ import annotations

import hmac
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from . import __version__
from .jobs import (
    IdempotencyConflictError,
    JobCoordinator,
    JobRecord,
    QueueSaturatedError,
)
from .middleware import JobBodyLimitMiddleware
from .schemas import (
    CapabilitiesResponse,
    HealthResponse,
    JobSubmission,
    JobSubmissionResponse,
    JobView,
    ReadinessResponse,
)
from .settings import Settings


def _to_job_view(record: JobRecord) -> JobView:
    return JobView(
        job_id=record.job_id,
        task_type=record.task_type,
        status=record.status,
        submitted_at=record.submitted_at,
        started_at=record.started_at,
        completed_at=record.completed_at,
        result=record.result,
        error=record.error,
        provenance=record.provenance,
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings.from_env()
    config.validate()
    coordinator = JobCoordinator(config)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await coordinator.start()
        app.state.coordinator = coordinator
        yield
        await coordinator.stop()

    app = FastAPI(
        title="MOONWITNESS ORACLE API",
        summary="Internal, bounded intelligence and computation service",
        description=(
            "ORACLE performs deterministic stage-1 analysis jobs. ARSY remains the "
            "identity, authorization, caller-facing API, and orchestration authority."
        ),
        version=__version__,
        lifespan=lifespan,
    )
    app.state.coordinator = coordinator
    app.state.settings = config
    maximum_body_bytes = max(
        config.max_text_chars * 4 + 8_192,
        config.max_numeric_values * 32 + 8_192,
    )
    app.add_middleware(JobBodyLimitMiddleware, max_bytes=maximum_body_bytes)

    async def require_service_auth(
        authorization: Annotated[str | None, Header()] = None,
    ) -> None:
        token = config.service_token
        if token is None:
            return  # Settings permits this only for a loopback-bound local service.
        scheme, separator, supplied = (authorization or "").partition(" ")
        if (
            not separator
            or scheme.lower() != "bearer"
            or not hmac.compare_digest(supplied, token)
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Service authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )

    auth = [Depends(require_service_auth)]

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # Exclude raw invalid values: they may be non-JSON numbers or sensitive input.
        safe_errors = [
            {
                "loc": list(error.get("loc", ())),
                "msg": error.get("msg", "Invalid value"),
                "type": error.get("type", "value_error"),
            }
            for error in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": safe_errors})

    @app.get("/health/live", response_model=HealthResponse, tags=["health"])
    async def live() -> HealthResponse:
        return HealthResponse(status="ok")

    @app.get("/health/ready", response_model=ReadinessResponse, tags=["health"])
    async def ready() -> ReadinessResponse:
        return ReadinessResponse(
            ready=coordinator.accepting,
            queue_depth=coordinator.queue_depth,
            queue_capacity=config.max_queue_size,
            workers=config.worker_count,
        )

    @app.get(
        "/v1/capabilities",
        response_model=CapabilitiesResponse,
        dependencies=auth,
        tags=["contract"],
    )
    async def capabilities() -> CapabilitiesResponse:
        return CapabilitiesResponse(
            tasks=["statistics.describe", "text.profile"],
            max_numeric_values=config.max_numeric_values,
            max_text_chars=config.max_text_chars,
        )

    @app.post(
        "/v1/jobs",
        response_model=JobSubmissionResponse,
        status_code=status.HTTP_202_ACCEPTED,
        dependencies=auth,
        tags=["jobs"],
    )
    async def submit_job(
        payload: JobSubmission,
        response: Response,
        idempotency_key: Annotated[
            str | None, Header(alias="Idempotency-Key", min_length=1, max_length=128)
        ] = None,
    ) -> JobSubmissionResponse:
        input_payload = payload.input.model_dump(mode="json")
        if payload.task_type == "statistics.describe":
            if len(input_payload["values"]) > config.max_numeric_values:
                raise HTTPException(status_code=422, detail="Numeric input exceeds service limit")
        if payload.task_type == "text.profile":
            if len(input_payload["text"]) > config.max_text_chars:
                raise HTTPException(status_code=422, detail="Text input exceeds service limit")

        try:
            record, replayed = await coordinator.submit(
                task_type=payload.task_type,
                input_payload=input_payload,
                evidence=payload.evidence,
                idempotency_key=idempotency_key,
            )
        except IdempotencyConflictError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Idempotency-Key was already used for a different request",
            ) from exc
        except QueueSaturatedError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
                headers={"Retry-After": "5"},
            ) from exc

        response.headers["Location"] = f"/v1/jobs/{record.job_id}"
        response.headers["Idempotency-Replayed"] = str(replayed).lower()
        return JobSubmissionResponse(job=_to_job_view(record), replayed=replayed)

    @app.get(
        "/v1/jobs/{job_id}",
        response_model=JobView,
        dependencies=auth,
        tags=["jobs"],
    )
    async def get_job(job_id: UUID) -> JobView:
        record = await coordinator.get(job_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Job not found")
        return _to_job_view(record)

    return app
