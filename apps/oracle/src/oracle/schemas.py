"""Versioned request and response models for the internal ARSY contract."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class EvidenceRef(StrictModel):
    ref: str = Field(min_length=1, max_length=256)
    relation: str = Field(default="wasDerivedFrom", min_length=1, max_length=64)


class StatisticsInput(StrictModel):
    values: list[Annotated[float, Field(allow_inf_nan=False)]] = Field(
        min_length=1, max_length=10_000
    )
    label: str | None = Field(default=None, max_length=160)


class TextProfileInput(StrictModel):
    text: str = Field(min_length=1, max_length=100_000)
    language_hint: str | None = Field(default=None, min_length=2, max_length=32)


class StatisticsJobSubmission(StrictModel):
    task_type: Literal["statistics.describe"]
    input: StatisticsInput
    evidence: list[EvidenceRef] = Field(default_factory=list, max_length=100)


class TextProfileJobSubmission(StrictModel):
    task_type: Literal["text.profile"]
    input: TextProfileInput
    evidence: list[EvidenceRef] = Field(default_factory=list, max_length=100)


JobSubmission = Annotated[
    StatisticsJobSubmission | TextProfileJobSubmission,
    Field(discriminator="task_type"),
]


class JobError(StrictModel):
    code: str
    message: str


class Provenance(StrictModel):
    method_id: str
    method_version: str
    engine: str
    engine_version: str
    digest_algorithm: Literal["sha-256"] = "sha-256"
    input_digest: str
    output_digest: str
    evidence: list[EvidenceRef]
    completed_at: datetime
    limitations: list[str] = Field(default_factory=list)


class JobView(StrictModel):
    job_id: UUID
    task_type: str
    status: JobStatus
    submitted_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    result: dict[str, Any] | None = None
    error: JobError | None = None
    provenance: Provenance | None = None


class JobSubmissionResponse(StrictModel):
    job: JobView
    replayed: bool = False


class HealthResponse(StrictModel):
    status: Literal["ok"]
    service: Literal["oracle"] = "oracle"


class ReadinessResponse(StrictModel):
    ready: bool
    service: Literal["oracle"] = "oracle"
    queue_depth: int
    queue_capacity: int
    workers: int
    durable_jobs: bool = False


class CapabilitiesResponse(StrictModel):
    service: Literal["oracle"] = "oracle"
    contract_version: Literal["v1"] = "v1"
    tasks: list[str]
    max_numeric_values: int
    max_text_chars: int
    durable_jobs: Literal[False] = False
    model_inference: Literal[False] = False
