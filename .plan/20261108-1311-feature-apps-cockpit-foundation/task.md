# Executable Checklist: COCKPIT Foundation

- [x] **Task 1: Scaffold Cockpit App Structure** `[S]`
  - Paths: `apps/cockpit/package.json`, `apps/cockpit/tsconfig.json`, `apps/cockpit/next.config.ts`, `apps/cockpit/tailwind.config.ts`
  - Acceptance: Clean setup in monorepo workspace.

- [x] **Task 2: Setup Rust Desktop Backend (`src-tauri`)** `[M]`
  - Paths: `apps/cockpit/src-tauri/Cargo.toml`, `apps/cockpit/src-tauri/src/main.rs`, `apps/cockpit/src-tauri/tauri.conf.json`
  - Acceptance: Valid Cargo setup with Rust IPC commands for system telemetry.

- [x] **Task 3: Build Operator UI Dashboard** `[M]`
  - Path: `apps/cockpit/src/app/page.tsx`, `apps/cockpit/src/components/*`
  - Acceptance: Live cluster telemetry, service health grid (ARSY, ORACLE, DB, RADIUS), log stream, and operator action dispatch.

- [x] **Task 4: Add Contract Tests & Verification** `[S]`
  - Path: `apps/cockpit/tests/cockpit-contract.test.mjs`
  - Acceptance: Tests pass 100%, type-check passes, Prettier passes.
