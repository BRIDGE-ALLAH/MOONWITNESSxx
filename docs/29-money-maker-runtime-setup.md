# MONEY MAKER Runtime Setup

**Status:** Development vertical slice; production is not approved.  
**Backend owner:** ARSY / PostgreSQL.  
**Human interface:** Headquarter / Next.js.

## Runtime boundary

- ARSY is the only business API and PostgreSQL owner.
- Headquarter calls ARSY through server-side Next.js route handlers. Browser code never receives the ARSY service token.
- ARSY protects every `/api/v1/*` business route with both a configured operator identity and a server-side token.
- Headquarter uses a signed eight-hour HttpOnly, SameSite=Strict operator session. Login and state-changing BFF requests validate the exact configured origin.
- The current authorization model is a single owner/operator. It is not multi-user RBAC, tenant management, SSO, or customer authentication.
- Database migrations are explicit operations; application startup never mutates schema.
- New financial events are pending until reconciled against evidence. Pending amounts do not contribute to verified net contribution.
- Marketplace publication, payout destination changes, ad spend, refunds, tax submissions, and other material external financial actions are not automated.

## Required server environment

### ARSY

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ARSY_OPERATOR_ID` | Yes for business APIs | Stable owner/actor ID |
| `ARSY_OPERATOR_TOKEN` | Yes for business APIs | Private service-to-service credential |

### Headquarter

| Variable | Required | Purpose |
|---|---|---|
| `ARSY_API_BASE_URL` | Yes | Private ARSY origin, e.g. `http://arsy:3001` on the same Docker network |
| `ARSY_OPERATOR_ID` | Yes | Must match ARSY's configured owner ID |
| `ARSY_OPERATOR_TOKEN` | Yes | Same server-only credential configured in ARSY |
| `HEADQUARTER_OPERATOR_PASSWORD` | Yes | Strong operator password |
| `HEADQUARTER_SESSION_SECRET` | Yes | Random signing secret of at least 32 characters |
| `HEADQUARTER_PUBLIC_ORIGIN` | Yes | Exact browser-facing origin, without a path |

Generate independent random values for the operator token and session secret. Store them in the deployment secret manager. Never commit actual credentials or use `NEXT_PUBLIC_` for server secrets. The Compose default `ARSY_API_BASE_URL=http://arsy:3001` is for container-to-container traffic; override it to `http://127.0.0.1:3001` when running Headquarter directly on the host.

## Apply database migrations

With the Docker Compose ARSY service running and its internal `DATABASE_URL` configured, apply migrations inside the service:

```sh
docker compose exec arsy pnpm migrate:up
```

For a host-run ARSY process, run `pnpm --filter @riotworks/arsy migrate:up` from the repository root with `DATABASE_URL` pointing to the same PostgreSQL database.

The runner applies numbered SQL migrations in lexical order, records their SHA-256 checksums, skips only an already-applied migration with an unchanged checksum, and uses a transaction per migration. It fails when an applied migration file has been edited. It is not called during application startup.

Run against an isolated development or staging database first. Verify backup and restore before any production migration.

## First operator workflow

1. Configure all ARSY and Headquarter secrets.
2. Apply migrations to the same PostgreSQL database used by ARSY.
3. Start ARSY and Headquarter on a private network.
4. Open `/login` and authenticate.
5. Use `/riot-radar` to capture an opportunity with source provenance, evidence limitations, score rationales and hard gates.
6. Leave unknown rights, country, channel and payout gates unknown until verified.
7. Only a complete score of at least 80 with every hard gate passed can become a product brief in `/the-forge`.
8. Record real source-backed financial events in `/mizan-ledger`. New events are pending.
9. Reconcile an event only against a statement, invoice, receipt or other evidence URL. Verified events feed `/aftershock`.

## Implemented development capabilities

- Opportunity domain validation, weighted scoring, evidence references, rationales and confidence.
- Owner-scoped ARSY opportunity create/list/read/update/decision/archive API and audit events. Updates use `expectedVersion` optimistic concurrency; edits, decisions, archives and product promotion advance the opportunity version. A stale edit receives `VERSION_CONFLICT`; an opportunity with a product brief cannot be edited.
- Product brief creation from an approved opportunity, append-only version revisions and owner-scoped product reads.
- Append-only rights, policy, technical and creative inspections; a product becomes READY only when the latest inspection of all four types passes. A passing inspection cannot contain a blocker finding, and readiness includes the inspection written by the same transaction.
- Asset upload/download/archive on a persistent local Docker volume, 5 MiB file cap, safe media-type allowlist, SHA-256 checksum and structured provenance metadata.
- C0/C1 channel registry with Indonesia eligibility, payout and policy evidence. A country can appear once per review; C1 enables manual listing packages only.
- Persisted manual listing package generation from the latest READY product version and an enabled C1 channel; publication receipts are entered by the owner after external publication and are not independently verified by a marketplace API.
- Financial event ingestion using integer minor units, ISO currency, request hashes and idempotency keys.
- Pending/verified/disputed/reversed reconciliation with evidence URL and audit event.
- Currency-grouped gross receipts, deductions, payout movements, pending totals and exact net-contribution calculation from verified events.
- Headquarter signed operator session, same-origin server-side BFF proxies, opportunity edit/archive board, product workshop, financial ledger, channel/listing workspace, inspection records and portfolio analytics.
- PostgreSQL integration workflow that applies migrations twice and verifies persistence across reconnects, optimistic update conflicts, product promotion/version locking, latest-inspection readiness, financial idempotency/reconciliation and audit events.

## Not yet implemented or not production-verified

- Automated MIME sniffing, malware scanning, upload quotas/retention, distributed object storage, and multi-replica asset consistency are not implemented. The local adapter accepts an operator-declared allowlisted media type, enforces a 5 MiB cap, stores binaries under an owner-hashed filesystem key, and verifies SHA-256 on download; this is not independent malware or rights verification.
- Marketplace account OAuth, official marketplace APIs, automated publishing, and independent verification of publication receipts. Current channel capability C1 means manual listing package only.
- Automated market-source connectors, freshness/recheck jobs, and measured discovery/conversion cohorts. Signal Room intentionally remains an honest no-source empty state.
- Payout import and provider reconciliation; current financial events are manually recorded by the operator. Operator-supplied evidence/reconciliation is not a bank or payment-provider verification.
- Multi-user identities, roles, tenant isolation and customer-facing checkout.
- Browser E2E, screen-reader/visual regression review, production deployment, managed secret provisioning, backup/restore drill, rollback and live smoke tests.

The current asset adapter is single-node filesystem storage. Asset rights/provenance fields are operator-entered and do not independently establish legal permission. Back up the `arsy_assets` Docker volume with the database and test restore before production. Do not run multiple ARSY replicas against independent local volumes.

No sample transactions, sales, marketplace listings, payout states, market trend values, or revenue claims are generated by this workflow. The current login throttle is process-local (5 failures per 15-minute window); production ingress must add a shared rate limit before scaling Headquarter beyond one process.
