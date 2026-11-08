# ORACLE — Python Intelligence Service

**Stage:** Stage 1 computation + Stage 2 durable-job candidate · **Status:** implementation candidate; final Compose E2E/quality gates pending; production remains blocked

ORACLE is the MOONWITNESS Python service for bounded computation and research-oriented analysis. It provides a versioned internal API, deterministic statistical/text profiling tasks, and digest-based derivation metadata. With `ORACLE_DATABASE_URL` configured, Stage 2 stores the job lifecycle and idempotency state in PostgreSQL and uses database leases for worker recovery. Without that URL, loopback development/test mode retains the bounded in-memory coordinator.

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
- \`GET /health/ready\` — worker/readiness, queue capacity, database availability, and whether the active job backend is durable.
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

## ARSY integration

The Docker Compose development stack runs ORACLE as a private service at `http://oracle:8010` on the existing `moonwitness` bridge network. ORACLE has no published host port. PostgreSQL provisions separate `oracle_app` and `oracle_migrator` roles, and a one-shot `oracle-migrate` service applies checksum-verified SQL migrations before ORACLE starts. Both roles are non-superuser, non-database-creating and non-role-creating; only the migrator can create objects in the dedicated `oracle` schema. The runtime role has no access to the public schema or migration history and receives DML only on `oracle.jobs`. The migration runner reapplies this exact permission set on every start, including after role bootstrap on an existing volume. Compose readiness waits for the durable store and worker pool.

ARSY exposes the caller-facing integration routes:

- `POST /api/v1/oracle/jobs` — validated job submission; accepts an optional `Idempotency-Key`.
- `GET /api/v1/oracle/jobs/{job_id}` — job status, result, and provenance.

Both routes are protected by ARSY's existing operator authentication boundary. ARSY forwards only validated contracts to ORACLE and holds a separate `ORACLE_SERVICE_TOKEN` for the private bearer-authenticated upstream call. The ORACLE service credential must not be reused as `ARSY_OPERATOR_TOKEN`.

The Compose example uses `ORACLE_BASE_URL=http://oracle:8010`, `ORACLE_SERVICE_TOKEN`, and `ORACLE_REQUEST_TIMEOUT_MS`. The sample token in `.env.docker` is for local development only; replace it before any shared or non-local environment. Do not expose ORACLE through public ingress or a host-published port.

The repository's `ORACLE Compose E2E` workflow starts PostgreSQL, Redis, the explicit ORACLE migration step, ORACLE, and ARSY as real containers. It submits both supported analysis tasks through ARSY, checks computed results and provenance, restarts ORACLE, then verifies the existing result and idempotency replay survive that restart. It uses ephemeral CI credentials and removes isolated Compose volumes after the run.

## Design and research rationale

- PostgreSQL 16 documents `FOR UPDATE SKIP LOCKED` as suitable for queue-like tables with multiple consumers, while explicitly warning that skipped rows make the view inconsistent for general-purpose queries. ORACLE uses it narrowly to atomically claim one queued or expired lease row inside a transaction; normal job reads do not use it. ([PostgreSQL 16 SELECT](https://www.postgresql.org/docs/16/sql-select.html))
- PostgreSQL role membership is more than the `NOINHERIT` flag: membership can still enable `SET ROLE`. The bootstrap therefore sets non-privileged attributes and revokes existing role memberships from the ORACLE login roles. ([PostgreSQL 16 CREATE ROLE](https://www.postgresql.org/docs/16/sql-createrole.html), [Role membership](https://www.postgresql.org/docs/current/role-membership.html))
- `asyncpg` is designed for PostgreSQL with Python `asyncio`; its official guidance recommends connection pooling for server applications that frequently borrow short-lived database connections. ORACLE keeps the pool bounded and the persistence layer behind its coordinator boundary. ([asyncpg usage](https://magicstack.github.io/asyncpg/current/usage.html), [asyncpg pool API](https://magicstack.github.io/asyncpg/current/api/index.html#connection-pools))

## Stage 2 durable job behavior and operational limitations

- `ORACLE_DATABASE_URL` selects the PostgreSQL coordinator. In Compose, the application connects only as the least-privilege `oracle_app` role; the one-shot migration service connects as `oracle_migrator`. Neither role is a superuser or can create databases/roles. Direct privileges on `public` objects are revoked, the runtime search path is restricted to `oracle`, and the application role receives no access to ARSY-owned public tables. The migrator can create objects only in the dedicated `oracle` schema; the runtime role can read/write only `oracle.jobs`.
- `python -m oracle.migrate` applies ordered SQL migrations and records SHA-256 checksums. It must run as the migration role; application startup never mutates schema. Reapplying unchanged migrations is a no-op, while changing an applied checksum fails closed. Each invocation reapplies runtime permissions so repeatable bootstrap on existing volumes leaves access limited to the jobs table.
- PostgreSQL submission uses a transaction-scoped advisory lock, a unique partial idempotency index and a retained-job/queue ceiling. Same-key/same-payload replay returns the original job; same-key/different-payload returns `409`.
- Workers claim queued or expired-running jobs with `FOR UPDATE SKIP LOCKED`, a finite lease and a per-claim UUID fencing token. Heartbeats renew leases; completion/failure requires the current unexpired token, so a stale worker cannot overwrite a reclaimed job. Expired work is retried up to `ORACLE_JOB_MAX_ATTEMPTS`.
- Compose defaults: two workers, 100 queued jobs, 1,000 retained jobs, 60-second leases, three attempts and seven-day terminal retention. Only terminal rows past retention are pruned; queued/running work is never pruned. Idempotency replay lasts only while the associated job row is retained.
- If durable storage or its migration is unavailable, readiness returns `503` and job submission/status reads return `503`. A configured durable backend never falls back to in-memory state. The bounded in-memory coordinator remains available only for isolated loopback development/test when `ORACLE_DATABASE_URL` is absent.
- `ORACLE_ENV=production` remains intentionally rejected. Durable persistence is necessary but not sufficient for production: production monitoring/alerting, managed secrets/rotation, network policy, backup/restore drills, retention review, deployment ownership and rollback validation remain separate release gates.
This project is a first implementation foundation, not a production-ready intelligence platform.
