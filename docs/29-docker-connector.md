# Docker Connector

Status: initial read-only connector implementation; not a production deployment manager.

## Architecture

- ARSY owns Docker Engine connections and is the only process allowed to access the Docker socket or remote TLS credentials.
- Headquarter calls authenticated same-origin Next.js routes. Those routes verify the signed operator session and forward a server-side ARSY operator token.
- PostgreSQL stores owner-scoped connection metadata and append-only connection audit events.
- The initial UI exposes engine metadata, a bounded (100 item) container inventory, a bounded read-only log tail (200 lines, 1 MiB response cap), and one-shot container runtime telemetry. Start, stop, exec, image pull, Compose deploy, domains, TLS ingress management, historical metrics, alerting and rollback are intentionally not exposed.
- Local Docker uses the server-configured Unix socket. Remote Docker uses HTTPS with mutual TLS, an exact hostname allowlist and certificate verification. A custom remote agent is deferred.

## Required environment

- `ARSY_OPERATOR_ID`: stable single-operator identity.
- `ARSY_OPERATOR_TOKEN`: high-entropy server-to-server credential shared by ARSY and Headquarter.
- `HEADQUARTER_OPERATOR_PASSWORD`: operator login password (at least 16 characters).
- `HEADQUARTER_SESSION_SECRET`: random secret with at least 32 UTF-8 bytes.
- `HEADQUARTER_PUBLIC_ORIGIN`: exact browser origin; HTTPS is mandatory when `NODE_ENV=production`.
- `HEADQUARTER_TRUSTED_PROXY_HOPS=1`: production requires exactly one trusted ingress hop.
- `HEADQUARTER_TRUSTED_PROXY_SECRET`: at least 32 random bytes used by ingress to sign the canonical client IP.
- `ARSY_API_BASE_URL`: private ARSY origin reachable only from Headquarter.
- `DOCKER_CREDENTIALS_ENCRYPTION_KEY`: base64 encoding of exactly 32 random bytes. Rotate only with a credential re-encryption procedure.
- `DOCKER_REMOTE_ALLOWED_HOSTS`: comma-separated exact hostnames approved for remote Docker TLS.
- `DOCKER_REMOTE_ALLOW_PRIVATE_NETWORKS=1`: opt-in only for a trusted deployment whose allowlisted Docker host resolves to RFC1918/ULA addresses. Loopback, link-local, multicast, reserved and documentation ranges remain blocked.
- Optional `DOCKER_LOCAL_SOCKET_PATH`: only `/var/run/docker.sock` or `/run/docker.sock`.

Generate secrets with a trusted secret manager or, for local development, `openssl rand -base64 32`. Never commit generated values. Headquarter now reserves login attempts against ARSY's PostgreSQL-backed account and network buckets before password verification. Up to five attempts in a rolling 15-minute bucket are permitted; the sixth and subsequent attempts are rejected with HTTP 429 and `Retry-After`; a successful login clears the account bucket and the caller's current network bucket. The ARSY API derives the owner from the authenticated service principal, never from a caller-supplied account ID. The local process-only fallback remains available only outside production when shared ARSY configuration is absent; it is not distributed protection and must not be used to justify scaling a production deployment.

Production requires all of the following:

- `ARSY_API_BASE_URL` and a high-entropy `ARSY_OPERATOR_TOKEN` shared only by Headquarter and private ARSY.
- `HEADQUARTER_TRUSTED_PROXY_HOPS=1` for exactly one trusted ingress that terminates client traffic.
- `HEADQUARTER_TRUSTED_PROXY_SECRET` containing at least 32 random bytes, shared only between that ingress and Headquarter.
- The ingress must remove client-supplied `X-MoonWitness-Client-IP` and `X-MoonWitness-Client-IP-Signature` headers, derive the client IP from its accepted connection, canonicalize it, and set the two headers itself. The signature is lowercase hex HMAC-SHA256 over `moonwitness-client-ip-v1:<canonical-ip>` using `HEADQUARTER_TRUSTED_PROXY_SECRET`.
- Direct public access to Headquarter must be blocked; only the trusted ingress may reach it. Never trust raw `X-Forwarded-For` in this application.

The production login route fails closed with HTTP 503 when the shared ARSY limiter, signed ingress identity, or their configuration is unavailable. The one-hop signed-header contract deliberately avoids trusting arbitrary client-supplied forwarding headers. A deployment behind a multi-proxy chain must normalize the address at its final trusted ingress and sign the resulting single canonical IP; increasing the hop count is not supported by this implementation. The repository does not yet verify a real production ingress configuration, so deployment readiness remains a separate gate.

## Database migration

Apply `apps/arsy/migrations/002_docker_connector.sql` to the target PostgreSQL database through the deployment/System Mode migration process. It is safe to reapply. Application startup deliberately does not mutate schema.

The shared login limiter additionally requires `apps/arsy/migrations/006_shared_login_attempts.sql`, applied after existing migrations 003–005 in numeric order. It is idempotent and creates only owner-scoped rate-limit buckets. Application startup does not auto-apply it.


### Rollback

Back up PostgreSQL before applying the migration. Rollback is destructive to connector registrations and audit history; only run it after explicit operator approval and after confirming no dependent records remain:

```sql
DROP TABLE IF EXISTS docker_connector_audit_events;
DROP TABLE IF EXISTS docker_connector_servers;
DROP FUNCTION IF EXISTS reject_docker_connector_audit_mutation();
```

