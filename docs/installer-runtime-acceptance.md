# Phase 4–5 Delivery Acceptance

This document records implementation scope for the installer and runtime lifecycle branch. It is not a claim that platform CI has passed; use the PR checks for evidence.

## Phase 4 — Developer installer

- [x] POSIX launcher: `install.sh` (Git executable mode 100755).
- [x] PowerShell launcher: `install.ps1`.
- [x] One shared Node CLI: `scripts/moonwitness.mjs`.
- [x] Profiles: minimal, Headquarter, ARSY, full-dev.
- [x] Doctor, install, repair, update, verify, uninstall.
- [x] Frozen lockfile always; optional offline mode; dry-run.
- [x] Preserve existing `.env`; copy template only if absent.
- [x] Restrict permissions on generated `.env` and state metadata where supported.
- [x] Uninstall removes only installer-owned metadata; dependencies, secrets, source, and volumes are preserved.
- [x] Unit tests for parsing, profile plans, secret-name inventory, dry-run, and safe uninstall.
- [x] Cross-platform CI on Linux/macOS/Windows passed on pre-sync commit `9269bcb716390f9e9ff30a98260d0658d47c354c` in [run 42399313514](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42399313514). Re-run on the latest merge-synced head before final acceptance.
- [ ] Maintainer review of supported Node/pnpm versions and Windows behavior.

## Phase 5 — Runtime and deployment lifecycle

- [x] ARSY configurable local port and container-stable port.
- [x] ARSY liveness and database readiness endpoints.
- [x] Fastify graceful shutdown closes the HTTP server and database pool.
- [x] Compose health checks for PostgreSQL, Redis, ARSY, and Headquarter.
- [x] Runtime doctor, preflight, health, and privacy-safe passport commands.
- [x] Preflight refuses production mode for the development-only Compose stack.
- [x] Risk score helper for blast radius, irreversibility, and uncertainty; no automatic remediation.
- [x] Operational Twin research and design notes.
- [ ] Run Compose config validation and full service smoke test with Docker available.
- [ ] Add an isolated PostgreSQL restore drill and prove application-level data invariants.
- [ ] Define a production-specific deployment profile, immutable image digests, backup policy, and explicit migration approvals.
- [ ] Test interrupted startup, SIGTERM, PostgreSQL outage, Redis outage, and recovery.

## Safety boundary

No production deployment, database migration, volume deletion, secret rotation, or automated rollback is performed by these scripts. The Compose stack remains development-only. A passing container health check is not proof of backup recoverability or migration reversibility.
