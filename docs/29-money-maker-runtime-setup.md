# MONEY MAKER Runtime Setup

This document describes the current persisted opportunity, product-brief, and financial-event slices. It is not a production deployment guide.

## Runtime boundary

- ARSY is the only business API and PostgreSQL owner.
- Headquarter calls ARSY through a server-side Next.js route handler.
- The ARSY operator token and database URL are server-only secrets. Never prefix them with `NEXT_PUBLIC_`.
- Headquarter operator login uses an eight-hour signed, HttpOnly, SameSite=Strict session cookie.
- Operator session configuration fails closed when the password, 32+ character signing secret, or exact public origin is missing.
- Every ARSY `/api/v1/*` business route requires both an explicit operator ID and the server-side operator token; the Fastify rate-limit plugin applies a default 120 requests/minute per route/IP, with stricter health-route limits.
- Headquarter rejects the fifth failed operator login within a 15-minute process-local window. This is defense in depth, not a distributed limiter; production ingress must add a shared rate limit before multi-replica deployment.
- Database migrations are explicit deployment/System Mode operations. Application startup never mutates schema.

## Required server environment

### ARSY

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string for ARSY and the migration command |
| `ARSY_OPERATOR_TOKEN` | Yes for `/api/v1/*` | Shared secret accepted by the protected versioned business API |
| `ARSY_OPERATOR_ID` | Yes | Stable owner/actor ID shared by ARSY and Headquarter; no implicit production owner is created |
| `ASSET_STORAGE_DRIVER` | Yes for asset uploads | `local` for the current persistent-volume adapter; unknown drivers fail closed |
| `ASSET_STORAGE_PATH` | Yes in production | Absolute path to the persistent asset volume; Compose uses `/var/lib/arsy/assets` |

### Headquarter

| Variable | Required | Purpose |
|---|---|---|
| `ARSY_API_BASE_URL` | Yes | Internal ARSY origin, e.g. `http://arsy:3001` on a shared Docker network |
| `ARSY_OPERATOR_TOKEN` | Yes | Same server-only token configured in ARSY |
| `ARSY_OPERATOR_ID` | Yes | Must exactly match the ARSY owner ID and is signed into the browser session |
| `HEADQUARTER_OPERATOR_PASSWORD` | Yes | Unique operator login password of at least 16 characters |
| `HEADQUARTER_SESSION_SECRET` | Yes | Random secret of at least 32 bytes for signing sessions |
| `HEADQUARTER_PUBLIC_ORIGIN` | Yes | Exact browser origin, e.g. `https://hq.example.com`, without a path |

Generate independent random values for the operator token and session secret. Store them in the deployment secret manager. Do not commit real values to the repository, shell history, screenshots, or logs.

## Apply database migrations

From the repository root, with the target ARSY `DATABASE_URL` supplied to the command environment:

```sh
pnpm --filter @riotworks/arsy migrate:up
```

The runner:
1. applies numbered SQL migrations in lexical order;
2. stores each migration name and SHA-256 checksum in `arsy_schema_migrations`;
3. skips an already-applied migration only when its checksum still matches;
4. fails if an applied migration file has been edited;
5. uses a transaction per migration.

Run this first against an isolated development/staging database and verify backup/restore before production. Never point the command at a production database until a reviewed migration and rollback plan exist.

## First workflow

1. Configure the environment variables in the two server runtimes.
2. Apply migrations to the same PostgreSQL database used by ARSY.
3. Start ARSY and Headquarter on a private network.
4. Open `/login` and authenticate as the configured operator.
5. Open `/riot-radar` and capture a buyer problem with its public source, limitations, collection method and permission basis.
6. Leave unverified hard gates as `unknown`; do not mark them as passed without evidence.
7. Add a measurable acceptance criterion and promote only a fully scored opportunity with all hard gates passed into a version-1 product brief.
8. Open `/mizan-ledger` to record source-backed financial events; each event remains pending until evidence-backed reconciliation.
9. Review verified summaries, which are computed only from persisted verified events.

## Asset storage and provenance\n\nSee [Money Maker Asset Storage, Provenance & Inspection](./30-money-maker-asset-storage-and-inspection.md) for the storage adapter contract, persistent Docker volume, upload limits, provenance schema, inspection source qualifications and restore requirements. The current local adapter verifies bytes after storage and requires a matching PostgreSQL backup/restore.\n\n## Current capability boundary

Implemented in the current development branch (implementation presence is not equivalent to verified production readiness):
- evidence-backed opportunity input validation, weighted scoring, hard-gate precedence, and missing-dimension preservation;
- owner-scoped opportunity create/list/read/content-update/decision/archive API with idempotent create, optimistic revision conflicts, and evidence/score/hard-gate review and edit UI;
- server-side Headquarter signed sessions, same-origin mutation checks, and server-only ARSY service credentials;
- eligible opportunity → version-1 product brief creation, product list/detail API, append-only version history, audited lifecycle transitions and The Forge editing controls;
- financial event ingestion with idempotency, event listing, currency-grouped verified summaries, and evidence-backed reconciliation;
- version-bound asset binary storage, server-computed SHA-256, upload idempotency, provenance, private attachment downloads, append-only inspections, and fail-closed inspection readiness; the current operator API cannot impersonate a trusted reviewer or automated inspection principal;
- audit events for opportunity, product, and financial operations;
- explicit PostgreSQL migrations for opportunity/product/version/financial-event/audit/asset/provenance/inspection tables, checksum runner, and isolated integration-test coverage for migration reruns, lifecycle, idempotency, reconciliation, audit events and persistence after reconnect;
- Playwright browser E2E coverage configured for login → opportunity capture/review/edit/decision → product brief/version/lifecycle → asset upload/provenance/inspection → financial event/reconciliation → Aftershock metrics → archive → logout. The current-head workflow result is pending.

Not yet implemented or verified:
- generic opportunity editing and operator-facing detail/evidence-history UI; decision and archive actions are implemented. Product detail UI and version editing beyond version 1 remain incomplete;
- asset binary storage, rights/inspection workflows, channel/listing integrations, payout lifecycle, and external provider webhooks;
- shared/distributed login-attempt throttling (the current login throttle is process-local and must be paired with an ingress limiter before scaling);
- current-head CI, CodeQL, container build, PostgreSQL integration and Playwright E2E execution evidence;
- production deployment, managed secrets, HTTPS ingress, backups, restore drills, rollback and live smoke tests;
- search/filter/cursor pagination and complete lifetime counts; current portfolio counts are explicitly bounded to the latest 100 records;
- channel listing/publication receipts, payout provider integrations and verified FX conversion.

No sample transaction, revenue figure, payout, market trend or publication is created by this workflow.
