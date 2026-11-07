# ARSY Runtime Contract & Local Container Hardening

**Status:** implemented runtime contract and local-development hardening; production deployment remains NO-GO until separate infrastructure/security gates are satisfied.

## Phase 1 — One application composition root

- The application entrypoint is apps/arsy, not the framework-neutral @riotworks/arsy-core package.
- Fastify app construction is separated from process startup so tests can inject a database pool without opening sockets.
- PORT defaults to 3001 to match the Headquarter service URL and Compose mapping; HOST defaults to 0.0.0.0 inside the container.
- Invalid ports fail startup rather than silently binding an unintended interface.
- Production start runs the application entrypoint; local dev uses Node watch mode.

## Phase 2 — Typed lifecycle and health semantics

- Database pool is injected and decorated with a typed Fastify contract.
- Graceful database cleanup is registered on Fastify onClose, avoiding duplicate process-level SIGINT/SIGTERM handlers.
- /health/live indicates process liveness.
- /health/ready and /health/db query PostgreSQL and return 503 when unavailable.
- DATABASE_URL is required when constructing the production application; the root route does not expose database details.

## Phase 3 — Container and CI hardening

- Dockerfile uses the production start command; Compose explicitly overrides it for local hot reload.
- Compose is documented as local-development only.
- PostgreSQL, Redis, ARSY and Headquarter host ports bind to loopback by default.
- The default postgres password is removed; Compose requires POSTGRES_PASSWORD to be supplied through an ignored local environment file or shell environment.
- ARSY lint no longer echoes a skip; it runs Prettier checks.
- Runtime tests are included in Repository CI.

## Verification and boundaries

The runtime contract tests cover root/liveness, database readiness, 503 behavior, graceful pool closure, and port validation. Repository CI must also verify TypeScript, lint, workspace builds and CodeQL before merge.

This is not a production deployment. No production secrets, deployment target, backup/restore, rollback, TLS ingress, managed database, or production health endpoint were configured or exercised. Do not publish this Compose profile as production. Use a separate production deployment design with secret management and private data-service networking.
