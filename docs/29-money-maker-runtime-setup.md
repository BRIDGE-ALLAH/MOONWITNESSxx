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
| `ARSY_API_BASE_URL` | Yes | Private ARSY origin, e.g. `http://arsy:3000` on the same Docker network |
| `ARSY_OPERATOR_ID` | Yes | Must match ARSY's configured owner ID |
| `ARSY_OPERATOR_TOKEN` | Yes | Same server-only credential configured in ARSY |
| `HEADQUARTER_OPERATOR_PASSWORD` | Yes | Strong operator password |
| `HEADQUARTER_SESSION_SECRET` | Yes | Random signing secret of at least 32 characters |
| `HEADQUARTER_PUBLIC_ORIGIN` | Yes | Exact browser-facing origin, without a path |

Generate independent random values for the operator token and session secret. Store them in the deployment secret manager. Never commit actual credentials or use `NEXT_PUBLIC_` for server secrets.

## Apply database migrations

From the repository root, with the ARSY database URL supplied to the command environment:

```sh
pnpm --filter @riotworks/arsy migrate:up
```

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
- Owner-scoped ARSY opportunity create/list/read/decision/archive API and audit events.
- Product brief creation from an approved opportunity, version 1 persistence and owner-scoped product reads.
- Financial event ingestion using integer minor units, ISO currency, request hashes and idempotency keys.
- Pending/verified/disputed/reversed reconciliation with evidence URL and audit event.
- Currency-grouped gross receipts, deductions, payout movements, pending totals and exact net-contribution calculation from verified events.
- Headquarter signed operator session, same-origin server-side BFF proxies, opportunity board, product workshop, financial ledger and portfolio analytics.
- PostgreSQL integration workflow that applies migrations and verifies persistence across reconnects.

## Not yet implemented or not production-verified

- Revisions beyond product version 1; binary asset storage, upload/download authorization and checksum verification.
- Asset provenance editing and rights/technical/creative inspection execution.
- Channel registry administration, listing package generation, marketplace account OAuth, publication receipts and official marketplace APIs.
- Automated market-source connectors, freshness/recheck jobs and measured discovery/conversion cohorts.
- Payout import and provider reconciliation; current financial events are manually recorded by the operator.
- Multi-user identities, roles, tenant isolation and customer-facing checkout.
- Browser E2E, production deployment, managed secret provisioning, backup/restore drill, rollback and live smoke tests.

No sample transactions, sales, marketplace listings, payout states, market trend values, or revenue claims are generated by this workflow.
