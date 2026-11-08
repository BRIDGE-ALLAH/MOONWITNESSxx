# WITNESS FABRIC — Execution Record

**Date:** 2026-11-08  
**Historical implementation:** `feat/moonwitness-brand-identity-v1`  
**Current runtime follow-up:** Issue #224 / `feat/arsy-evidence-ledger-runtime-20261108`

This file preserves the historical implementation record below. The current runtime work is recorded in the addendum at the end; historical status statements are not retroactively rewritten as if the runtime integration existed at the time.

## Historical milestones

The original WITNESS FABRIC library delivered typed append-only events, deterministic replay, policy-gated action lifecycle, Claim Genome, counterfactual sensitivity, Reality Drift Radar, bitemporal query, Ed25519 checkpoint and Evidence Flight Recorder. The library remains a deterministic in-memory package.

ARSY separately delivered an `EvidenceLedger`, a PostgreSQL adapter, and migration 001, but those components were not registered in the ARSY HTTP runtime. The follow-up issue #224 closes that runtime wiring gap without introducing a second database or moving identity/tenant ownership into the library.

## Runtime integration addendum — 2026-11-08

**Status:** Exact-head CI and PostgreSQL E2E verified on `115da8e480f04123d3eb8b58e4e52c2b500c3ab1`; PR #226 is Ready for review; independent security review remains pending.

### Implemented in the candidate branch

- Register authenticated ARSY routes for evidence append, list, and hash-chain verification.
- Derive event actor from the authenticated ARSY operator principal; reject caller-supplied `actorId`.
- Derive an opaque storage stream key from operator ID + logical aggregate ID. This isolates operators while preserving the logical aggregate ID in the event body/hash.
- Preserve the existing PostgreSQL advisory transaction lock and expected previous-hash check for cross-process writer coordination.
- Add migration 007 with database triggers that reject UPDATE, DELETE, and TRUNCATE.
- Add a PostgreSQL integration test for authentication, actor spoofing, idempotent replay, conflicting event IDs, operator isolation, stale writer rejection, restart persistence and direct SQL mutation rejection.
- Keep migration ownership with deployment/System Mode; no startup DDL or production data changes.

### Verified on exact head

- [x] ARSY package/runtime tests.
- [x] Disposable PostgreSQL integration: 86 tests, 86 passed, 0 failed; includes restart persistence, operator isolation, direct SQL mutation rejection and concurrent idempotent requests across two ARSY instances.
- [x] Full Repository CI and workspace typecheck/build.
- [x] CodeQL.
- [x] ARSY + Headquarter container build.
- [x] Headquarter Docker browser E2E.
- [x] ORACLE Compose service-to-service E2E.

Evidence:
- [Repository CI](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42465792529)
- [PostgreSQL integration](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42465792538)
- [CodeQL](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42465792631)
- [Container build](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42465792533)
- [Headquarter browser E2E](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42465792511)
- [ORACLE Compose E2E](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42465792651)

### Still pending

- [ ] Independent security review of operator scoping and database trigger/role boundary.
- [ ] Bounded pagination/retention and production backup/restore.
- [ ] Production database migration, production configuration and deployment verification.

### Explicit non-goals

- No automatic mapping between the WITNESS FABRIC package event vocabulary and ARSY's event vocabulary.
- No Headquarter evidence graph/timeline UI.
- No source fetching, claim extraction, or external side effects.
- No production migration, version bump, tag, release, or deployment.
