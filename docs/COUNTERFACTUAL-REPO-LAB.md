# Counterfactual Repo Lab

A deterministic, read-only workspace graph and counterfactual change/outage rehearsal tool. It uses Node.js built-ins and does not execute package scripts, install dependencies, modify files, contact services, or replace mandatory CI.

## Commands

- `pnpm run repo:lab` — print workspace package and internal-edge counts.
- `pnpm run repo:lab -- --json` — emit the graph as JSON.
- `pnpm run repo:lab -- --impact @riotworks/ui` — calculate transitive reverse-dependency blast radius.
- `pnpm run repo:lab -- --simulate-outage @riotworks/ui` — structurally rehearse package unavailability.
- `pnpm run repo:lab -- --cycles` — find strongly connected dependency components.
- `pnpm run repo:lab -- --changed-files packages/ui/src/button.ts` — map changed paths to owning packages and downstream dependents.
- `pnpm run repo:lab -- --mermaid` — render a Mermaid dependency graph.
- `pnpm run repo:lab:scenario -- scripts/fixtures/repo-lab-scenarios.example.json` — replay deterministic scenarios.

## Completeness and safety rules

- Discovery follows the repository's exact pnpm workspace globs: direct children of `apps/*` and `packages/*`. Nested examples and fixtures are not workspace packages.
- Missing package manifests are skipped; malformed JSON, invalid dependency sections and duplicate package names fail closed with a path-specific error.
- Changed paths are normalized and traversal/absolute paths are rejected.
- Cycle detection uses strongly connected components; scenario IDs and fields are schema-validated.
- The structural exposure score is a heuristic index, not a failure probability.
- Reports are advisory. They must never skip, weaken or replace required unit, integration, security or release CI.

## Limitations

This tool does not parse TypeScript import graphs, resolve runtime/dynamic dependencies, inspect external services, execute outage drills, infer deployment topology, or prove that an outage will occur. It reports declared workspace metadata only. Validate any high-impact result with package-specific tests and the required CI pipeline.
