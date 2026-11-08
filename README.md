# MOONWITNESS

**SEE MORE. KNOW MORE.**

MOONWITNESS is an evidence-first knowledge, intelligence, and operations ecosystem. Its purpose is to help people observe carefully, preserve sources and context, verify claims, connect knowledge, make accountable decisions, and share useful discoveries.

MOONWITNESS is the master product identity within the wider **GODPROMISE → EMPIRE OF THE LIGHT** narrative universe. **A-L-L-A-H.COM** is the intended unified public home. **ROCKSOUL** is a distinct creative/narrative identity and runtime direction. **E-ISP.ID** is the connectivity business identity. **RIOTWORKS** is the product and operating division within MOONWITNESS, associated with the initial creative-commerce workflow; it is not a competing master brand.

> **Repository truth:** this monorepo contains the HEADQUARTER and ARSY application workspaces plus standalone Go (AEGIS) and Python (ORACLE) runtimes. Their integration and production status are tracked independently; a service foundation is not a claim of complete infrastructure capability. See the [Universe & Product Architecture Registry](./docs/32-universe-and-product-architecture-registry.md).

## What this repository contains

- `apps/headquarter` — Next.js human-facing command center and current prototype/demo experience.
- `apps/arsy` — Fastify API/runtime, application orchestration, identity/policy boundary, health/readiness, and bounded integrations.
- `apps/aegis` — standalone Go network-infrastructure runtime foundation; currently process health only, with no VPN/router/firewall operations or ARSY command integration.
- `apps/oracle` — standalone Python/FastAPI deterministic computation service; intentionally outside the pnpm workspace and reached privately through ARSY.
- `packages/*` — shared UI, contracts/types, policy, notifications, feature flags, assets, evidence, Divine research, and developer tooling.
- `services/*` — legacy prototypes intentionally excluded from the pnpm workspace; not a second runtime ownership layer.
- `docs/` — canonical narrative, product, design, technical architecture, governance, research, and current-state documentation.

## Product direction

The initial applied product workflow is evidence-backed discovery → opportunity decision → original work and asset provenance → rights/quality review → permitted distribution preparation → financial reconciliation → portfolio learning.

The wider target catalog is **seven core product experiences plus two additional operational/industry experiences**:

- Core: GATE, DOCK, HEADQUARTER, MOONWITNESS ID, WORLD OBSERVATORY, MOONSKY, HARBOR.
- Additional: COCKPIT and the E-ISP public storefront.

This is a product catalog, not a statement that nine apps exist in the current workspace. HEADQUARTER modules such as SIGNAL ROOM, RIOT RADAR, THE FORGE, ZILL WATCH, LAUNCH BAY, SIDRA ARCHIVE, AFTERSHOCK, MIZAN LEDGER, and RIOT ENGINE remain modules—not separate apps. The registry documents each boundary and status.

## Current implementation truth

- HEADQUARTER is a Next.js prototype. Demo/sample data must not be mistaken for live production data.
- ARSY is the canonical Fastify backend application. It owns HTTP lifecycle and the central application/API authority.
- AEGIS is a standalone Go runtime foundation. Phase 1 exposes process health only; ARSY command authentication and network provisioning adapters are not implemented.
- ORACLE provides bounded deterministic analysis behind ARSY; Stage 1 job/idempotency state is process-memory only, with no durable queue/job persistence or production readiness claim.
- The authenticated Docker connector is deliberately read-only and bounded; it does not provide container start/stop/exec/deploy or production deployment management.
- WITNESS FABRIC, Divine research tooling, repository automation, and developer-experience capabilities have implementation evidence in the repository.
- The custom ORM, database adapters, and Base Platform addon suite remain target architecture; do not describe them as complete mainline implementations.
- Local Docker Compose is a development stack, not a production deployment definition.
- Production readiness remains **NO-GO** until the target environment, managed secrets, TLS/ingress, backup/restore, monitoring, rollback, and live smoke tests are evidenced.

## Development

Requirements: Node.js 22+ (CI uses Node.js 24) and pnpm 12.16.1 as pinned in the root package manifest.

```bash
pnpm install
pnpm dev:headquarter
pnpm dev:arsy

# AEGIS is a standalone Go module, not a pnpm package:
cd apps/aegis && go test -race ./... && go run ./cmd/aegis
```

Useful validation commands:

```bash
pnpm check:repo
pnpm test
pnpm validate
pnpm devx doctor --json
pnpm devx product-audit --json
```

Use the committed lockfile and repository scripts. If frozen install fails because the workspace lockfile is stale, follow [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/24](./docs/24-repository-and-automation-governance.md); do not bypass the lockfile gate.

## Architecture principles

- One canonical application backend: ARSY; no duplicate `services/arsy` runtime.
- HEADQUARTER consumes ARSY through public typed contracts and never accesses privileged database adapters directly.
- Domain capabilities, platform control planes, and external engines have explicit ownership.
- Evidence, provenance, audit, idempotency, least privilege, and truthful unavailable/demo states are first-class.
- A documented target is not an implemented feature; a green build is not production readiness.
- No production DNS, secret, infrastructure, or deployment changes are implied by this repository documentation.

## Documentation map

| Document | Purpose |
|---|---|
| [01 — Ecosystem Narrative](./docs/01-ecosystem-narrative.md) | Master brand, story, values, and narrative boundaries |
| [02 — Product Charter](./docs/02-product-charter.md) | Initial product purpose, users, scope, and principles |
| [09 — Headquarter IA](./docs/09-information-architecture.md) | Current application and module ownership |
| [10 — Design DNA](./docs/10-design-dna.md) | MOONWITNESS visual identity and design principles |
| [15 — Roadmap](./docs/15-roadmap-and-acceptance.md) | Delivery phases and acceptance gates |
| [18–22 — Architecture](./docs/18-monorepo-and-orm-addon-architecture.md) | Backend, ORM, addons, schema, and database target contracts |
| [23 — Repository Audit](./docs/23-repository-audit-and-current-execution-plan.md) | Historical implementation audit and execution order |
| [24 — Repository Governance](./docs/24-repository-and-automation-governance.md) | Workspace, automation, CI, and ownership rules |
| [28 — Current-State Revalidation](./docs/28-current-state-revalidation-2026-11-08.md) | Dated mainline and production-readiness evidence |
| [29 — Docker Connector](./docs/29-docker-connector.md) | Read-only Docker integration and security boundaries |
| [30 — ARSY Hardening](./docs/30-arsy-phases-18-20-hardening.md) | Runtime trust-boundary hardening |
| [31 — Product Integrity](./docs/31-product-integrity-phases-36-38.md) | Data-truth and release preflight |
| [32 — Universe & Product Registry](./docs/32-universe-and-product-architecture-registry.md) | Wider product universe, nine target experiences, domains, and platform ownership |

For contribution rules and verified commands, start with [CONTRIBUTING.md](./CONTRIBUTING.md), [AGENTS.md](./AGENTS.md), and [docs/24](./docs/24-repository-and-automation-governance.md).
