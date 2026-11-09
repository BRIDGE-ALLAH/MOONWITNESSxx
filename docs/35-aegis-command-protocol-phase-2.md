# AEGIS Command Protocol — Phase 2 Contract

**Status:** validation primitives only; no network endpoint or command executor is enabled.

## Authority and trust model

ARSY remains the only identity, policy, authorization, orchestration, and audit authority. Headquarter communicates with ARSY only. AEGIS must not infer operator permissions from a request body or trust caller-supplied role names.

Before any command endpoint is exposed, the service-to-service channel must provide workload identity and mutual authentication. The receiver must verify issuer, audience, signature or authenticated transport identity, authorization scope, expiry, replay protection, and audit correlation. Secrets and device credentials must never be embedded in command payloads or logs.

## Version 1 envelope

The Go package `internal/protocol` validates the structural envelope:

- `version`: exact protocol version (`v1`).
- `request_id`: traceable request identifier.
- `idempotency_key`: stable key for duplicate detection by a future durable operation ledger.
- `operation`: exact operation identifier checked against an explicit allowlist.
- `target_id`: opaque inventory identifier, never an arbitrary host or URL.
- `issued_at` / `expires_at`: bounded validity window.
- `payload`: JSON object; operation-specific schemas must be added before any operation is enabled.

The validator rejects missing/invalid identifiers, unknown operations, malformed payloads, expired/future commands, and validity windows over the configured maximum TTL. An empty allowlist denies every operation.

## Deliberately absent

This phase does not implement cryptographic signature verification, mTLS identity extraction, durable replay/idempotency storage, inventory resolution, an HTTP command route, or execution adapters. Structural validation is not authentication or authorization. Do not wire this validator to a public or unauthenticated endpoint.

## Acceptance gates before enabling a command

1. Select and document workload identity and mTLS trust roots; enforce issuer and audience.
2. Bind authenticated identity to ARSY-issued authorization scope and deny by default.
3. Add signature/replay controls appropriate to the transport and bounded clock skew.
4. Persist idempotency and operation state; define duplicate and concurrent-request semantics.
5. Add per-operation typed payload schemas and target resolution from trusted inventory.
6. Add audit correlation, redaction, rate limits, timeouts, cancellation, and integration tests.
7. Only then expose a private command route with an initially empty allowlist.

## Local checks

```sh
gofmt -w ./cmd ./internal
go vet ./...
go test -race ./...
go build -trimpath ./cmd/aegis
```
