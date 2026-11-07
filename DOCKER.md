# Docker for MOONWITNESS

## Scope

The committed Docker Compose file is a **local host stack** for validating the built ARSY and Headquarter images with PostgreSQL and Redis. It is not a production deployment target: it does not provide TLS ingress, managed secrets, managed data services, backup/restore, deployment orchestration, rollback, or a public production URL.

The application images use their production start commands. Compose publishes ports on loopback only and requires an explicit PostgreSQL password.

## Prerequisites

- Docker Engine or Docker Desktop with Compose v2
- Node.js/pnpm are not required on the host when using the prebuilt images

## Start the local stack

Create an ignored local environment file and set a unique password:

```bash
cp .env.docker .env
printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -base64 32)" >> .env
docker compose up -d --build
```

Compose will fail closed if `POSTGRES_PASSWORD` is missing. Do not reuse the example value for any shared environment.

## Local endpoints

- Headquarter: http://127.0.0.1:3000
- ARSY: http://127.0.0.1:3001
- PostgreSQL: 127.0.0.1:5432
- Redis: 127.0.0.1:6379

The database and Redis ports are bound to loopback and are not published to other network interfaces by default.

## Useful commands

```bash
docker compose ps
docker compose logs -f arsy headquarter
docker compose logs -f postgres redis
docker compose down
```

To remove local database and Redis data as well:

```bash
docker compose down -v
```

**Warning:** `down -v` permanently deletes the local named volumes.

## Image build verification

CI validates Compose interpolation using an ephemeral CI-only password, then builds both images from the repository root:

- `Dockerfile.arsy`
- `Dockerfile.headquarter`

A successful image build is not evidence of a production deployment or a live external integration.

## Production requirements

A production launch still requires an explicitly selected hosting target, TLS/reverse-proxy ingress, production secret management, private data-service networking, durable managed storage, tested backup/restore, migration and rollback procedures, deployment automation, production health checks, and smoke tests. Do not expose this local Compose profile directly to the public internet.
