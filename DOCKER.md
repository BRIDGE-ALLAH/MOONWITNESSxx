# Docker & Docker Compose — MOONWITNESS

> **Development only.** The default Compose stack runs ARSY and Headquarter in development mode, mounts source directories, and enables hot reload. It is not a production deployment definition. The committed `.env.docker` contains deliberately public local-only credentials and binds published ports to loopback; never expose it to a network or reuse those values in another environment.

## Prerequisites

- Docker Desktop or Docker Engine with Docker Compose v2
- Node.js 22.9+ and pnpm 12+ for host-run development
- Ports 3000 (Headquarter), 3001 (ARSY), 5432 (PostgreSQL), and 6379 (Redis) available
- At least 4 GB of free disk space for images and volumes

## Start the local stack

Run from the repository root:

```bash
# Validate environment interpolation before starting containers.
docker compose --env-file .env.docker config --quiet

# Build the images and start Headquarter, ARSY, PostgreSQL, and Redis.
docker compose --env-file .env.docker up --build -d

# Inspect service status and follow logs.
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f
```

The committed `.env.docker` is a convenience fixture for an isolated local machine. Its operator password is `local-dev-only-change-me`; the API token, session secret, and database password are also public placeholders. Replace them before sharing the machine or exposing any service, even on a private network. Do not commit replacement values.

For your own local environment, copy `.env.example` to an untracked root `.env`, set a unique database password, operator token, operator password, and session secret, then run Compose with `--env-file .env`. Keep `HEADQUARTER_PUBLIC_ORIGIN` equal to the exact browser origin. Compose sets the container's `DATABASE_URL` from `POSTGRES_*`; for host-run ARSY or migrations, set `DATABASE_URL` to the corresponding host PostgreSQL connection string. The Compose service URL is `ARSY_API_BASE_URL=http://arsy:3001`; when Headquarter runs directly on the host, use `http://127.0.0.1:3001`.

## Local endpoints

| Service | Host endpoint | Details |
|---|---|---|
| Headquarter | http://localhost:3000 | Next.js development server |
| ARSY | http://localhost:3001 | Fastify API |
| PostgreSQL | 127.0.0.1:5432 | Database `moonwitness`; credentials from env file |
| Redis | 127.0.0.1:6379 | Development support service |

All published host ports bind to loopback. Container-to-container requests use the private Compose bridge network. ARSY exposes `/health/live` for liveness and `/health/ready` for PostgreSQL readiness. A healthy readiness endpoint confirms database connectivity only; it does not prove every product workflow or external integration is complete.

The Compose PostgreSQL major version is 17, matching the isolated PostgreSQL integration workflow. Data is stored in the `postgres_data`, `redis_data`, and `arsy_assets` named volumes.

## Apply database migrations

Start the local stack first, then run the explicit migration command:

```bash
docker compose --env-file .env.docker exec arsy pnpm migrate:up
```

The application does not mutate the database schema on startup. The migration runner tracks numbered migrations and checksums. Apply migrations to an isolated development or staging database first; back up and verify restore before any production migration.

## Useful commands

```bash
docker compose --env-file .env.docker logs -f arsy
docker compose --env-file .env.docker logs -f headquarter
docker compose --env-file .env.docker logs -f postgres
docker compose --env-file .env.docker exec arsy sh
docker compose --env-file .env.docker exec headquarter sh
docker compose --env-file .env.docker exec postgres psql -U postgres -d moonwitness
docker compose --env-file .env.docker down
```

**Destructive operation:** `docker compose --env-file .env.docker down --volumes` deletes the PostgreSQL, Redis, and ARSY asset volumes, including local data. Run it only when you intentionally want to discard all local state.

## Host-run ARSY development

For development without the application containers, copy `.env.example` to `.env`, set `DATABASE_URL` to a reachable PostgreSQL instance and configure an operator ID/token. Then run:

```bash
pnpm install --frozen-lockfile
pnpm dev:arsy
```

The ARSY development script loads the optional repository-root `.env` file. Existing process environment values take precedence. The runtime reads `HOST` and `PORT`; `ARSY_PORT` is only the Compose host-port mapping variable.

## What the container CI proves

The container workflow checks Compose environment interpolation and builds the ARSY and Headquarter production images. It does **not** start those images, run migrations against a live container stack, execute browser E2E, or deploy to a production target. A successful image build is not a runtime or production-readiness result.

## Production deployment is not configured

Do not deploy the default Compose file or `.env.docker` to production. The repository does not currently provide a verified production deployment target/profile. Production still requires, at minimum:

- a target-specific runtime definition without source mounts or development commands;
- managed secrets, unique operator credentials, HTTPS/TLS termination, trusted ingress, and private data-service networking;
- a shared login-attempt limiter before scaling beyond one Headquarter process;
- tested PostgreSQL and asset-volume backup/restore procedures;
- monitoring, alerting, and operational ownership;
- a documented rollback procedure;
- container runtime verification against PostgreSQL; and
- target-specific live health and critical-workflow smoke tests.

The asset adapter currently uses a single-node filesystem volume. Do not run multiple ARSY replicas with independent local asset volumes. See [docs/29-money-maker-runtime-setup.md](./docs/29-money-maker-runtime-setup.md) for the current Money Maker runtime boundary.

## Related documentation

- [README.md](./README.md) — repository overview and engineering commands
- [docs/08-technical-architecture.md](./docs/08-technical-architecture.md) — technical architecture
- [docs/24-repository-and-automation-governance.md](./docs/24-repository-and-automation-governance.md) — repository and automation governance
- [docs/29-money-maker-runtime-setup.md](./docs/29-money-maker-runtime-setup.md) — ARSY and Money Maker runtime setup
- [SECURITY.md](./SECURITY.md) — vulnerability reporting and security policy
