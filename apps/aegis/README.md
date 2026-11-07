# AEGIS

**MOONWITNESS Network Infrastructure Runtime**  
*Secure connections. Controlled infrastructure. Observable operations.*

AEGIS is the Go application responsible for executing approved network-infrastructure operations for MOONWITNESS. It is a focused runtime, not a second control plane.

## Responsibility boundary

- **ARSY** remains the authoritative backend, identity boundary, policy decision point, orchestration layer, and audit owner.
- **AEGIS** will own network-specific execution adapters, infrastructure inventory synchronization, connectivity lifecycle operations, and execution results.
- **Headquarter** remains the human-facing operator experience and calls ARSY, never AEGIS directly.
- Existing monitoring, RADIUS, and security-observation capabilities retain their existing owners. AEGIS does not silently replace them.

ARSY-to-AEGIS integration is not implemented in this foundation. No privileged network operation is exposed yet.

## Phase 1 foundation

This initial implementation provides:

- Go HTTP server with configurable bind address and port.
- `GET /health/live` and `GET /health/ready`.
- Structured JSON access/startup logs.
- Graceful SIGINT/SIGTERM shutdown.
- Unit tests for configuration and HTTP health behavior.
- Non-root, multi-stage Docker image and local Compose service.

The readiness endpoint currently means only that the process is initialized and able to serve requests. It does not attest to VPN, router, firewall, or external infrastructure health.

## Run locally

```sh
go test ./...
go run ./cmd/aegis
```

Environment:

| Variable | Default | Meaning |
|---|---:|---|
| `AEGIS_HOST` | `0.0.0.0` | HTTP bind address |
| `AEGIS_PORT` | `3102` | HTTP listen port |
| `AEGIS_READ_HEADER_TIMEOUT` | `5s` | HTTP read-header timeout |
| `AEGIS_SHUTDOWN_TIMEOUT` | `10s` | Graceful shutdown deadline |

Health endpoints:

- `GET /health/live` — process is alive.
- `GET /health/ready` — process has completed initialization and can accept requests.

## Docker Compose

From the repository root:

```sh
docker compose up --build aegis
docker compose logs -f aegis
```

The local host port is bound to loopback only. The container joins the existing `moonwitness` network. This is a local-development configuration, not a production deployment.

## Security invariants

1. No network device credentials are stored in source, images, or logs.
2. No HTTP handler executes shell commands or accepts arbitrary commands.
3. No WireGuard, Netmaker, RouterOS, firewall, route, DNS, or provisioning mutation is implemented in Phase 1.
4. Future mutating operations must be authenticated service-to-service, authorized by ARSY, narrowly allowlisted, auditable, idempotent where possible, and support a dry-run/plan stage.
5. Runtime privileges must be introduced only with a documented capability requirement; do not run the container as privileged or mount the host network namespace by default.

See [the AEGIS product and architecture blueprint](../../docs/29-aegis-network-infrastructure-blueprint.md).
