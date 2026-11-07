# Counterfactual Repo Lab

A deliberately small, read-only workspace intelligence tool. It turns package manifests into a deterministic dependency graph and lets contributors rehearse structural change impact and package-outage scenarios before touching code.

## Three implementation phases

### Phase 1 — Repository topology

```sh
pnpm run repo:lab
pnpm run repo:lab -- --json
pnpm run repo:lab -- --mermaid
```

Discovers named packages under `apps/*` and `packages/*`, then extracts only internal workspace dependency edges from dependencies, devDependencies, peerDependencies, and optionalDependencies.

### Phase 2 — Change impact

```sh
pnpm run repo:lab -- --impact @riotworks/ui
```

Computes the transitive reverse-dependency closure. Use it to decide which downstream packages deserve validation when a shared package changes.

### Phase 3 — Counterfactual outage rehearsal

```sh
pnpm run repo:lab -- --simulate-outage @riotworks/types
```

Shows which workspace packages structurally depend on a package that is assumed unavailable. This is a graph-level rehearsal, not runtime fault injection or a claim that every dependent will fail.

## Scenario replay

Save architecture-review or incident-game-day cases as JSON and replay them deterministically:

```sh
node scripts/repo-lab-scenario.mjs scripts/fixtures/repo-lab-scenarios.example.json
pnpm run repo:lab:scenario
pnpm run test:repo-lab
```

Schema version 1 accepts a non-empty `scenarios` array. Each entry has a unique lowercase `id`, `mode` (`change-impact` or `counterfactual-outage`), a workspace package `target`, and an optional `description`. Unsupported fields, duplicate IDs, unknown packages, and unsupported schema versions fail loudly. Results preserve scenario order and include the transitive affected set and edge reasons.

The replay engine reads scenario JSON and workspace manifests only. It does not execute scenario commands, modify files, install packages, or contact external services.

## CI contract

The Node built-in test suite runs in the repository-integrity job before dependency installation. These tests verify graph closure, deterministic rendering, scenario schema validation, replay ordering, and fail-closed handling. The graph model remains a package-manifest structural model; it must never be used to skip mandatory CI checks.

## Safety and design

- Node.js built-ins only; no new dependency.
- Read-only: never edits files, installs dependencies, runs package scripts, or calls a network.
- Deterministic ordering makes output diffable and CI-friendly.
- Explicitly distinguishes structural dependency from runtime behaviour.
- Unknown package names fail loudly.
- No source contents, environment variables, tokens, or secrets are collected.

## Next experiments

1. Add optional lockfile edge confidence, while preserving manifest-only baseline.
2. Add a CI annotation mode that proposes validation scope but never skips required checks.
3. Add package ownership metadata only after maintainers approve a source of truth.

## Validation

```sh
pnpm run test:repo-lab
pnpm run repo:lab -- --help
```
