# Docker & Docker Compose Setup for MOONWITNESS/RIOTWORKS

> **Local-development configuration:** the default Compose stack and .env.docker are for local development only. .env.docker contains a deliberately local placeholder credential; never use it as a production secret. The PostgreSQL and Redis host ports bind to loopback. Production deployment still requires a separately managed secret, TLS/ingress, backups, monitoring, rollback, and a configured deployment target.

## Quick Start

### Prerequisites

- Docker Desktop (or Docker + Docker Compose separately)
- 4GB+ free disk space for images and volumes
- Ports 3000 (Headquarter), 3001 (ARSY), 5432 (PostgreSQL), 6379 (Redis) available

### Start services

```bash
# Start all services (Headquarter, ARSY, PostgreSQL, Redis)
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
