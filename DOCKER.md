# Docker & Docker Compose Setup for MOONWITNESS

> **Local-development configuration:** the default Compose stack and `.env.docker` are for local development only. The placeholder database credential must never be used in production. PostgreSQL, Redis, ARSY, Headquarter and AEGIS host ports bind to loopback. Production requires separately managed secrets, TLS/ingress, backups, monitoring, rollback, and a verified deployment target.

## Quick start

Prerequisites: Docker Engine with Compose v2, and 4GB+ free disk space.

```sh
cp .env.docker .env
docker compose up --build -d
docker compose ps
docker compose logs -f aegis
docker compose down
```

Do not use `docker compose down -v` unless you intentionally want to delete local database/cache volumes.

## Local endpoints

- Headquarter: http://localhost:3000
- ARSY: http://localhost:3001
- AEGIS: http://localhost:3102 (process health only)
- PostgreSQL: localhost:5432
- Redis: localhost:6379

All published host ports bind to loopback.

## Services

### PostgreSQL and Redis

Local persistence and queue/cache infrastructure. Their named volumes persist across ordinary `docker compose down`.

### ARSY

The Fastify backend and sole control-plane authority. It owns identity, policy, orchestration and canonical audit. Compose readiness uses `/health/ready`.

### Headquarter

The Next.js operator experience. It calls ARSY and does not call AEGIS directly.

### AEGIS

A standalone Go network infrastructure runtime. Phase 1 includes only process health endpoints and graceful shutdown; it has no network-device credentials, privileged container mode, host-network access, VPN provisioning, or router/firewall mutation endpoints.

- Internal container port: 3102
- Local host port: `AEGIS_PORT` (default 3102), bound to `127.0.0.1`
- Health: `/health/live` and `/health/ready`
- Network: existing `moonwitness` bridge
- Image: multi-stage Go build with a distroless non-root runtime

## Development workflow

Edit files in `apps/headquarter`, `apps/arsy`, `apps/aegis`, or `packages/`.

```sh
docker compose up --build aegis
docker compose logs -f aegis
cd apps/aegis && go test ./...
```

After changing AEGIS source or its Dockerfile, rebuild its image with `docker compose up --build aegis`.

The ARSY and Headquarter source bind mounts retain nested anonymous `node_modules` volumes. These are intentional: source mounts otherwise hide the pnpm package-local dependency links baked into the image.

## Production warning

The checked-in Compose file is a local development profile, not a production deployment. Do not expose AEGIS publicly or enable network mutations until service-to-service authentication, authorization, secret injection, network segmentation, least-privilege provider adapters, audit integration, rollback, monitoring, backup/recovery and production smoke tests are complete.

See [docs/29 — AEGIS blueprint](./docs/29-aegis-network-infrastructure-blueprint.md).
