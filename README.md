# MOONWITNESS

MOONWITNESS is an evidence-first, agent-governed workspace and product-engineering ecosystem. Its promise is **SEE MORE. KNOW MORE.** It observes before concluding, verifies before claiming, preserves provenance, and shares discoveries with care.

The wider narrative sits within EMPIRE OF THE LIGHT / A-L-L-A-H as a product and values universe—not as a claim of divine authority or supernatural software capability.

## Repository map

- `apps/headquarter` — human-facing command center and operator experience.
- `apps/arsy` — authoritative Fastify backend, identity boundary, policy and orchestration runtime.
- `apps/aegis` — Go network infrastructure execution runtime; controlled by ARSY.
- `packages/*` — reusable UI, contracts, assets, ARSY core, evidence and research capabilities.
- `services/*` — legacy prototypes, intentionally excluded from the pnpm workspace.
- `docs/` and `todo.md` — architecture decisions, research and implementation status.

AEGIS is a standalone Go application and is not a pnpm package. The existing pnpm workspace remains limited to `apps/*` and `packages/*`; the Go module is built and tested with the Go toolchain.

## Product truth

Headquarter contains prototype/demo surfaces; static sample metrics and placeholder records are not live production data. ARSY and AEGIS capabilities are tracked separately from UI prototypes. AEGIS currently provides only its Go runtime foundation and process health endpoints; it does not yet provision VPNs, manage routers, or change network configuration.

## Architecture boundaries

- Headquarter calls ARSY; it does not connect directly to databases or AEGIS.
- ARSY is the single backend/control-plane authority for identity, policy, orchestration and canonical audit.
- AEGIS is a bounded network execution runtime. Future network mutations must be explicitly authorized by ARSY and protected by least privilege, approval, idempotency, audit receipts and verification.
- Existing monitoring, RADIUS and security-observation components retain their current ownership.
- Do not add legacy `services/*` to the workspace as a shortcut.

## Development

| Command | Purpose |
|---|---|
| `pnpm dev:headquarter` | Start Headquarter |
| `pnpm dev:arsy` | Start ARSY |
| `pnpm test` | Run repository and DevX tests |
| `pnpm check:repo` | Run repository integrity checks |
| `pnpm validate` | Validate, type-check and build the pnpm workspace |
| `cd apps/aegis && go test ./...` | Test AEGIS |
| `cd apps/aegis && go run ./cmd/aegis` | Run AEGIS locally |
| `docker compose up --build aegis` | Build and start the AEGIS Compose service |

## Docker Compose

The default Compose stack is for local development only. Host ports are loopback-bound. Copy `.env.docker` to `.env` as documented in [DOCKER.md](./DOCKER.md). AEGIS listens on port 3102 inside the Compose network and is published locally on `127.0.0.1:3102` by default.

## Documentation

- [AEGIS network infrastructure blueprint](./docs/29-aegis-network-infrastructure-blueprint.md)
- [Technical architecture](./docs/08-technical-architecture.md)
- [Repository reality and execution plan](./docs/23-repository-audit-and-current-execution-plan.md)
- [Repository governance](./docs/24-repository-and-automation-governance.md)
- [Docker Compose guide](./DOCKER.md)
- [Contributing](./CONTRIBUTING.md)
