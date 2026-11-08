from __future__ import annotations

import time

from fastapi.testclient import TestClient

from oracle.api import create_app
from oracle.settings import Settings


def make_client(*, token: str | None = None) -> TestClient:
    return TestClient(
        create_app(
            Settings(
                environment="test",
                host="127.0.0.1",
                service_token=token,
                max_queue_size=4,
                max_retained_jobs=20,
            )
        )
    )


def wait_for_job(client: TestClient, job_id: str) -> dict:
    for _ in range(100):
        response = client.get(f"/v1/jobs/{job_id}")
        assert response.status_code == 200
        body = response.json()
        if body["status"] in {"succeeded", "failed"}:
            return body
        time.sleep(0.01)
    raise AssertionError("job did not reach a terminal state")


def test_health_and_readiness_are_available() -> None:
    with make_client() as client:
        assert client.get("/health/live").json()["status"] == "ok"
        ready = client.get("/health/ready").json()
        assert ready["ready"] is True
        assert ready["durable_jobs"] is False


def test_statistics_job_runs_and_returns_provenance() -> None:
    with make_client() as client:
        submitted = client.post(
            "/v1/jobs",
            headers={"Idempotency-Key": "stats-1"},
            json={
                "task_type": "statistics.describe",
                "input": {"values": [1, 2, 3, 4]},
                "evidence": [{"ref": "evidence:dataset-1"}],
            },
        )
        assert submitted.status_code == 202
        job_id = submitted.json()["job"]["job_id"]
        finished = wait_for_job(client, job_id)

        assert finished["status"] == "succeeded"
        assert finished["result"]["mean"] == 2.5
        assert finished["provenance"]["method_id"] == "oracle.statistics.describe"
        assert finished["provenance"]["evidence"][0]["ref"] == "evidence:dataset-1"
        assert len(finished["provenance"]["input_digest"]) == 64
        assert len(finished["provenance"]["output_digest"]) == 64


def test_idempotency_replays_same_job() -> None:
    with make_client() as client:
        body = {"task_type": "statistics.describe", "input": {"values": [3, 3, 3]}}
        first = client.post("/v1/jobs", headers={"Idempotency-Key": "same-key"}, json=body)
        second = client.post("/v1/jobs", headers={"Idempotency-Key": "same-key"}, json=body)

        assert first.status_code == second.status_code == 202
        assert first.json()["job"]["job_id"] == second.json()["job"]["job_id"]
        assert second.json()["replayed"] is True


def test_idempotency_key_cannot_be_reused_for_different_payload() -> None:
    with make_client() as client:
        headers = {"Idempotency-Key": "same-key"}
        first = client.post(
            "/v1/jobs",
            headers=headers,
            json={"task_type": "statistics.describe", "input": {"values": [1, 2]}},
        )
        second = client.post(
            "/v1/jobs",
            headers=headers,
            json={"task_type": "statistics.describe", "input": {"values": [1, 9]}},
        )

        assert first.status_code == 202
        assert second.status_code == 409


def test_invalid_non_finite_numbers_are_rejected() -> None:
    with make_client() as client:
        response = client.post(
            "/v1/jobs",
            content=b'{"task_type":"statistics.describe","input":{"values":[1,NaN]}}',
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 422
        assert "nan" not in response.text.lower()


def test_service_token_protects_versioned_api() -> None:
    token = "s" * 40
    with make_client(token=token) as client:
        assert client.get("/v1/capabilities").status_code == 401
        response = client.get("/v1/capabilities", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert response.json()["model_inference"] is False


def test_text_profile_job_returns_aggregate_counts() -> None:
    with make_client() as client:
        submitted = client.post(
            "/v1/jobs",
            json={"task_type": "text.profile", "input": {"text": "One moon. Two moons."}},
        )
        assert submitted.status_code == 202
        finished = wait_for_job(client, submitted.json()["job"]["job_id"])

        assert finished["status"] == "succeeded"
        assert finished["result"]["word_count"] == 4
        assert "text" not in finished["result"]
        assert finished["provenance"]["method_id"] == "oracle.text.profile"


def test_job_body_limit_returns_413() -> None:
    settings = Settings(
        environment="test",
        host="127.0.0.1",
        max_text_chars=100,
        max_numeric_values=10,
    )
    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/v1/jobs",
            content=b" " * 50_000,
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 413


def test_openapi_exposes_versioned_job_contract() -> None:
    with make_client() as client:
        spec = client.get("/openapi.json").json()

    request_schema = spec["paths"]["/v1/jobs"]["post"]["requestBody"]["content"][
        "application/json"
    ]["schema"]
    assert "/v1/jobs" in spec["paths"]
    assert len(request_schema["oneOf"]) == 2