Do not run this rollback against production merely to disable the UI. Disable access through operator configuration instead.

## Local Docker socket

The Compose stack does **not** mount the host Docker socket by default. This is intentional: access to the Docker socket is effectively host-root access. For a trusted single-operator development host only, configure the operator secrets in `.env.docker` and start with `docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.docker-socket.yml up -d`. The override explicitly mounts the host socket into ARSY; keep ARSY inaccessible from untrusted networks. Do not mount the socket into Headquarter or any browser-facing container.

## Remote Docker

Remote endpoints must use HTTPS, present a trusted CA and client certificate/key, and have a hostname listed exactly in `DOCKER_REMOTE_ALLOWED_HOSTS`. Plain HTTP, URL credentials, IP literals, local hostnames and arbitrary URL paths are rejected. ARSY resolves every A/AAAA answer before connecting, rejects loopback/link-local/reserved answers, blocks private answers by default, and permits RFC1918/ULA only when `DOCKER_REMOTE_ALLOW_PRIVATE_NETWORKS=1` is explicitly configured for a trusted deployment. The HTTPS socket is pinned to one of the validated addresses while hostname-based TLS verification remains enabled, preventing a second DNS lookup from rebinding the connection. Mixed safe/unsafe DNS answers fail closed. TLS private material is encrypted at rest using AES-256-GCM and is never returned in API responses.

## API surface

All routes require the authenticated operator token:

- `GET /api/v1/infrastructure/docker/servers`
- `POST /api/v1/infrastructure/docker/servers` with either `{ "name": "...", "kind": "local" }` or `{ "name": "...", "kind": "remote", "endpointUrl": "https://...", "tls": { "ca": "...", "cert": "...", "key": "..." } }`
- `GET /api/v1/infrastructure/docker/servers/:id/info`
- `GET /api/v1/infrastructure/docker/servers/:id/containers`
- `GET /api/v1/infrastructure/docker/servers/:id/containers/:containerId/logs` (last 200 lines; stdout/stderr framing decoded; 1 MiB response cap)
- `GET /api/v1/infrastructure/docker/servers/:id/containers/:containerId/stats` (one bounded `stream=false&one-shot=true` sample; owner-scoped server lookup; no persistent history)

Headquarter exposes these through its session-protected `/api/infrastructure/docker/...` routes. Container logs can contain application secrets or personal data; access them only as an authorized operator, and do not copy them into tickets or shared channels without review. The connector does not persist log contents.

## Runtime telemetry

The Headquarter Docker page can request a one-shot runtime sample for a selected container and polls again every 10 seconds while that monitor panel is open. It stops polling when the panel is closed or the selected Docker server changes. This is bounded polling, not a streaming connection or an alerting service.

ARSY calls the Docker Engine `GET /containers/{id}/stats?stream=false&one-shot=true` endpoint after validating the server UUID and container ID and resolving the server by both ID and `ARSY_OPERATOR_ID`. It returns only a normalized metric allowlist: engine observation timestamp, CPU percentage, memory working set/limit/percentage, process count, aggregate network RX/TX bytes and block read/write bytes. It never returns the raw Engine stats payload, container environment, mount configuration or TLS credentials. The one-shot Engine response uses the existing 5-second request timeout and 1 MiB response bound. An Engine 404 maps to a container-not-found response; other provider failures are reported as telemetry unavailable.

CPU percentage follows Docker's documented delta formula using current and previous CPU counters and the online CPU count (with per-CPU array fallback). Memory working set subtracts `inactive_file` on cgroup v2 or `cache` on cgroup v1 when that counter is present. Missing counters remain unavailable rather than being invented as zero. See the [Docker Engine API container stats reference](https://docs.docker.com/reference/api/engine/version/v1.56/#get-container-stats-based-on-resource-usage).

Telemetry is read-only and is not persisted as historical metric records. It does not implement deployment readiness, user-defined health checks, drift reconciliation, alert delivery, restart, automatic rollback or service orchestration. Those capabilities remain in the separately owned ARSY deployment roadmap and must not be inferred from this screen.

## Verification

- `apps/arsy/tests/docker-connector.test.mjs` exercises TLS endpoint validation, credential encryption, Unix-socket HTTP integration, bounded inventory and log decoding, cgroup-aware one-shot telemetry calculations, owner-scoped telemetry route validation, remote mutual-TLS handshakes, and fail-closed API authentication.
- `apps/arsy/tests/docker-postgres.integration.test.mjs` runs the migration twice, verifies owner scoping and immutable audit records, then exercises the real ARSY API against both a disposable PostgreSQL database and the runner's Docker Engine. The same workflow runs an ephemeral-certificate mutual-TLS handshake test, including rejection without a client certificate.
- `apps/arsy/tests/login-attempts.test.mjs` covers the authenticated, owner-derived login-attempt API, atomic bucket reservation, bounded retry and safe database failure.
- `apps/arsy/tests/login-throttle-postgres.integration.test.mjs` verifies shared limits across two ARSY instances, concurrent requests, restart persistence, expiry, success reset and owner isolation against disposable PostgreSQL.
- `apps/headquarter/tests/shared-login-limit.test.mjs` covers signed ingress identity, spoofed-header rejection, fail-closed production configuration and the shared limiter client.
- A real Docker Engine smoke test is still required in a controlled environment before enabling the socket or approving production use.
