# Repository Contract

**Owner:** Repository maintainers; each app/package owns its implementation  
**Scope:** Monorepo topology, manifests, workspace graph, root commands.

## Rules
- `apps/headquarter` owns the human-facing app; `apps/arsy` owns backend HTTP/orchestration.
- `packages/*` owns reusable libraries, contracts, adapters, and domain modules.
- `services/*` remains outside pnpm workspace until duplicate ownership is reconciled.
- Packages MUST NOT import application implementation. Headquarter consumes ARSY through public API contracts. ARSY MUST NOT depend on UI packages.
- Every workspace package MUST have a valid manifest and unique package name. Planning-only folders are not packages until a manifest exists.
- Root commands MUST be deterministic and propagate failures; no shell backgrounding to simulate task orchestration.
- Declared commands MUST perform their stated check; placeholder success scripts are forbidden.
- Dependency manifest and lockfile changes MUST be committed together.

## Allowed
Turborepo for task orchestration; Node built-in test runner for repository automation; programmatic checks over manifests and dependency edges.

## Forbidden
Activating legacy services via workspace globs; cross-importing app internals; silent lockfile regeneration in CI; claiming empty packages are implemented.

## Enforcement
Repository audit, frozen lockfile check, automation tests, CI, and dependency graph validation.

## Acceptance evidence
`pnpm run check:repo`, `pnpm run format:check`, `pnpm test`, frozen install, and dependency graph without forbidden edges.

## Exceptions
Both affected component owners approve, with reason, testable scope, compensating control, and review date.
