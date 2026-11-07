# MOONWITNESS Product Integrity — Phases 36–38

**Date:** 2026-11-08  
**Scope:** runtime ownership, Headquarter data-truth UX, and machine-checkable product/release integrity.

## Phase 36 — ARSY Runtime Ownership & Lifecycle

The ARSY runtime remediation establishes the correct app/core boundary. This integration adds the application factory, typed database-pool injection, Fastify-owned cleanup, cached readiness probes and failure-safe health responses. Database checks are bounded to a five-second refresh interval rather than allowing every public health request to issue a query.

The local container profile requires an explicit password, binds service ports to loopback, and runs dev commands only as a Compose override. The production Dockerfile uses the app's start command.

**Boundary:** this is runtime hardening, not proof of production secrets, managed databases, backups, TLS, deployment or live service health.

## Phase 37 — Persistent Headquarter Data-Truth Disclosure

The navigation registry marks current routes as prototypes, but the sidebar is hidden on narrow screens until opened. A localized, accessible `role=status` badge is now present in the persistent topbar. It explicitly identifies the workspace as prototype/demo data across mobile and desktop.

This reduces the chance that static metrics, placeholder accounts and synthetic financial rows are mistaken for live business state.

## Phase 38 — Workspace, Navigation & Release Preflight

Added `pnpm devx product-audit --json` to check:
- Workspace package-name uniqueness and `workspace:*` dependency resolution.
- Placeholder scripts that mask successful execution.
- ARSY/core ownership and forbidden backend-to-UI dependencies.
- Headquarter navigation-to-route coverage and explicit prototype status.
- Persistent, semantic demo disclosure.
- SemVer syntax, a non-empty Unreleased changelog, release/deploy workflow presence, production container entrypoints and Compose health checks.

The release preflight distinguishes local repository evidence from remote production evidence. It cannot verify remote tags, published GitHub Releases, deployment provider state, secrets, live health or smoke tests.

## Research and prior art

1. **Lineage-Aware Memory Governance**, IEEE Access (3 Sep 2026): derivation-aware retrieval gates access using every source field behind a derived artifact. https://doi.org/10.1109/ACCESS.2026.3730363
2. **Revoked but Still Authoritative** (arXiv:2609.08258): tests stale/revoked facts across five memory systems and motivates read-time revocation enforcement. https://arxiv.org/abs/2609.08258
3. **A Benchmarking Method for the Integrity of AI Agent Memory at Rest**, active IETF Internet-Draft (Nov 2026): proposes reproducible mutation, replay, rollback and backup-restore tests. This is work in progress, not an RFC. https://datatracker.ietf.org/doc/html/draft-khandelwal-bpm-agent-memory-integrity-00
4. **Engineering Agentic Systems: Toward Verification-First AIware Engineering**, IEEE Software (Sept–Oct 2026): makes verifiability a first-class design objective. https://doi.org/10.1109/MS.2026.3697911
5. GitHub trend snapshots (6–7 Nov 2026) show adoption of persistent memory and code knowledge graphs: claude-mem, Graphify, ECC, Hindsight and FailproofAI. Star velocity is attention, not proof of quality or security. https://github.locker/topics/agent-observability
6. Reddit practitioners report stale context overriding newer project state and requiring manual cleanup. These are anecdotal signals, not controlled studies. https://www.reddit.com/r/aiagents/comments/1wotyiq/how_are_you_handling_stale_context_in_agent_memory/ and https://www.reddit.com/r/AI_Agents/comments/1wg41et/the_memory_trust_gap_why_your_agent_acts_on_stale/

## Innovation decisions
- **Accepted:** unify static workspace contracts, navigation truth and release blockers in one dependency-free local audit.
- **Accepted:** use a cached readiness signal to avoid unbounded database work from public health probes.
- **Deferred:** authenticated production health attestation, signed deployment provenance and provider adapters until a real deployment target and identity boundary exist.
- **Rejected:** treating a successful build as proof of a production release.

No world-first claim is made; the value is the integration and reproducible verification.
