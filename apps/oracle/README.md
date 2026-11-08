# ORACLE — Python Intelligence Service

**Stage:** Stage 1 foundation · **Status:** development-only, not production-ready

ORACLE is the MOONWITNESS Python service for bounded computation and research-oriented analysis. In this first stage it provides a versioned internal API, a bounded in-process job queue, deterministic statistical/text profiling tasks, and digest-based derivation metadata.

## Ownership boundaries

- **ARSY** remains the caller-facing API, identity, authentication/authorization, policy integration, and orchestration authority. ARSY is expected to authenticate the caller and invoke ORACLE over a private service-to-service network.
- **ORACLE** owns computation only. It does not mint user identities, decide permissions, run general workflows, own canonical audit records, or store source evidence.
- **WITNESS FABRIC** remains the evidence/provenance owner. ORACLE returns caller-supplied evidence references plus reproducible SHA-256 digests and method metadata. These digests are not digital signatures, trusted timestamps, or proof that an evidence source is authentic.
- **DIVINE** stays framework-neutral. It has no dependency on this Python runtime.
- **WORLD OBSERVATORY** is the future human-facing research experience; this service does not include a UI.

## Stage 1 capabilities

| Task | Behavior | Important limitation |
|---|---|---|
| \`statistics.describe\` | Count, min/max, mean, median, population variance and standard deviation | Describes the supplied numeric sample; does not infer causality |
| \`text.profile\` | Character, line, word and unique-word counts; heuristic sentence count and average word length | Lexical heuristic only; not NER, semantic analysis, translation or language detection |

All inputs have explicit size limits. Only aggregate outputs are returned for text profiling; submitted source text is not included in results or application log messages.

## API contract

The service exposes:

- \`GET /health/live\` — process liveness.
- \`GET /health/ready\` — worker/readiness and queue capacity; explicitly reports that jobs are not durable.
- \`GET /v1/capabilities\` — available task types and limits.
- \`POST /v1/jobs\` — submit a job; responds \`202 Accepted\` and a job ID.
- \`GET /v1/jobs/{job_id}\` — retrieve job status/result/provenance.

Example request:

\`\`\`http
POST /v1/jobs HTTP/1.1
Content-Type: application/json
Idempotency-Key: research-run-0001
Authorization: Bearer <service-token>
\`\`\`

\`\`\`json
{
  "task_type": "statistics.describe",
  "input": {"values": [10, 12, 15, 19]},
  "evidence": [{"ref": "witness:evidence-123", "relation": "wasDerivedFrom"}]
}
\`\`\`

The request body is versioned at \`/v1\`; Pydantic rejects unknown fields. Reusing an \`Idempotency-Key\` with the same canonical request returns the original job while reusing it with a different request returns \`409 Conflict\`.

## Local development

Requires Python 3.12 or newer.

\`\`\`bash
cd apps/oracle
python -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[dev]'
cp .env.example .env
set -a && . ./.env && set +a
python -m oracle
\`\`\`

The default local configuration binds to \`127.0.0.1:8010\` and permits unauthenticated development calls only on loopback. Set a random \`ORACLE_SERVICE_TOKEN\` (at least 32 characters) whenever binding to a non-loopback address. Send it as \`Authorization: Bearer ...\` for \`/v1/*\` routes. Health endpoints remain unauthenticated for local health checks.

Run checks:

\`\`\`bash
ruff check .
ruff format --check .
pytest
\`\`\`

Build the container from this directory:

\`\`\`bash
docker build -t moonwitness-oracle:stage1 .
docker run --rm -p 127.0.0.1:8010:8010 \\
  -e ORACLE_SERVICE_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')" \\
  moonwitness-oracle:stage1
\`\`\`

The container binds to \`0.0.0.0\` and therefore requires a service token. Do not expose this service directly to the public internet; place it behind ARSY on a private network.

## Stage 1 safety and operational limitations

- Jobs and idempotency keys live in process memory only. Restarting the service loses queued/running jobs, results, and idempotency history.
- The queue, worker count, numeric input size, text size, and retained-job count are bounded. Queue saturation returns \`503\` with \`Retry-After\`.
- The service is intentionally not a durable queue consumer and does not connect to PostgreSQL, Redis/BullMQ, NATS, an AI provider, a GPU, an RDF store, or a vector database.
- \`ORACLE_ENV=production\` is rejected at startup until durable job storage/queue, production observability, secrets, network controls, and deployment validation exist.
- Caller authentication and authorization belong to ARSY. A configured ORACLE bearer token is only a service-to-service boundary, not a replacement for user authorization.
- No source text or numeric input values are written to application logs. Result payloads remain accessible to the trusted internal caller through the job API.
- A SHA-256 digest is a reproducible fingerprint only. Evidence authenticity, signatures, trusted timestamps, retention, and canonical audit storage remain outside ORACLE.

This project is a first implementation foundation, not a production-ready intelligence platform.
