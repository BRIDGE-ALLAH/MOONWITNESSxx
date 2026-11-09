# Docker & Docker Compose Setup for MOONWITNESS/RIOTWORKS

> **Local-development configuration:** the default Compose stack and .env.docker are for local development only. .env.docker contains a deliberately local placeholder credential; never use it as a production secret. The PostgreSQL and Redis host ports bind to loopback. Production deployment still requires a separately managed secret, TLS/ingress, backups, monitoring, rollback, and a configured deployment target.

## Quick Start

### Prerequisites

- Docker Desktop (or Docker + Docker Compose separately)
- 4GB+ free disk space for images and volumes
- Ports 3000 (Headquarter), 3001 (ARSY), 3102 (AEGIS), 5432 (PostgreSQL), 6379 (Redis) available

### Start services

```bash
# Start all services (Headquarter, ARSY, AEGIS, ORACLE, PostgreSQL, Redis)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers while preserving named PostgreSQL and Redis data volumes
docker compose down
```

### Environment variables

Copy `.env.docker` to `.env` and adjust as needed:

```bash
cp .env.docker .env
```

Key variables:

- `NODE_ENV` — development or production
- `POSTGRES_PASSWORD` — PostgreSQL password (default: postgres)
- `ARSY_PORT` — ARSY backend port (default: 3001)
- `HEADQUARTER_PORT` — Headquarter frontend port (default: 3000)
- `NEXT_PUBLIC_ARSY_URL` — Frontend URL for backend API (default: http://localhost:3001)

### Access services

- **Headquarter frontend**: http://localhost:3000
- **ARSY backend**: http://localhost:3001
- **PostgreSQL**: localhost:5432 (user: postgres, password: postgres)
- **Redis**: localhost:6379

ARSY always listens on the fixed internal container port 3001. `ARSY_PORT` changes only the host-side published port and must not change the port used by its healthcheck or container-to-container requests. Headquarter likewise listens on fixed internal port 3000; `HEADQUARTER_PORT` changes only its host-side published port. ARSY liveness is `/health/live`; readiness at `/health/ready` checks PostgreSQL before Compose marks the service healthy.

## Service descriptions

### PostgreSQL

- Image: `postgres:16-alpine`
- Database: `moonwitness` (configurable)
- Data persists in `postgres_data` volume
- Healthcheck enabled

### Redis

- Image: `redis:7-alpine`
- Used by BullMQ for job queues and caching
- Data persists in `redis_data` volume
- Healthcheck enabled

### ARSY (Backend)

- Built from `Dockerfile.arsy`
- Fastify HTTP API running on port 3001
- Depends on PostgreSQL and Redis
- Mounts local source for development hot-reload
- Healthcheck enabled

### Headquarter (Frontend)

- Built from `Dockerfile.headquarter`
- Next.js application running on port 3000
- Depends on ARSY backend
- Mounts local source for development hot-reload
- Configured with `NEXT_PUBLIC_ARSY_URL` for API communication

## Development workflow

### Local changes

Edit files in `apps/headquarter`, `apps/arsy`, or `packages/`. Changes are immediately reflected in running containers (thanks to volume mounts).

### Rebuild services

After changing package.json or dependencies:

```bash
docker-compose up --build
```

### View service logs

```bash
docker-compose logs -f arsy
docker-compose logs -f headquarter
docker-compose logs -f aegis
docker-compose logs -f postgres
```

### Access container shell

```bash
docker-compose exec arsy sh
docker-compose exec headquarter sh
docker-compose exec postgres psql -U postgres -d moonwitness
```

## Production considerations

For production deployments:

1. **Security**:
   - Set strong `POSTGRES_PASSWORD`
   - Use secrets management (e.g., Docker secrets, Kubernetes)
   - Never commit `.env` files with real secrets

2. **Performance**:
   - Use multi-stage builds (already in Dockerfiles)
   - Disable hot-reload mounts in production
   - Use PostgreSQL replicas and Redis Sentinel/Cluster

3. **Monitoring**:
   - Add health check endpoints to ARSY
   - Configure centralized logging (ELK, Datadog, etc.)
   - Set up alerts for service failures

4. **Scaling**:
   - Use Docker Swarm or Kubernetes for orchestration
   - Implement load balancing (Nginx, HAProxy)
   - Separate read/write database replicas

## Troubleshooting

### Services won't start

```bash
docker-compose logs -f
```

### Port already in use

Change ports in `.env` or stop conflicting containers:

```bash
docker ps
docker stop <container-id>
```

### Database connection errors

Verify PostgreSQL is healthy:

```bash
docker-compose exec postgres pg_isready
```

### Troubleshoot an unhealthy ARSY container

The development Compose stack bind-mounts `apps/arsy`, `apps/headquarter`, and `packages` over directories from the image. Those mounts hide pnpm's package-local `node_modules` links unless nested anonymous dependency volumes are retained. The Compose file keeps those nested dependency volumes for ARSY, Headquarter, and their shared packages.

Inspect the actual startup failure before rebuilding:

```bash
docker compose logs --tail=200 --no-color arsy
docker inspect --format '{{json .State.Health}}' moonwitness-arsy
docker compose ps -a
```

After a dependency-volume or image change, recreate only the application services and renew their anonymous dependency volumes. The named PostgreSQL and Redis data volumes remain attached:

```bash
docker compose config --quiet
docker compose up --build --force-recreate --renew-anon-volumes -d arsy headquarter
docker compose ps
docker compose logs --tail=100 --no-color arsy
```

Do not use `docker compose down -v` or `docker system prune --volumes` as a startup troubleshooting shortcut; they can delete persistent database data. If ARSY remains unhealthy, use its startup log and health history to identify the next failure rather than resetting data.

## File structure

```
.
├── docker-compose.yml          # Service orchestration
├── Dockerfile.arsy             # ARSY backend image
├── Dockerfile.headquarter      # Headquarter frontend image
├── .env.docker                 # Docker environment template
├── apps/
│   ├── arsy/                   # Backend source
│   └── headquarter/            # Frontend source
├── packages/                   # Shared packages
└── pnpm-workspace.yaml         # pnpm workspace config
```

## Related documentation

- [docs/08-technical-architecture.md](../docs/08-technical-architecture.md) — Backend/ORM architecture
- [docs/24-repository-and-automation-governance.md](../docs/24-repository-and-automation-governance.md) — Git/CI setup
- [README.md](../README.md) — Project overview

### AEGIS (Network Runtime Foundation)

- Built from `apps/aegis/Dockerfile` using a multi-stage Go build and a non-root distroless runtime.
- Exposes only `/health/live` and `/health/ready` in this phase; host publishing is loopback-only on port 3102.
- Runs read-only, drops all Linux capabilities, and enables `no-new-privileges`.
- Does not yet execute WireGuard, RouterOS, firewall, routing, DNS, provisioning, or arbitrary commands. ARSY-to-AEGIS authenticated authorization/protocol integration is not implemented.

## Production container delivery (partial)

The ARSY and Headquarter Dockerfiles are production-runtime images, not the local development containers:

- Multi-stage build: the build stage installs the pinned workspace graph, type-checks/builds the selected app, and uses `pnpm deploy --prod` to create a portable production dependency tree.
- Runtime stage copies only that deployed package graph and application build output, runs as the unprivileged `node` user, sets `NODE_ENV=production`, and defines an HTTP healthcheck.
- The root `.dockerignore` keeps Git metadata, local `.env*`, node_modules, generated output, private keys and local certificates out of root-context builds.

### Build and publish policy

`.github/workflows/container-release.yml` is deliberately separate from pull-request CI:

- A manual run is accepted only from `main`; a version-tag run is accepted only for `v*` tags.
- It publishes commit-addressed `sha-<commit>` candidates to GHCR. It never writes a floating `latest` tag.
- BuildKit emits an SBOM and max-mode provenance; Trivy blocks high/critical vulnerabilities with fixes available; the GitHub artifact attestation is attached to the pushed digest.
- A semantic-version alias is created from the same immutable digest only after the image scan passes.
- No production deployment, host mutation, DNS change, registry permission change, or secret provisioning is performed by this workflow.

The current publish matrix includes **ARSY, Headquarter and AEGIS only**. It intentionally does not claim a complete application stack: ORACLE does not yet have a committed Python dependency lock, and ATLAS's Cargo.lock is currently generated as a CI artifact rather than committed source. Those runtime images must be made lockfile-backed and separately verified before being added to the production delivery matrix. AEGIS is currently a health/control-plane foundation; its integration with ARSY is a separate acceptance gate.

### How to publish a candidate

From the GitHub Actions tab, select **Production container delivery** and run it against `main`. The workflow produces the candidate image under its commit SHA. For a version tag, the workflow also creates a version alias after scanning. Use the immutable digest in deployment records; do not deploy a moving tag.

The GHCR packages are published with the repository's GitHub Actions token. Registry visibility and pull credentials still need to be configured for the intended deployment environment. The workflow is an artifact pipeline, not a production deployment pipeline.

**Production remains NO-GO** until ORACLE/ATLAS image contracts, least-privilege database credentials, ingress/TLS and trusted-proxy signing, production secrets, private networking, backup/restore, monitoring, rollback, and a real target smoke test are verified. The default Compose stack below remains local-development-only.

## Docker Connector

See [docs/29-docker-connector.md](docs/29-docker-connector.md) for the read-only Docker Engine connector, operator authentication requirements, remote mutual-TLS allowlist, database migration, and the explicit local-socket security boundary. The host Docker socket is intentionally not mounted into ARSY by default.

