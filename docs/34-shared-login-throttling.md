# Shared Headquarter Login Throttling

## Contract

Headquarter delegates login-attempt state to ARSY over the private operator API. PostgreSQL is the source of truth, so separate Headquarter and ARSY instances observe the same account and network buckets.

- Five failed attempts within a 15-minute window block the operator account and the trusted client network for 15 minutes.
- Headquarter returns HTTP 429 with a `Retry-After` value in seconds.
- Successful authentication clears the account bucket and the successful request's network bucket.
- The network identifier is HMAC-SHA256 keyed with `HEADQUARTER_SESSION_SECRET`; raw client addresses are not persisted.
- ARSY's `/api/v1/auth/login-attempts` endpoint is protected by the existing `ARSY_OPERATOR_TOKEN` pre-handler.
- Missing configuration, invalid responses, timeouts, or ARSY failures deny login with HTTP 503. No process-local fallback is used.

## Proxy trust boundary

In production, set `HEADQUARTER_TRUSTED_PROXY_HOPS=1` only when exactly one trusted ingress sits in front of Headquarter and overwrites `X-Forwarded-For` with one canonical client IP. The app rejects missing, malformed, and multi-value forwarded addresses. Block direct public access to Headquarter so clients cannot bypass the ingress.

Do not set this to `1` behind an ingress that appends to a client-provided header. Verify the ingress behavior before rollout. Local development uses one shared local-network bucket and ignores forwarded headers unless the same explicit trusted-proxy setting is enabled.

## Migration

Apply the additive migration through the controlled database migration procedure before deploying the application code:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/arsy/migrations/006_shared_login_attempts.sql
```

Application startup does not mutate schema. Back up the database and verify the migration in staging before production. Rollback consists of reverting the application release; do not drop the table during routine rollback because it contains security state.

## Verification

The `Shared login throttle` workflow runs the ARSY test suite against PostgreSQL, including two independent Fastify instances sharing one database, and tests Headquarter's trusted-proxy and fail-closed behavior. CI does not replace staging verification of ingress header overwrite and private network isolation.
