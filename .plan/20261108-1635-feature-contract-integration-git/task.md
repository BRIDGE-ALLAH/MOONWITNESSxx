# Executable Checklist: Contract Integration & Git Commits

- [x] **Task 1: Add `@riotworks/contract` to Cockpit Dependencies** `[S]`
  - Path: `apps/cockpit/package.json`
  - Action: Add workspace dependency and run `pnpm install`.

- [x] **Task 2: Refactor Cockpit Libs to Consume Shared Contracts** `[M]`
  - Paths: `apps/cockpit/src/lib/telemetry.ts`, `apps/cockpit/src/lib/actions.ts`
  - Action: Import types from `@riotworks/contract`.

- [x] **Task 3: Run Full Test & Build Suite** `[S]`
  - Action: Verify `pnpm --filter @riotworks/cockpit test` and `type-check`.

- [x] **Task 4: Execute Atomic Git Commits** `[S]`
  - Action: Stage and commit in logical units following Conventional Commits.
