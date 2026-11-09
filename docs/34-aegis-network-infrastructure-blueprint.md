# AEGIS — Network Infrastructure Runtime Blueprint

**Status:** Phase 1 foundation restored; not production-ready.

## Purpose and ownership

AEGIS is a standalone Go runtime for future network-infrastructure execution. It is not an independent control plane.

- **ARSY** owns identity, policy decisions, authorization, orchestration, idempotency, and audit records.
- **AEGIS** will own narrowly scoped network execution adapters and report execution outcomes.
- **HEADQUARTER** remains the operator interface and communicates with ARSY only.
- External network platforms and device APIs remain separate dependencies with explicit credentials and capability boundaries.

## Implemented in Phase 1

- Go HTTP process with configurable bind address, port, read-header timeout, and graceful-shutdown timeout.
- Liveness and process-readiness endpoints.
- Structured JSON logs.
- Unit tests for configuration and health handlers.
- Non-root distroless container with read-only root filesystem, dropped Linux capabilities, no-new-privileges, and loopback-only host publishing in local Compose.

Readiness is process-level only. It does not prove reachability or health of routers, VPNs, DNS, firewalls, or other infrastructure.

## Explicitly not implemented

- ARSY-to-AEGIS authenticated service protocol, identity propagation, authorization claims, replay protection, or signed requests.
- WireGuard, Netmaker, RouterOS, firewall, routing, DNS, RADIUS, device enrollment, or provisioning mutations.
- Infrastructure inventory synchronization, persistent operation ledger, retries, reconciliation, or distributed locking.
- Production deployment, secret distribution, network policy, or observability integration.

No endpoint in this phase performs a privileged operation or executes arbitrary shell commands.

## Required next phases

1. **Trust protocol:** define a versioned ARSY-owned command contract, workload identity, mutual authentication, authorization scope, expiry/replay controls, and audit correlation. Deny by default.
2. **Execution model:** add typed allowlisted operations, validation, dry-run/plan, idempotency keys, bounded timeouts, cancellation, and structured results.
3. **Inventory and adapters:** add read-only inventory first, then isolated adapters for explicitly approved platforms. Keep device credentials in a managed secret provider; never log them.
4. **Durability and reconciliation:** persist operation state under ARSY governance, implement safe retries and reconciliation, and test partial failures.
5. **Deployment hardening:** define target environment, ingress/service identity, egress allowlists, secret rotation, backup/restore where applicable, metrics, alerting, rollback, and live smoke evidence.

## Security invariants

- AEGIS is not directly exposed to public ingress.
- ARSY is the only policy/authorization authority; Headquarter must never bypass it.
- No arbitrary command, script, or user-provided executable is accepted.
- No privileged container, host network namespace, Docker socket, or broad Linux capability is granted by default.
- All future mutations must be allowlisted, auditable, bounded, idempotent where possible, and tested against failure and rollback scenarios.
- Never claim a planned adapter or protocol as implemented.

## Local verification

From `apps/aegis`:

```sh
gofmt -w ./cmd ./internal
go vet ./...
go test -race ./...
go build ./cmd/aegis
```

From repository root:

```sh
docker compose config --quiet
docker compose build aegis
```

The Compose file is a development configuration only. A successful build or health endpoint is not production-readiness evidence.
