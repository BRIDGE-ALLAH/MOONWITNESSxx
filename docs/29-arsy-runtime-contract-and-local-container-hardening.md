# ARSY Runtime Contract & Local Container Hardening

**Status:** runtime and local-development hardening implemented; production deployment remains NO-GO.

## Application composition
- `apps/arsy` owns HTTP composition and process startup; `packages/arsy-core` owns framework-neutral governance primitives.
- Fastify construction is separate from startup so tests inject a database pool without opening sockets.
- `PORT` is validated and defaults to 3001; `HOST` defaults to loopback for direct local runs and is explicitly set to 0.0.0.0 in the container.
- `DATABASE_URL` is mandatory when creating the production pool.

## Database lifecycle and health
- Database pool is typed, injected and decorated on the Fastify instance.
- Fastify `onClose` owns pool cleanup.
- `/health/live` reports process liveness.
- Database readiness refreshes on a bounded five-second interval; `/health/ready` and `/health/db` read cached state rather than querying PostgreSQL on every public health request.
- Database failures return 503 without exposing connection details.

## Containers and verification
- Production Dockerfiles start the application entrypoints; Compose overrides the command for local hot reload.
- Compose binds PostgreSQL, Redis, ARSY and Headquarter host ports to loopback and requires an explicit local database password.
- ARSY runtime tests cover liveness, readiness, database-down behavior, pool cleanup and port validation.
- Dedicated CI validates Compose and builds both images.

This is local/runtime hardening, not proof of production secrets, TLS ingress, managed database availability, backup/restore, rollback, deployment health or production smoke tests.
