# Plan Rules

1. **Preserve unrelated WIP.** Do not revert staged/unstaged changes outside the active task (README content restoration, apps/arsy/package.json removal, prior plan repair) unless the task explicitly requires reconciliation.
2. **Restore truth over templates.** README.md must be restored with original RIOTWORKS content — do not replace with generic Codex framework text.
3. **One canonical owner per capability.** `apps/arsy` is the ARSY app; `@riotworks/ui` must not be in its dependencies per AUD-003.
4. **Entrypoints must exist.** Every `main`/`exports`/script target in a package manifest must point to a real file or a deterministic command that works in the workspace.
5. **No fake green.** Do not use `|| true`, `echo *-skip` as default CI/repo gates unless explicitly marked optional and reported separately.
6. **Evidence before completion.** Record command, exit status, and key output in `report.md`. Label NOT RUN when not executed.
7. **Safety.** No push/deploy/production writes, no branch protection bypass, no destructive git operations. Do not touch unrelated user files.
8. **.plan contract.** Keep `task.md` executable and atomic; update `report.md` with deviations and evidence.
