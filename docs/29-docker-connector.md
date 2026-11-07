# Docker Connector

Status: initial read-only connector implementation; not a production deployment manager.

## Architecture

- ARSY owns Docker Engine connections and is the only process allowed to access the Docker socket or remote TLS credentials.
- Headquarter calls authenticated same-origin Next.js routes. Those routes verify the signed operator session and forward a server-side ARSY operator token.
- PostgreSQL stores owner-scoped connection metadata and append-only connection audit events.
- The initial UI exposes engine metadata, a bounded (100 item) container inventory, and a bounded read-only log tail (200 lines, 1 MiB response cap). Start, stop, exec, image pull, Compose deploy, domains, TLS ingress management, metrics and rollback are intentionally not exposed.
- Local Docker uses the server-configured Unix socket. Remote Docker uses HTTPS with mutual TLS, an exact hostname allowlist and certificate verification. A custom remote agent is deferred.

## Required environment

- `ARSY_OPERATOR_ID`: stable single-operator identity.
- `ARSY_OPERATOR_TOKEN`: high-entropy server-to-server credential shared by ARSY and Headquarter.
- `HEADQUARTER_OPERATOR_PASSWORD`: operator login password (at least 16 characters).
- `HEADQUARTER_SESSION_SECRET`: random secret with at least 32 UTF-8 bytes.
- `HEADQUARTER_PUBLIC_ORIGIN`: exact browser origin; HTTPS is mandatory when `NODE_ENV=production`.
- `ARSY_API_BASE_URL`: private ARSY origin reachable only from Headquarter.
- `DOCKER_CREDENTIALS_ENCRYPTION_KEY`: base64 encoding of exactly 32 random bytes. Rotate only with a credential re-encryption procedure.
- `DOCKER_REMOTE_ALLOWED_HOSTS`: comma-separated exact hostnames approved for remote Docker TLS.
- Optional `DOCKER_LOCAL_SOCKET_PATH`: only `/var/run/docker.sock` or `/run/docker.sock`.

Generate secrets with a trusted secret manager or, for local development, `openssl rand -base64 32`. Never commit generated values. The login route's built-in failed-attempt throttle is process-local; production ingress must also enforce a shared rate limit before scaling Headquarter across multiple replicas.

## Database migration

Apply `apps/arsy/migrations/002_docker_connector.sql` to the target PostgreSQL database through the deployment/System Mode migration process. It is safe to reapply. Application startup deliberately does not mutate schema.


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

Remote endpoints must use HTTPS, present a trusted CA and client certificate/key, and have a hostname listed exactly in `DOCKER_REMOTE_ALLOWED_HOSTS`. Plain HTTP, URL credentials, IP literals, local hostnames and arbitrary URL paths are rejected. TLS private material is encrypted at rest using AES-256-GCM and is never returned in API responses.

## API surface

All routes require the authenticated operator token:

- `GET /api/v1/infrastructure/docker/servers`
- `POST /api/v1/infrastructure/docker/servers` with either `{ "name": "...", "kind": "local" }` or `{ "name": "...", "kind": "remote", "endpointUrl": "https://...", "tls": { "ca": "...", "cert": "...", "key": "..." } }`
- `GET /api/v1/infrastructure/docker/servers/:id/info`
- `GET /api/v1/infrastructure/docker/servers/:id/containers`
- `GET /api/v1/infrastructure/docker/servers/:id/containers/:containerId/logs` (last 200 lines; stdout/stderr framing decoded; 1 MiB response cap)

Headquarter exposes these through its session-protected `/api/infrastructure/docker/...` routes. Container logs can contain application secrets or personal data; access them only as an authorized operator, and do not copy them into tickets or shared channels without review. The connector does not persist log contents.

## Verification

- `apps/arsy/tests/docker-connector.test.mjs` exercises TLS endpoint validation, credential encryption, Unix-socket HTTP integration, bounded inventory and log decoding, remote mutual-TLS handshakes, and fail-closed API authentication.
- `apps/arsy/tests/docker-postgres.integration.test.mjs` runs the migration twice, verifies owner scoping and immutable audit records, then exercises the real ARSY API against both a disposable PostgreSQL database and the runner's Docker Engine. The same workflow runs an ephemeral-certificate mutual-TLS handshake test, including rejection without a client certificate.
- A real Docker Engine smoke test is still required in a controlled environment before enabling the socket or approving production use.
