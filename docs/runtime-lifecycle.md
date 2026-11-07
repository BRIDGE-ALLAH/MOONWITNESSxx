# Runtime and Deployment Lifecycle

## Current supported lifecycle

The checked-in Docker Compose stack is a **local development stack**, not a production deployment definition.

```sh
cp .env.example .env   # only when .env does not already exist
pnpm runtime:doctor
pnpm runtime:preflight
docker compose up -d
pnpm runtime:health
pnpm runtime:passport --write
docker compose logs -f
docker compose down
```

Use `docker compose down -v` only when intentionally deleting local database/cache volumes. It is destructive.

## Health semantics

ARSY exposes:
- `GET /`: application response.
- `GET /health/live`: process liveness; does not depend on PostgreSQL.
- `GET /health/ready`: readiness; executes `SELECT 1` against PostgreSQL and returns HTTP 503 when the database is unavailable.

The PostgreSQL pool is closed through Fastify's `onClose` lifecycle hook. SIGINT/SIGTERM call `app.close()`, allowing the server and pool to shut down together.

Compose probes use Node's built-in fetch instead of relying on curl being installed in the Alpine image. Headquarter, ARSY, Redis, and PostgreSQL all expose container health state. Compose startup dependencies wait for healthy dependencies.

## Runtime commands

- `pnpm runtime:doctor`: Docker CLI, Compose plugin, and daemon diagnostics.
- `pnpm runtime:preflight`: validates the Compose configuration and warns about missing/default local secrets. It refuses `NODE_ENV=production` because the current Compose file mounts development source and is not a production deployment profile.
- `pnpm runtime:health`: requires all four Compose services to be running and healthy.
- `pnpm runtime:passport`: emits a machine-readable, read-only environment passport.
- `pnpm runtime:passport --write`: writes `.artifacts/runtime-passport.json`.

The passport records repository commit/dirty state, Node/pnpm versions, OS/architecture, lockfile SHA-256, a digest of the rendered Compose configuration, service health, and environment variable **names only**. It never persists resolved Compose output or environment values.

## Deployment safety boundary

The following are intentionally not automated:
- production deploys or host changes;
- database schema migrations or destructive data operations;
- backup deletion, volume deletion, or database restore;
- traffic shifting and rollback;
- secret generation, rotation, or publication.

A production release must have a separate production Compose/deployment definition, immutable artifact references, explicit secret handling, backup/restore evidence, migration review, and a human-approved recovery plan. An application image rollback does not reverse a database migration or restore external state.

## Recovery procedure (local development)

1. Capture `pnpm runtime:passport` and relevant service logs.
2. Inspect `pnpm runtime:health` and `docker compose ps`.
3. Correct configuration or restart only the affected service.
4. Before any volume reset, export/backup the data and obtain explicit confirmation.
5. Restore into a disposable database first; verify schema and application-level invariants.
6. Record the before/after passport and recovery outcome.

Do not interpret a successful backup command as proof of recoverability. A restore drill must validate the restored data and application behavior.
