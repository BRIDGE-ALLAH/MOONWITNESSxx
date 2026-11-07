# MOONWITNESS Product Integrity — Phases 36–38

**Date:** 2026-11-08  
**Branch:** `fix/arsy-product-integrity-current-main`  
**Scope:** ARSY runtime ownership, Headquarter data-truth UX, and machine-checkable release readiness.

## Phase 36 — ARSY Runtime Ownership & Container Correctness

### Verified defects
- `apps/arsy` delegated build and start to `@riotworks/arsy-core`, despite the core package explicitly describing itself as framework-neutral.
- The app's listener hard-coded port 3000 while Docker Compose exposed and health-checked 3001.
- The ARSY Dockerfile started `pnpm dev` after a build, so the container did not use the compiled production entrypoint.
- `apps/arsy` declared `lint: echo lint-skip`, a success-shaped command that did no linting.

### Implemented correction
- The ARSY application owns its build/type-check command and production start entrypoint; its HTTP composition is isolated in an injectable Fastify app factory.
- The framework-neutral core package no longer advertises app-level `build`, `start`, or `dev` scripts.
- Runtime host/port are validated through one resolver; the host defaults to loopback and Compose explicitly binds `0.0.0.0` inside the container.
- The Dockerfile starts the ARSY application entrypoint in production mode after its build/type-check gate.
- The misleading lint success stub was removed; type-check remains an actual gate.
- Docker Compose health checks use Node's built-in `fetch`, avoiding an undeclared `curl` dependency in Alpine images.

**Boundary:** this fixes the container's command/port contract; it does not prove a production database migration, live credentials, external ingress, secrets, backups, or a running deployment.

## Phase 37 — Persistent Headquarter Data-Truth Disclosure

The navigation registry already labels every current route as a prototype, but that signal was primarily in the sidebar. The sidebar is hidden on narrow screens until opened, and individual pages had inconsistent or missing demo labels.

A persistent, localized, accessible warning badge is now placed in the topbar. It remains visible on mobile and desktop and explicitly identifies the workspace as prototype/demo data. This prevents static metrics, placeholder accounts and synthetic financial rows from being mistaken for live business state.

**Boundary:** no live API, authentication, account connection, financial record or marketplace publication is implied.

## Phase 38 — Workspace, Navigation & Release Preflight

Added `pnpm devx product-audit --json` to check:
- Workspace package-name uniqueness and every `workspace:*` dependency.
- Placeholder scripts that mask success.
- ARSY/core ownership and forbidden backend-to-UI dependencies.
- Headquarter navigation-to-route coverage and explicit prototype status.
- Persistent demo disclosure accessibility.
- SemVer syntax, a non-empty Unreleased changelog, release/deployment workflow presence, production container entrypoint and compose health checks.

The release preflight deliberately distinguishes local repository evidence from remote production evidence. It cannot verify remote tags, published GitHub Releases, deployment provider state, secrets, live health or smoke tests. A dedicated `.github/workflows/container-build.yml` now validates Compose syntax and builds both production images on pull requests and main pushes.

## Research and prior art

1. **Lineage-Aware Memory Governance**, IEEE Access (3 Sep 2026): derivation-aware retrieval gates access using every source field behind a derived artifact. https://doi.org/10.1109/ACCESS.2026.3730363
2. **Revoked but Still Authoritative** (arXiv:2609.08258): evaluates stale/revoked facts across five memory systems and motivates read-time revocation enforcement. https://arxiv.org/abs/2609.08258
3. **A Benchmarking Method for the Integrity of AI Agent Memory at Rest**, IETF Internet-Draft (Nov 2026): proposes reproducible mutation, replay, rollback and backup-restore tests. This is an Internet-Draft, not a published RFC. https://datatracker.ietf.org/doc/html/draft-khandelwal-bpm-agent-memory-integrity-00
4. **Engineering Agentic Systems: Toward Verification-First AIware Engineering**, IEEE Software (Sept–Oct 2026): argues for making verifiability a first-class design objective. https://doi.org/10.1109/MS.2026.3697911
5. GitHub trend snapshots (6–7 Nov 2026) show strong adoption of persistent memory and code knowledge graphs: claude-mem, Graphify, ECC, Hindsight and FailproofAI. Star velocity is attention, not proof of quality or security. https://www.cihangirbozdogan.com/tools and https://github.locker/topics/agent-observability
6. Reddit practitioners report stale context overriding newer project state and requiring manual cleanup. These are anecdotal signals, not controlled studies. https://www.reddit.com/r/aiagents/comments/1wotyiq/how_are_you_handling_stale_context_in_agent_memory/ and https://www.reddit.com/r/AI_Agents/comments/1wg41et/the_memory_trust_gap_why_your_agent_acts_on_stale/

## Innovation decisions

- **Accepted:** combine static contract checks, navigation truth checks and release blockers into one local product-integrity audit.
- **Accepted:** keep runtime config validation dependency-free and test it using Node's built-in test runner.
- **Deferred:** authenticated production health attestation, signed deployment provenance and live provider adapters until the repository has a real deployment target and credential/identity boundary.
- **Rejected:** declaring a stable production release from a successful build alone. Current workflows do not include a release publisher or production deployment job.

No world-first claim is made. The value is the integration of repository ownership, user-facing truth signals and fail-closed release readiness into one verifiable workflow.


## Next high-value research experiments (proposed, not implemented)

### A. Provenance-closure retrieval gate
For each derived memory or decision, persist the source lineage graph and the policy-relevant attributes of every ancestor. Before retrieval, require that every ancestor remains current, permitted for the requesting principal/tenant, and non-revoked. If lineage is incomplete, quarantine or return the item as unverified rather than treating it as authoritative. Benchmark lineage completeness, false denials, leakage, retrieval latency and policy coverage; the IEEE result is conditional on complete lineage and should not be copied as a universal threshold.

### B. Durable revocation and restore-resurrection benchmark
Keep revocation/tombstone state in a monotonic ledger whose head is anchored outside the content database. Add backup/restore tests that restore an older full-store snapshot after a revocation or erasure and verify that the deleted record cannot become authoritative again. Include the IETF draft's rollback and erasure-resurrection cases as a test design reference, not as a normative standard. Measure detection at read time separately from later audit-only detection.

### C. Negative-decision receipts and proof-bound release
Persist a compact receipt for meaningful no-op decisions: candidate, evidence checked, reason code (insufficient evidence, duplicate, stale context, policy conflict), owner, expiry, and invalidation trigger. This prevents repeated research without turning a past no-op into permanent truth. Separately bind each release claim to the exact commit SHA, CI check-run IDs, artifact digest, deployment receipt and post-deploy smoke result. A successful build alone must never produce a production-success state.

These are proposals. They require threat modelling, privacy/retention review, benchmark fixtures and an owner before implementation.


## Runtime security follow-up

The database readiness and database health routes use Fastify rate limiting (60 requests per minute per client). The implementation is covered by runtime tests for HTTP 429 responses. This is per-process in-memory limiting; production deployments behind a proxy must configure trusted proxy addresses deliberately, and multi-replica global limits remain a separate deployment concern.


## Release metadata gate

The product preflight now compares the root package SemVer with the latest numeric release heading in CHANGELOG.md. A mismatch is a release blocker; do not guess or bump versions until the authoritative previous tag/release and monorepo version policy have been verified.


Current repository finding: root package version is 1.0.11 while the latest numeric CHANGELOG heading is 1.0.0. The product preflight flags this as a release blocker; no version bump or tag is made until the authoritative release history and version policy are confirmed.
