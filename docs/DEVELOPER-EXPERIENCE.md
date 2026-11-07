# Developer Experience Playbook

This guide defines the shortest safe path from a fresh checkout to a verified change.

## Phase 1 — Fast, predictable local setup

Requirements are pinned in the root manifest: Node.js 20+ and pnpm 12.16.1.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run dev:doctor
pnpm run dev:headquarter
```

Use `pnpm run dev:doctor` first when setup behaves unexpectedly. It checks the runtime, package manager, workspace metadata, lockfile presence, and root-script recursion without installing extra dependencies.

## Phase 2 — Short feedback loops without hiding failures

| Intent | Command |
| --- | --- |
| Environment and script contract | `pnpm run dev:doctor` |
| Formatting gate | `pnpm run format:check` |
| Fast package + workspace validation | `pnpm run validate:fast` |
| Full repository validation | `pnpm run validate:repo` |
| Build all affected tasks through Turbo | `pnpm run build` |

Turbo owns dependency ordering and local task caching. Do not add broad cache outputs for lint/typecheck until the task actually writes deterministic artifacts. A cache hit must never substitute for a missing correctness check.

The old `format:check` script recursively called itself. It now invokes Prettier's non-mutating `--check` mode. `pnpm run format` is the explicit write/fix command.

## Phase 3 — Debuggable contributions and measured improvement

1. Start with the narrowest package command that covers the change.
2. Run `pnpm run validate:fast` before pushing.
3. Run `pnpm run validate:repo` for integration confidence.
4. In CI, inspect the failing task and its first actionable error; do not retry unexplained failures as a substitute for diagnosis.
5. Record task duration, cache hit/miss, flaky reruns, time-to-first-actionable-feedback, and review rework. Compare medians over a meaningful window; do not rank individual developers by commit count or AI usage.

## Proposed next DX experiments

- **Change-impact preview:** map changed paths to Turbo packages/tasks and show the exact checks that will run before execution.
- **Failure fingerprinting:** cluster recurring CI failures by normalized error signature and link the last known fix.
- **Proof-carrying PR:** attach a machine-readable manifest of commit SHA, executed commands, task outcomes, and artifact hashes. The server must independently verify required checks; a local manifest is evidence, not authorization.
- **Context capsule:** generate a small, privacy-reviewed handoff containing changed files, dependency edges, failing checks, and relevant docs for a human or coding agent.

These are experiments, not claims of novelty or completed capabilities. Adopt them only after measuring friction and verifying that they reduce time-to-correct-feedback without weakening quality.

## DX scorecard

Track system-level trends, not individual performance:

- Median time-to-first-actionable-feedback (local and CI separately).
- Median CI duration by task and cache hit rate.
- Flaky-test rate and rerun rate.
- Change failure / rollback rate.
- Review rework and time spent understanding unfamiliar packages.
- Developer-reported focus, friction, and cognitive load (small periodic pulse, with context).

Pair telemetry with developer feedback. Do not optimize one metric in isolation.
