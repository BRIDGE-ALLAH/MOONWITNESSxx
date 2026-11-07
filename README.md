# MOONWITNESS

MOONWITNESS is an evidence-first, agent-governed workspace and product-engineering monorepo. RIOTWORKS is a product division within the ecosystem. The repository contains Headquarter (human-facing web prototype), ARSY (backend runtime and governance primitives), shared packages, WITNESS FABRIC, Divine research tooling, and repository automation.

**Product truth:** MOONWITNESS now contains a persisted Money Maker foundation under active development: owner-scoped opportunities, product briefs, financial events and an asset/provenance workflow are being connected through ARSY and Headquarter. This is not a production commerce platform yet. No sample metric, placeholder account, unverified inspection, pending financial event, or unpublished listing may be presented as a real sale or verified marketplace result.

## Repository map

- `apps/headquarter` — Next.js human-facing command center.
- `apps/arsy` — Fastify HTTP API and orchestration runtime.
- `packages/*` — shared UI, contracts, assets, ARSY core, evidence and research capabilities.
- `services/*` — legacy prototypes, intentionally excluded from the pnpm workspace.
- `docs/` and `todo.md` — architecture decisions, research and implementation status.\n- [Money Maker runtime setup](./docs/29-money-maker-runtime-setup.md) and [asset storage / inspection contract](./docs/30-money-maker-asset-storage-and-inspection.md) and [channel registry / manual listing contract](./docs/31-money-maker-channel-registry-and-listings.md) — current commerce runtime boundary.
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

Start with [CONTRIBUTING.md](./CONTRIBUTING.md), [Repository Reality Audit](./docs/23-repository-audit-and-current-execution-plan.md), [Repository Governance](./docs/24-repository-and-automation-governance.md), and the phase execution documents in `docs/`.
