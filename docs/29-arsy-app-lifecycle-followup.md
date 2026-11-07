# ARSY Application Lifecycle Follow-up

**Baseline:** PR #90 merged the port/start/health/container contract repair. This follow-up addresses the remaining application-lifecycle gap found during revalidation.

## Changes

- Separate Fastify app construction from process startup; importing the application no longer opens a listener.
- Create the PostgreSQL pool lazily at app startup and allow an injected pool for tests.
- Type the Fastify database decoration and close the pool from Fastify's `onClose` lifecycle.
- Register SIGTERM and SIGINT once at the server entrypoint and route both through one idempotent `app.close()` operation.
- Return HTTP 503 for database readiness failures rather than surfacing an unclassified 500.
- Fail closed when DATABASE_URL is absent.

## Tests

- Import-safe app factory and root/liveness route behavior.
- Database readiness and health behavior when PostgreSQL is unavailable.
- Idempotent signal-driven shutdown and exactly-once pool closure.
- Missing DATABASE_URL rejection.

## Release boundary

This improves application lifecycle correctness only. It does not establish production deployment readiness. Secrets, TLS, private database networking, backups, rollback, managed services and real production smoke tests remain separate release gates.
