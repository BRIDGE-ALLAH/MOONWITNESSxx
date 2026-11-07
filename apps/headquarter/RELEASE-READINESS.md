# Headquarter — Release Readiness & Scope Closure

**Review date:** 2026-11-08  
**Scope:** Headquarter engineering foundation and governance deliverables  
**Status:** foundation complete; production feature rollout remains gated by external contracts and browser verification.

## What is complete

- Structural and ownership baseline documented in `ARCHITECTURE.md`.
- ARSY browser transport boundary with timeout, cancellation, request IDs, safe error normalization, GET-only retry, and relative-path traversal protection.
- MOONWITNESS Observatory / Archive semantic token foundation in `packages/ui`.
- ARSY DECK reference feature with explicit synthetic fixture and no fake mutation capability.
- Navigation and administration IA with planned capabilities disabled.
- Native Node 24 test suite for ARSY client, ARSY DECK fixture, Decision Graph, and Scenario Forge.
- Repository CI and Headquarter Asset Integrity checks pass on the Phase 6 PR.
- CodeQL passed on the Phase 6 PR.

## Verified CI evidence

Phase 6 PR #38 head `c6b1022402475cdf25ab68e71b5be9a9b6d2e41b`:
- Repository Integrity passed.
- Headquarter API/fixture tests passed.
- Assets, shared UI, and Headquarter type-check passed.
- Headquarter production build passed.
- Asset source validation and registry tests passed.
- CodeQL passed.
- Full-workspace build was skipped by the optional `FULL_QUALITY_CI` condition; the next CI hardening change makes this a required gate.

## Explicitly outside this closure

These cannot be truthfully completed from the frontend repository without real platform contracts or a browser-capable validation environment:

- Identity/session, workspace, and permission integration.
- Live feature endpoints and append-only audit source.
- Browser E2E, manual screen-reader review, and visual regression.
- Staging/production secrets, deployment target, smoke test credentials, and rollback authority.
- Performance budgets based on an approved hosting/runtime baseline.

## Production promotion checklist

A module may move from prototype to production only when all applicable items are evidenced:

1. ARSY public API contract, owner, version, and schema tests.
2. Server-enforced workspace scope and authorization.
3. Source timestamp, freshness, provenance, and redaction rules.
4. Loading, empty, partial, stale, forbidden, and recovery states.
5. Unit, contract, browser E2E, accessibility, and responsive checks.
6. Observability, request correlation, retention, and incident owner.
7. Deployment smoke test and rollback procedure.

## Closure decision

The **Headquarter foundation workstream** can close when required workspace CI and the Phase 6 tests are green. This does not certify every prototype module as production-ready. External integration and UX validation remain tracked production gates, not hidden TODOs.


## Phase 7–8 foundations

- Decision Graph: graph schema, provenance/traceability assessor, invalid/expired evidence checks, and tests are implemented. UI and server-owned contracts remain future work.
- Scenario Forge: deterministic, immutable, shadow-only calculation engine and tests are implemented. Snapshot sourcing, scenario comparison UI, uncertainty model, and persistence remain future work.
- Both are deliberately read-only/pure at this stage and are not exposed as production-ready routes.

## Required full-workspace CI result

PR #43 head `44d5cb62413e2e03de89b46961439ea8953001b0`: Repository Integrity, Asset Integrity, full-workspace validation/build, and CodeQL all passed. The former optional `FULL_QUALITY_CI` gate has been removed.


## Current mainline update — 2026-11-08

**Observed main:** `1f16b12c77cab5f73a6d05fb1fbc4f12689a6f0b`.

- PR #154 has merged the authenticated, owner-scoped, read-only Docker Engine connector. ARSY persists connection metadata in PostgreSQL; remote TLS credentials are encrypted; Headquarter displays real Engine information and container inventory/logs through a server-side proxy.
- Exact PR-head verification passed: Docker/PostgreSQL integration, Headquarter browser E2E including reload/persistence, Repository CI including full workspace typecheck/build, Asset Integrity, Developer Experience, WITNESS FABRIC, CodeQL, and container image build.
- The delivered connector intentionally has no start/stop/exec/deploy operations. A configured local Docker socket is host-root-equivalent. The current fallback login limiter is not a distributed security boundary; shared login throttling remains a separate blocker tracked in Issue #123.
- The Money Maker workflows (opportunity, versioned product, asset, inspection, channel, listing, finance, payout/FX, shared login throttling, and portfolio metrics) remain on unmerged draft PR #126 and are not on main. Latest inspected head `1920e635...` is 116 commits ahead / 78 behind main, diverged and non-mergeable; exact-head checks are not registered. It still has a browser empty-payout locator mismatch, an Aftershock all-time vs selected-cohort window ambiguity, legacy RIOTWORKS styling on new product boards, and incomplete payout disputed-resolution integration coverage.
- UI/Assets package documentation and SVG/font governance corrections are merged; rendered accessibility/visual review, logo-owner approval, and redistribution licensing remain open.

## Current production promotion decision

**NO-GO.** No production target or deployment workflow, managed secrets, TLS/ingress, backup/restore, monitoring, rollback authority, production smoke-test credentials or verified production URL are evidenced. Do not equate CI/container build success with a production deployment. Root package version `1.0.11` also differs from the latest numbered changelog entry `1.0.0`; authoritative tag/release history must be reconciled before a version bump.


## Version and tag history verified — 2026-11-08

- Only tag currently listed: `v1.0.0`; latest stable GitHub Release is `v1.0.0` (published 2026-11-07).
- Tagged commit: `45b769c4639ee12d472655ed2dae858ecb6d1e44`; package manifest at tag: `1.0.8`.
- Current main package manifest: `1.0.11`; main is 450 commits ahead of the tag target. The changelog still has no numbered entries between `1.0.0` and Unreleased.
- The annotated tag is unsigned. Do not create a new release until the post-tag version policy, changelog scope, and production readiness are explicitly reconciled.
