# MONEY MAKER Runtime Setup

This document describes the current persisted opportunity, product-brief, and financial-event slices. It is not a production deployment guide.

## Runtime boundary

- ARSY is the only business API and PostgreSQL owner.
- Headquarter calls ARSY through a server-side Next.js route handler.
- The ARSY operator token and database URL are server-only secrets. Never prefix them with `NEXT_PUBLIC_`.
- Headquarter operator login uses an eight-hour signed, HttpOnly, SameSite=Strict session cookie.
- Operator session configuration fails closed when the password, 32+ character signing secret, or exact public origin is missing.
- Every ARSY `/api/v1/*` business route requires both an explicit operator ID and the server-side operator token; the Fastify rate-limit plugin applies a default 120 requests/minute per route/IP, with stricter health-route limits.
- Headquarter login uses an ARSY/PostgreSQL shared limiter: five failures in a 15-minute window block the normalized operator bucket and the trusted client-network bucket for 15 minutes. Raw IPs and operator identifiers are not stored; only keyed HMAC digests are persisted. If ARSY or PostgreSQL is unavailable, login fails closed with HTTP 503.
- Database migrations are explicit deployment/System Mode operations. Application startup never mutates schema.

## Required server environment

### ARSY

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string for ARSY and the migration command |
| `ARSY_OPERATOR_TOKEN` | Yes for `/api/v1/*` | Shared secret accepted by the protected versioned business API |
| `ARSY_OPERATOR_ID` | Yes | Stable owner/actor ID shared by ARSY and Headquarter; no implicit production owner is created |

### Headquarter

| Variable | Required | Purpose |
|---|---|---|
| `ARSY_API_BASE_URL` | Yes | Internal ARSY origin, e.g. `http://arsy:3001` on a shared Docker network |
| `ARSY_OPERATOR_TOKEN` | Yes | Same server-only token configured in ARSY |
| `ARSY_OPERATOR_ID` | Yes | Must exactly match the ARSY owner ID and is signed into the browser session |
| `HEADQUARTER_OPERATOR_PASSWORD` | Yes | Unique operator login password of at least 16 characters |
| `HEADQUARTER_SESSION_SECRET` | Yes | Random secret of at least 32 bytes for signing sessions |
| `HEADQUARTER_PUBLIC_ORIGIN` | Yes | Exact browser origin, e.g. `https://hq.example.com`, without a path |
| `HEADQUARTER_TRUSTED_PROXY_HOPS` | Yes in production | Number of trusted ingress proxies (1–8); production login fails closed when absent |
| `HEADQUARTER_PROXY_IDENTITY_SECRET` | Yes in production | 32+ byte HMAC secret shared with the trusted ingress, used to authenticate client-IP assertions |

Generate independent random values for the operator token and session secret. Store them in the deployment secret manager. Do not commit real values to the repository, shell history, screenshots, or logs.


## Shared login throttling and trusted ingress

- ARSY owns the shared limiter state in `arsy_login_attempt_buckets`; Headquarter does not keep an authoritative process-local counter.
- Five invalid attempts in a rolling 15-minute window block both the normalized operator bucket and the network bucket for 15 minutes. A successful login clears the matching operator and network buckets. The operator bucket prevents IP rotation from bypassing the account-wide limit.
- The bucket identifiers are HMAC-SHA256 digests keyed by `HEADQUARTER_SESSION_SECRET`; raw operator IDs and client IP addresses are not sent to ARSY or stored in PostgreSQL.
- Every limiter API call is server-to-server and protected by the existing `ARSY_OPERATOR_TOKEN`. If the shared service cannot be reached or the limiter write fails, Headquarter returns 503 and does not issue a session.
- Local development sets `HEADQUARTER_TRUSTED_PROXY_HOPS=0` and uses one explicit `local-development` network bucket. Arbitrary `X-Forwarded-For` headers are ignored in this mode; local requests intentionally share that bucket.
- Production must set `HEADQUARTER_TRUSTED_PROXY_HOPS` to the actual trusted ingress hop count (1–8) and configure a 32+ byte `HEADQUARTER_PROXY_IDENTITY_SECRET` shared with the ingress. Keep Headquarter private behind that ingress; do not expose its application port directly.
- The ingress must determine the client address using only the configured trusted proxy chain, strip all inbound `X-Forwarded-For` and `X-MW-Client-*` headers, and set exactly these four headers:
  - `X-MW-Client-IP`: canonical client IP address;
  - `X-MW-Client-Timestamp`: current Unix timestamp in seconds;
  - `X-MW-Proxy-Hops`: configured trusted hop count as a decimal integer;
  - `X-MW-Client-Signature`: lowercase hex HMAC-SHA256 of `<client-ip>.<timestamp>.<trusted-proxy-hops>` using `HEADQUARTER_PROXY_IDENTITY_SECRET`.
- Headquarter accepts only a valid IP, a timestamp within 60 seconds, and a constant-time-valid HMAC signature. Raw forwarded headers without the signed assertion are never trusted. Missing/invalid identity returns 503 rather than falling back to a spoofable address.
- Apply migration `005_shared_login_attempts.sql` before enabling this route. The table contains only bucket type, keyed digest, failure count, timestamps and lockout expiry.

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

## Current capability boundary

Implemented in the current development branch (implementation presence is not equivalent to verified production readiness):
- evidence-backed opportunity input validation, weighted scoring, hard-gate precedence, and missing-dimension preservation;
- owner-scoped opportunity create/list/read/decision/archive API with owner-scoped idempotent create and operator-facing decision/archive actions;
- server-side Headquarter signed sessions, same-origin mutation checks, and server-only ARSY service credentials;
- eligible opportunity → version-1 product brief creation, product list/detail API, and acceptance criteria;
- financial event ingestion with idempotency, event listing, currency-grouped verified summaries, and evidence-backed reconciliation;
- audit events for opportunity, product, and financial operations;
- explicit PostgreSQL migrations limited to implemented opportunity/product/version/financial-event/audit tables, checksum runner, and isolated integration-test coverage for migration reruns, opportunity/product/finance lifecycle, idempotency, reconciliation, audit events and persistence after reconnect;
- Playwright browser E2E coverage configured for login → opportunity capture/decision → product brief → financial event/reconciliation → Aftershock metrics → archive → logout. The current-head workflow result is pending.

Not yet implemented or verified:
- generic opportunity editing and operator-facing detail/evidence-history UI; decision and archive actions are implemented. Product detail UI and version editing beyond version 1 remain incomplete;
- asset binary storage, rights/inspection workflows, channel/listing integrations, payout lifecycle, and external provider webhooks;
- shared/distributed login-attempt throttling (the current login throttle is process-local and must be paired with an ingress limiter before scaling);
- current-head CI, CodeQL, container build, PostgreSQL integration and Playwright E2E execution evidence;
- production deployment, managed secrets, HTTPS ingress, backups, restore drills, rollback and live smoke tests;
- search/filter/cursor pagination and complete lifetime counts; current portfolio counts are explicitly bounded to the latest 100 records;
- asset binary storage/provenance, inspection workflows, channel listing/publication receipts, payout provider integrations and verified FX conversion.

No sample transaction, revenue figure, payout, market trend or publication is created by this workflow.
