# Review Rules (apply during execution of follow-up plan)

1. **Preserve unrelated WIP.** Do not revert staged/unstaged changes outside the active task (README, apps/arsy/package.json, package.json, pnpm-lock.yaml, services/arsy deletions, untracked .agents/.codex/.plan/AGENTS.md/GOAL.txt) unless the task explicitly requires reconciliation.
2. **Restore truth over templates.** Never replace project README with generic tooling README.
3. **One canonical owner per capability.** `apps/arsy` is the ARSY app; `services/arsy` is legacy/duplicate (already deleted in WIP) — verify no live references remain before committing.
4. **Backend must not depend on UI.** `@riotworks/arsy` must not depend on `@riotworks/ui`.
5. **Entrypoints must exist.** Every `main`/`exports`/script target in a package manifest must point to a real file or a deterministic command that works in the workspace.
6. **No fake green.** Do not use `|| true`, `echo *-skip` as default CI/repo gates unless explicitly marked optional and reported separately.
7. **Evidence before completion.** Record command, exit status, and key output in `report.md`. Label NOT RUN when not executed.
8. **Safety.** No push/deploy/production writes, no branch protection bypass, no destructive git operations. Do not touch unrelated user files.
9. **.plan contract.** Keep `task.md` executable and atomic; update `report.md` with deviations and evidence.
10. **Windows paths / PowerShell.** Use `-LiteralPath` for file ops when paths are fixed; avoid cross-shell destructive composition.
