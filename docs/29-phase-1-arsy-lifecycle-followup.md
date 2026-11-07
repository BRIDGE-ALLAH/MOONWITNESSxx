# Phase 1 — ARSY Core and Persistence Lifecycle Follow-up

**Status:** Runtime wiring improved; adapter and verification gates remain open.

## Implemented in this follow-up

- ARSY Core is now a reusable Fastify plugin and app factory.
- Zod integration uses Fastify's validator and serializer compiler hooks rather than registering the type-provider module as a plugin.
- Core server options use FastifyServerOptions; listening options are passed to listen(), not mixed into server construction.
- Error responses redact internal 5xx messages while preserving request logging.
- ARSY app is a Fastify CLI plugin entrypoint and composes through @riotworks/arsy-core.
- PostgreSQL pool is created per app instance and closed through Fastify's onClose lifecycle hook.
- Process signal handlers and module-global pool ownership have been removed from database setup.

## Still open

- PostgreSQL adapter package and SQLite System Database adapter package.
- Package dependency/lockfile refresh for newly explicit ARSY Core dependencies and ORM workspace packages.
- pg TypeScript type dependency verification.
- ARSY Core and app TypeScript checks, ESLint, Fastify boot/shutdown test, and database integration test.
- Clean pnpm install and CI.

## Important runtime boundary

The ARSY app still has a legacy direct PostgreSQL pool for its current prototype route health check. This follow-up fixes lifecycle ownership but does not yet replace that direct pool with the new provider SPI. The adapter packages and ARSY persistence integration are still required before the ORM/provider architecture can be considered implemented.
