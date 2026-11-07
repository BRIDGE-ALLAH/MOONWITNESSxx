# Review Design

## Approach
**Deep Review (staged):** repository structure -> git/WIP reconciliation -> manifests/workspace boundaries -> CI/hooks/scripts -> prior plan artifacts -> findings synthesis. No exhaustive runtime/security benchmark (evidence insufficient without running full suite).

## Architecture/Boundary Context (VERIFIED/INFERRED)
- Monorepo: pnpm workspaces (`apps/*`, `packages/*`); `services/*` intentionally excluded (`pnpm-workspace.yaml`). VERIFIED.
- Canonical topology per prior plan/docs intent: `apps/headquarter` (Next UI), `apps/arsy` (Fastify API), `packages/*` libs. INFERRED from manifests/plan; confirm in docs during execution.
- WIP indicates boundary cleanup in progress: `@riotworks/arsy` drops `@riotworks/ui` dep (good), `services/arsy` deleted (good if no refs), but README replaced by unrelated "Codex Super Autonomous v4.0" text (harmful).

## Evidence Sources
- Git: `status`, `diff --stat`, `show HEAD:*` comparisons.
- Manifests: root/app/package `package.json`, lockfile diff, workspace/turbo config.
- Automation: workflows, husky hooks, local scripts.
- Prior artifacts: `.plan/20261107-1900-plan-repository-maintenance/*`.

## Trade-offs
- **No command execution of full validation now:** dirty tree + missing referenced scripts in root `package.json`/CI may make runs noisy; record NOT RUN and require in execution plan.
- **WIP preservation:** treat current changes as candidate fixes needing verification, not as already-correct.

## Handoff
Ultra Plan must produce an executable `task.md` in a new `.plan/<ts>-plan-*` folder, resolve P0 WIP/documentation/manifest/CI-script mismatches first, then schedule build/type/test validation.
