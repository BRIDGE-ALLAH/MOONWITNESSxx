# MOONWITNESS

MOONWITNESS is an evidence-first, agent-governed workspace and product-engineering monorepo. RIOTWORKS is a product division within the ecosystem. The repository contains Headquarter (human-facing web prototype), ARSY (the authoritative backend and orchestration runtime), AEGIS (the Go network-infrastructure execution runtime), shared packages, WITNESS FABRIC, Divine research tooling, and repository automation.

**Product truth:** Headquarter currently contains prototype/demo screens. Static sample metrics, placeholder accounts, financial rows, and marketplace states are not live production data. ARSY runtime and integration readiness are tracked separately from UI prototypes.

## Repository map

- `apps/headquarter` — Next.js human-facing command center.
- `apps/arsy` — Fastify HTTP API and sole backend/control-plane authority.
- `apps/aegis` — standalone Go network infrastructure runtime, controlled by ARSY (not a second control plane).
- `packages/*` — shared UI, contracts, assets, ARSY core, evidence and research capabilities.
- `services/*` — legacy prototypes, intentionally excluded from the pnpm workspace.
- `docs/` and `todo.md` — architecture decisions, research and implementation status.
- `.agents/skills/`, `AGENTS.md`, and `GOAL.txt` — Codex engineering workflow pack included in this repository.

## Development workflow pack

This repository also includes a lean, modular Codex engineering setup:

- `GOAL.txt` — full autonomous engineering cycle for the Codex Goal field.
- `AGENTS.md` — durable repository rules.
- `.agents/skills/` — on-demand workflows for repository maintenance, debugging, PR delivery, release management and docs/Wiki work.

Copy or adapt these instructions only after reading the existing repository rules. Do not overwrite project-specific instructions, user changes, branch-protection rules, or approval requirements.

## Engineering commands

| Command | Purpose |
|---|---|
| `pnpm dev:headquarter` | Start Headquarter locally |
| `pnpm dev:arsy` | Start ARSY locally |
| `cd apps/aegis && go test ./...` | Test AEGIS |
| `cd apps/aegis && go run ./cmd/aegis` | Run AEGIS locally |
| `docker compose up --build aegis` | Build and start AEGIS in local Compose |
| `pnpm test` | Run repository and DevX unit tests |
| `pnpm check:repo` | Run repository integrity checks |
| `pnpm validate` | Validate, type-check and build the workspace |
| `pnpm devx doctor --json` | Inspect local toolchain and workspace |
| `pnpm devx product-audit --json` | Audit workspace contracts, navigation truth and release blockers |

## Design and safety rules

- Headquarter consumes ARSY through public API contracts; it must not import backend implementation source.
- ARSY owns backend identity, policy, orchestration and canonical audit. `packages/arsy-core` owns framework-neutral governance primitives.
- AEGIS performs network-specific execution only; future mutations must be explicitly authorized by ARSY and follow least privilege, plan/apply/verify, idempotency and auditable receipts. Phase 1 exposes process health only.
- Do not add `services/*` to the workspace as a shortcut; move unique behavior into its canonical owner first.
- A green build is not a production release. Stable release requires a versioned changelog, a verified tag, release automation, production deployment and live smoke tests.
- This pack does not grant deployment credentials or override sandbox, approval, GitHub permissions, branch protection or production safety controls.

## Documentation

Start with the [AEGIS network infrastructure blueprint](./docs/29-aegis-network-infrastructure-blueprint.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [Repository Reality Audit](./docs/23-repository-audit-and-current-execution-plan.md), [Repository Governance](./docs/24-repository-and-automation-governance.md), and the phase execution documents in `docs/`.
