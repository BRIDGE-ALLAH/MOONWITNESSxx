# ORACLE — Python Intelligence Service

**Stage:** Stage 1 computation + Stage 2 durable job-store foundation · **Status:** production deployment remains blocked

ORACLE is the MOONWITNESS Python service for bounded computation and research-oriented analysis. It provides a versioned internal API, bounded deterministic statistical/text profiling tasks, and digest-based derivation metadata. Local loopback mode can use an in-process queue; configured Compose/shared environments use the PostgreSQL-backed job store.

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
- \`GET /health/ready\` — worker/readiness, queue capacity and configured durability; returns HTTP 503 while configured storage or its explicit migration is unavailable.
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

## Job storage and durability

- Without ORACLE_DATABASE_URL, loopback development and isolated unit tests use the bounded in-memory queue. Jobs and idempotency keys are lost on process restart in this mode.
- With ORACLE_DATABASE_URL, ORACLE stores bounded job payloads, state, result, digest, provenance, and idempotency key in its own oracle.jobs table. Submissions and idempotency replay are serialized transactionally; workers claim jobs with PostgreSQL FOR UPDATE SKIP LOCKED and finite leases.
- Worker leases have a fencing owner. An expired lease can be reclaimed; an older worker cannot overwrite the newer worker's result. Repeated lease expiry is terminally failed after ORACLE_MAX_JOB_ATTEMPTS.
- Terminal jobs are pruned after ORACLE_JOB_RETENTION_SECONDS (default 86,400 seconds) and when the configured retained-job ceiling requires it. Queued/running jobs are never pruned. Idempotency replay is guaranteed only while the corresponding job is retained.
- Apply `apps/oracle/migrations/001_oracle_jobs.sql` explicitly before enabling `ORACLE_DATABASE_URL`. It is safe to apply more than once. Application startup never creates or changes the schema. A missing schema keeps readiness false and job reads/writes fail with HTTP 503.
- The ORACLE process connects as the dedicated `oracle_app` login, never as `POSTGRES_USER`. The bootstrap step creates a `NOINHERIT`, non-owner role with no database/schema creation privileges. Migration runs separately under the database migration owner; migration 001 grants the app role only `USAGE` on `oracle` and `SELECT/INSERT/UPDATE/DELETE` on `oracle.jobs`, plus matching default table privileges for future ORACLE-owned tables. The app role receives no grants on ARSY/public tables. Production must provision the equivalent role through the managed secret/migration process; the Compose bootstrap is development/CI only.
- Bounded submitted input is stored in PostgreSQL so work can resume after a process restart. Treat database access and backups as sensitive; the 24-hour default retention is not a substitute for the deployment's required storage encryption, access control, and backup-retention policy.
- ORACLE stores computation job lifecycle only. ARSY remains caller identity, policy, authorization and orchestration authority; WITNESS FABRIC remains evidence/provenance authority. The ORACLE schema is not canonical audit or source-evidence storage.

## Docker Compose development setup

Because Compose enables PostgreSQL-backed jobs by default, apply the ORACLE schema before starting ORACLE/ARSY. The CI workflow uses the same explicit ordering:

```bash
docker compose --env-file .env.docker -f docker-compose.yml up -d --wait postgres oracle-db-bootstrap
docker compose --env-file .env.docker -f docker-compose.yml exec -T postgres \
  sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < apps/oracle/migrations/001_oracle_jobs.sql
docker compose --env-file .env.docker -f docker-compose.yml up -d --build --wait redis oracle arsy
```

Do not apply this development credential pattern to production. Provision a dedicated restricted database role and apply the migration through the production migration/change-control process.
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

## ARSY integration

The Docker Compose development stack runs ORACLE as a private service at `http://oracle:8010` on the existing `moonwitness` bridge network. ORACLE has no published host port. Its readiness endpoint is used by Compose before ARSY starts.

ARSY exposes the caller-facing integration routes:

- `POST /api/v1/oracle/jobs` — validated job submission; accepts an optional `Idempotency-Key`.
- `GET /api/v1/oracle/jobs/{job_id}` — job status, result, and provenance.

Both routes are protected by ARSY's existing operator authentication boundary. ARSY forwards only validated contracts to ORACLE and holds a separate `ORACLE_SERVICE_TOKEN` for the private bearer-authenticated upstream call. The ORACLE service credential must not be reused as `ARSY_OPERATOR_TOKEN`.

The Compose example uses `ORACLE_BASE_URL=http://oracle:8010`, `ORACLE_SERVICE_TOKEN`, and `ORACLE_REQUEST_TIMEOUT_MS`. ORACLE's database URL is built from the separate `oracle_app` login and `ORACLE_DB_PASSWORD`; it does not receive `POSTGRES_USER` or `POSTGRES_PASSWORD`. The sample token in `.env.docker` is for local development only; replace it before any shared or non-local environment. Do not expose ORACLE through public ingress or a host-published port.

The repository's `ORACLE Compose E2E` workflow starts PostgreSQL, Redis, ORACLE, and ARSY as real containers, applies the ORACLE migration explicitly, submits both supported analysis tasks through ARSY, checks computed results and provenance, verifies idempotency replay, restarts ORACLE, and confirms the original job/result/idempotency key survive. It uses ephemeral CI credentials and removes the isolated Compose volumes after the run. This verifies the durable development/test path; it does not prove production readiness.

## Stage 2 and production safety boundaries

- In-memory jobs are intentionally ephemeral when no database URL is configured. The Compose/shared path is PostgreSQL-backed and survives ORACLE process restarts.
- The queue, worker count, retained-job count, attempt count, lease duration, retention window, numeric input size, and text size are bounded. Queue saturation and unavailable durable storage return HTTP 503 with Retry-After.
- The ORACLE job store uses PostgreSQL only. Redis/BullMQ, NATS, model providers, GPUs, RDF stores and vector databases are not part of this implementation.
- ORACLE_ENV=production remains rejected at startup. A durable queue is only one prerequisite; managed least-privilege credentials, backups/restore, observability/alerting, private network policy, deployment ownership and tested rollback still require independent implementation and verification.
- Caller authentication and authorization belong to ARSY. A configured ORACLE bearer token is only a service-to-service boundary, not a replacement for user authorization.
- No source text or numeric input values are written to application logs. Result payloads remain accessible to the trusted internal caller through the job API.
- A SHA-256 digest is a reproducible fingerprint only. Evidence authenticity, signatures, trusted timestamps, retention, and canonical audit storage remain outside ORACLE.

This project is a first implementation foundation, not a production-ready intelligence platform.
