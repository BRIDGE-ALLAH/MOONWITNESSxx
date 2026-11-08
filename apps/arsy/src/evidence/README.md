# ARSY PostgreSQL Evidence Store

ARSY owns the authenticated runtime and durable PostgreSQL persistence for its per-operator evidence streams. The framework-neutral `EvidenceLedger` in `@riotworks/arsy-core` remains the domain primitive; this adapter is its durable store.

## Deployment

Apply both migrations through the deployment/System Mode migration process, in order:

1. `migrations/001_arsy_evidence_events.sql`
2. `migrations/007_arsy_evidence_events_append_only.sql`

Do not run migrations from application startup. Migration 007 installs database triggers that reject UPDATE, DELETE and TRUNCATE operations.

## Runtime API

All endpoints require the ARSY operator service credential and configured `ARSY_OPERATOR_ID`:

- `POST /api/v1/evidence/streams/:aggregateId/events` — append an event.
- `GET /api/v1/evidence/streams/:aggregateId/events` — read the ordered stream.
- `GET /api/v1/evidence/streams/:aggregateId/verify` — recompute and verify the full hash chain.

The event actor is derived from the authenticated ARSY principal. The request body does not accept `actorId`. Identical event retries are idempotent; reusing an event ID with different content returns 409. Concurrent stale writers receive a retryable 409 rather than silently forking the stream.

## Operator isolation

The adapter derives the internal database stream key as SHA-256 of the authenticated operator ID, a zero-byte separator, and the logical aggregate ID. This isolates identical caller-visible aggregate IDs belonging to different operators without changing the logical aggregate ID included in the event hash or API response.

## Integrity boundaries

- PostgreSQL transaction-scoped advisory locks serialize writers across ARSY processes.
- The expected previous hash prevents stale writers from forking the stream.
- Database triggers reject row UPDATE/DELETE and table TRUNCATE.
- Hash chaining detects mutation/reordering relative to the stored chain; it does not establish that a source is truthful or prove who authored it.
- This is durable event storage, not a complete evidence graph projection, source-authentication system, KMS-backed signing service, or Headquarter evidence UI.
- Backups, database role permissions, retention/deletion policy, key custody and operational monitoring remain deployment responsibilities.
