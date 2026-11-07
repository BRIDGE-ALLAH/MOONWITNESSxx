# Docker & Docker Compose — MOONWITNESS

> **Scope: local development only.** The root `docker-compose.yml` runs the ARSY and Headquarter development servers with source mounts and hot reload. It is not a production deployment definition. The `.env.docker` file contains a local-only placeholder password; never reuse it outside an isolated development machine.

## Prerequisites

- Docker Desktop (or Docker Engine) with Docker Compose v2
- At least 4 GB of free disk space for images and volumes
- Ports 3000, 3001, 5432, and 6379 available on the host

## Start the local stack

Run from the repository root:

```bash
# Validate the Compose configuration before starting containers.
docker compose --env-file .env.docker config --quiet

# Build the two application images and start Headquarter, ARSY, PostgreSQL, and Redis.
docker compose --env-file .env.docker up --build -d

# Inspect status and follow logs.
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f
```

The supplied `.env.docker` is intentionally marked for local development and uses a placeholder `POSTGRES_PASSWORD`. Change it before sharing the machine or exposing any service. Compose requires this variable; there is no implicit production-safe default.

## Local endpoints and data

| Service | Host endpoint | Notes |
|---|---|---|
| Headquarter | http://localhost:3000 | Next.js development server |
| ARSY | http://localhost:3001 | Fastify development server |
| PostgreSQL | 127.0.0.1:5432 | Database `moonwitness`, user `postgres`, password from `.env.docker` |
| Redis | 127.0.0.1:6379 | Development queue/cache service; passwordless local service |

PostgreSQL and Redis host ports, as well as the application ports, bind to loopback in Compose. Other containers communicate over the private Compose bridge network.

ARSY listens on container port 3001 (`HOST=0.0.0.0`). Its liveness endpoint is `/health/live`; `/health/ready` checks PostgreSQL connectivity and is used by the Compose healthcheck. A healthy ARSY container therefore indicates that its database readiness probe succeeded, not that every product workflow is complete.

The Compose configuration maps host port overrides through `ARSY_PORT` and `HEADQUARTER_PORT`. The ARSY process itself reads `HOST` and `PORT`; Compose sets those values inside its container.

## Development behavior

The default Compose services explicitly run `pnpm dev` and mount the application and package source trees. This provides hot reload, but it is not how the production images are started.

The Dockerfiles build application images and use the package `start` scripts. The CI container workflow verifies Compose parsing and image builds; that check is not a substitute for running the images against PostgreSQL, browser E2E, or a live production smoke test.

For non-Compose ARSY development, copy `.env.example` to the repository root as `.env`, update `DATABASE_URL`, then run:

```bash
pnpm dev:arsy
```

The ARSY development command loads the root `.env` when present. Values already provided by the shell or process environment take precedence.

## Useful commands

```bash
# Follow service-specific logs.
docker compose --env-file .env.docker logs -f arsy
docker compose --env-file .env.docker logs -f headquarter
docker compose --env-file .env.docker logs -f postgres

# Open service shells.
docker compose --env-file .env.docker exec arsy sh
docker compose --env-file .env.docker exec headquarter sh
docker compose --env-file .env.docker exec postgres psql -U postgres -d moonwitness

# Stop containers but preserve named data volumes.
docker compose --env-file .env.docker down
```

**Destructive operation:** `docker compose --env-file .env.docker down --volumes` deletes the PostgreSQL and Redis named volumes, including local database contents. Do not run it unless you intentionally want to discard that data.

## Production deployment is not configured here

Do not deploy the development Compose file or `.env.docker` to production. The repository does not currently provide a verified production deployment target or production Compose profile. A production release still requires, at minimum:

- a target-specific runtime definition without source mounts or development commands;
- managed secrets and strong operator credentials;
- HTTPS/TLS termination, trusted ingress, and private data-service networking;
- shared rate limiting for public or multi-replica operator login;
- tested PostgreSQL backup and restore;
- monitoring, alerting, and operational ownership;
- a documented rollback procedure;
- image/container runtime verification against PostgreSQL; and
- target-specific live health and critical-workflow smoke tests.

A successful image build does not prove production readiness.

## Related documentation

- [README.md](./README.md) — repository overview and engineering commands
- [docs/08-technical-architecture.md](./docs/08-technical-architecture.md) — technical architecture
- [docs/24-repository-and-automation-governance.md](./docs/24-repository-and-automation-governance.md) — repository and automation governance
- [SECURITY.md](./SECURITY.md) — vulnerability reporting and security policy
