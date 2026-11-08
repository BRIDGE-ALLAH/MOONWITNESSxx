# Executable Checklist: Gate Universe Navigation

- [x] **Task 1: Verify and Update Experience Registry & URLs** `[S]`
  - Path: `apps/gate/src/app/page.tsx`
  - Action: Update `EXPERIENCES` to reflect active status and live operational URLs (Cockpit on `:3002`, Headquarter on `:3000`, Gate on `:3001`).
  - Acceptance: Cockpit card links to `http://localhost:3002`, status reflects Operational NOC.

- [x] **Task 2: Enhance Universe Navigation & Card Interactivity** `[M]`
  - Path: `apps/gate/src/components/UniverseCard.tsx`
  - Action: Add keyboard-accessible interaction, target indicator tooltips, and explicit domain badges.
  - Acceptance: Clean keyboard focus, accessible link tags, no dead clicks.

- [x] **Task 3: Implement Automated Contract & E2E Validation Tests** `[S]`
  - Path: `apps/gate/tests/gate-universe.test.mjs`
  - Action: Add integration test verifying all 9 experiences, valid ports, and UI component exports.
  - Acceptance: `pnpm --filter @riotworks/gate test` passes 100%.

- [x] **Task 4: Build Verification and Typecheck** `[S]`
  - Action: Run `type-check` and `build` on `@riotworks/gate`.
  - Acceptance: 0 errors, static bundle generated.
