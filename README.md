# MOONWITNESS

MOONWITNESS is an evidence-first, agent-governed workspace and product-engineering monorepo. RIOTWORKS is a product division within the ecosystem. The repository contains Headquarter (human-facing command center), ARSY (backend runtime and governance primitives), shared packages, WITNESS FABRIC, Divine research tooling, and repository automation.

**Product truth:** The Money Maker development workflow is a PostgreSQL-backed operator product: evidence-backed opportunities, versioned product briefs, inspections, provenance-aware assets, C0/C1 channel review, manual listing packages/publication receipts, source-backed financial events, payout lifecycle, exact-rational FX conversion, and database-side Aftershock cohorts. Operator-entered records and manual publication/payout evidence are not independent market research, verified marketplace API events, or bank/provider verification. Discovery exposure, support burden and external provider adapters remain unavailable until real sources and permissions exist. Do not treat static demo content as live data. Production deployment is not yet approved or verified.

## Repository map

- `apps/headquarter` — Next.js human-facing command center.
- `apps/arsy` — Fastify HTTP API and orchestration runtime.
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
| `pnpm test` | Run repository and DevX unit tests |
| `pnpm check:repo` | Run repository integrity checks |
| `pnpm validate` | Validate, type-check and build the workspace |
| `pnpm devx doctor --json` | Inspect local toolchain and workspace |
| `pnpm devx product-audit --json` | Audit workspace contracts, navigation truth and release blockers |

## Design and safety rules

- Headquarter consumes ARSY through public API contracts; it must not import backend implementation source.
- ARSY owns HTTP lifecycle. `packages/arsy-core` owns framework-neutral governance primitives.
- Do not add `services/*` to the workspace as a shortcut; move unique behavior into its canonical owner first.
- A green build is not a production release. Stable release requires a versioned changelog, a verified tag, release automation, production deployment and live smoke tests.
- This pack does not grant deployment credentials or override sandbox, approval, GitHub permissions, branch protection or production safety controls.

## Documentation

Start with [CONTRIBUTING.md](./CONTRIBUTING.md), [Repository Reality Audit](./docs/23-repository-audit-and-current-execution-plan.md), [Repository Governance](./docs/24-repository-and-automation-governance.md), the [Money Maker runtime setup](./docs/29-money-maker-runtime-setup.md), the [payout, FX and portfolio metric contracts](./docs/32-money-maker-payout-fx-and-portfolio-metrics.md), and the phase execution documents in `docs/`.
