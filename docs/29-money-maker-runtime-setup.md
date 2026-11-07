# MONEY MAKER Runtime Setup

This document describes the first persisted opportunity workflow. It is not a production deployment guide.

## Runtime boundary

- ARSY is the only business API and PostgreSQL owner.
- Headquarter calls ARSY through a server-side Next.js route handler.
- The ARSY operator token and database URL are server-only secrets. Never prefix them with `NEXT_PUBLIC_`.
- Headquarter operator login uses an eight-hour signed, HttpOnly, SameSite=Strict session cookie.
- Operator session configuration fails closed when the password, 32+ character signing secret, or exact public origin is missing.
- The opportunity API fails closed when its operator token is missing.
- Database migrations are explicit deployment/System Mode operations. Application startup never mutates schema.

## Required server environment

### ARSY

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string for ARSY and the migration command |
| `ARSY_OPERATOR_TOKEN` | Yes for commerce API | Shared secret accepted by the protected opportunity API |
| `ARSY_OPERATOR_ID` | No | Stable owner/actor ID; defaults to `primary-owner` |

### Headquarter

| Variable | Required | Purpose |
|---|---|---|
| `ARSY_API_BASE_URL` | Yes | Internal ARSY origin, e.g. `http://arsy:3001` on a shared Docker network |
| `ARSY_OPERATOR_TOKEN` | Yes | Same server-only token configured in ARSY |
| `ARSY_OPERATOR_ID` | Recommended | Must match the ARSY owner ID |
| `HEADQUARTER_OPERATOR_PASSWORD` | Yes | Strong operator login password |
| `HEADQUARTER_SESSION_SECRET` | Yes | Random secret of at least 32 characters for signing sessions |
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
4. Open `/login` and authenticate as the operator.
5. Open `/riot-radar`.
6. Capture a buyer problem with its public source, limitations, collection method and permission basis.
7. Leave unverified hard gates as `unknown`; do not mark them as passed without evidence.
8. Review the stored opportunity and decision returned by ARSY.

## Current capability boundary

Implemented in the current development branch:
- evidence-backed opportunity input validation and weighted scoring;
- evidence references and rationale/confidence per scored dimension;
- hard-gate precedence;
- owner-scoped opportunity create/list/read/decision/archive API;
- operator token protection and Headquarter signed-session BFF;
- PostgreSQL persistence and audit events for opportunity create/decision/archive;
- explicit migration runner and schema for the next commerce domains.

Not yet implemented or verified:
- product/version API and asset binary storage;
- inspection workflows and complete provenance UI;
- financial event ingestion, payout reconciliation and ledger UI;
- official marketplace channel integrations or publication receipts;
- Aftershock metrics based on real cohorts;
- scheduled market research automation;
- production deployment, backups, restore drills, rollback and live smoke tests.

No sample transaction, revenue figure, payout, market trend or publication is created by this workflow.
