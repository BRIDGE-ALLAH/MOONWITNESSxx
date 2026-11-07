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
3. Add a deterministic scenario file format for architecture reviews and incident game-days.
4. Add package ownership metadata only after maintainers approve a source of truth.

## Validation

```sh
node --test scripts/tests/counterfactual-repo-lab.test.mjs
pnpm run repo:lab -- --help
```
