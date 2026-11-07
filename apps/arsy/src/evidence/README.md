# ARSY PostgreSQL Evidence Store

This adapter persists Phase 14 evidence events in PostgreSQL.

## Deployment

1. Apply `migrations/001_arsy_evidence_events.sql` using the deployment/System Mode migration process.
2. Construct `PostgresEvidenceStore` with the existing application `pg.Pool`.
3. Inject it into `new EvidenceLedger(store)`.

The adapter uses a PostgreSQL transaction-scoped advisory lock per aggregate and checks the expected previous hash before appending. This prevents concurrent writers in separate processes from silently forking a stream. A stale writer receives a retryable error; the caller must reload the stream and retry with a newly constructed event.

## Boundaries

- This is durable storage, not a complete evidence graph projection or source-authentication system.
- Hash chaining detects modification/reordering relative to the stored chain; it does not establish that a source is truthful.
- The migration is intentionally not run at application startup. System Mode owns schema changes.
- Backups, database permissions, retention/deletion policy and operational monitoring remain deployment responsibilities.
