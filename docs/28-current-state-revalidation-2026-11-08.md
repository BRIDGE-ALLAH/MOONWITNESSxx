# Repository Revalidation — 2026-11-08

**Repository:** BRIDGE-ALLAH/MOONWITNESS  
**Default branch:** main  
**Verified HEAD:** ecb4faf2b85a24f07db2c2a5685ca04d627254f8  
**Purpose:** Replace stale repository-state assumptions with a current, evidence-based baseline. This is a point-in-time audit, not a claim that all roadmap items are complete.

## 1. Mainline and merged work

- PR #79 merged as 3e9db048eef0698f56c14543dbf2afc83a534247: ARSY Phases 18–20 security hardening.
- PR #81 merged as 1bfbae285c2871985487882b4c4ec42915bf422b: Developer Experience Phases 33–35.
- PR #81 pre-merge CI: Repository Integrity, Asset Integrity, WITNESS FABRIC, Developer Experience, Full Workspace Typecheck/Build, and CodeQL all succeeded. Its three new CLI smoke tests succeeded.
- PR #75 and PR #80 are closed and unmerged; PR #82 superseded #80 and is now merged.
- PR #78 is merged. Its first CI attempt exposed a missing blockedWithoutSignal metric; the metric and regression assertion were fixed, then current-head Repository CI, full workspace typecheck/build, and CodeQL passed before merge.
- Phase numbers are scoped per subsystem, not globally unique; ARSY Core Phases 33–35 and DX Phases 33–35 are separate implementations.

## 2. Current open PR gate

At audit time, PRs #78 and #82 have both been merged after resolving their integration/typecheck issues. Older ORM/database PRs (#15–#41) and Dependabot PRs remain a dependency-ordered review queue. Their titles or historical green checks are not proof that their current diffs are safe against present main.

PR state changes quickly; always re-fetch head SHA, current-base diff, mergeability, reviews, and current CI before integration.

## 3. Architecture and consistency findings

### Developer Experience
DX Phases 33–35 are now on main:
- Adaptive Swarm Topology: detects declared overlapping write paths, shared mutable resources, and interface coupling; emits an advisory topology recommendation.
- Autonomy Thermostat: maps risk/evidence/interface/collision signals to bounded capability recommendations; never grants merge, deploy, secret access, permission changes, or destructive production write.
- Counterfactual Incident Compiler: creates a bounded data-only replay specification, dependency closure, fault variants, and deterministic SHA-256 digest.

These tools are advisory. They do not schedule agents, enforce trusted authorization, execute integrations, or authenticate evidence.

### ARSY runtime
The current source exposes a Fastify root response and a database health route, but the runtime/container contract is inconsistent:
- apps/arsy/src/index.ts listens on port 3000.
- docker-compose.yml maps host port 3001 to container port 3001 and probes port 3001.
- Dockerfile.arsy starts pnpm dev, not the application production start command.
- apps/arsy/package.json delegates its start script to @riotworks/arsy-core, whose own Fastify CLI command is configured for port 3000. The application composition root is apps/arsy, so this delegation requires correction.
- apps/arsy/package.json still has "lint": "echo lint-skip"; this can make a workspace lint task appear successful without linting ARSY.
- apps/arsy/src/db.ts exposes database health, but uses untyped Fastify decoration and process signal handlers rather than a verified application lifecycle plugin.

These are concrete release blockers. Correct them with a focused runtime/contract change and regression coverage; do not merely update documentation.

### Configuration and containers
- .env.docker contains POSTGRES_PASSWORD=postgres.
- Compose also defaults POSTGRES_PASSWORD to postgres.
- PostgreSQL and Redis host ports are published without an explicit loopback bind.
- Compose defaults NODE_ENV to development and mounts source directories into services.
- Dockerfile.arsy is a development-oriented runtime as currently configured.
- No production deployment workflow, configured production environment, production URL, or verified health/readiness target was found in the inspected repository configuration.

Do not deploy the current Compose setup as production. Separate local-development and production runtime profiles, remove weak defaults, restrict data-service exposure, use the correct production start command, and add verified liveness/readiness checks before release.

## 4. Release metadata

- Root package.json version is 1.0.11.
- CHANGELOG.md only documents 1.0.0.
- The authoritative previous tag/release and compare range were not verified through the available repository actions.
- No tag or GitHub Release was created in this work.
- No production deployment or production smoke test was run.

**Release readiness: NO-GO.** A version bump alone would conceal the missing compare-range, runtime, security, deployment, rollback, and production-health evidence.

## 5. Headquarter UX baseline

The existing Headquarter audit identifies 12 original page routes and later governance/decision/scenario routes. The product remains a prototype surface:
- Several feature pages use local/static demo data; no live ARSY feature contract is connected for the main demo modules.
- Authentication, authorization, persisted workspace selection, and route-aware locale are not established.
- Demo disclosure is inconsistent across legacy feature pages.
- Shared loading, empty, error, forbidden, offline, stale, and partial-data states are incomplete.
- Browser-level responsive, keyboard, screen-reader, contrast, and visual regression evidence remains outstanding.
- The Headquarter TODO still contains unchecked structural and UX tasks; do not interpret the checked inventory as proof of end-to-end completion.

Preserve existing URLs and shared UI tokens. Prioritize demo/data truth, accessibility, responsive verification, and lifecycle-state completeness before adding new navigation or visual systems.

## 6. Research basis for DX 33–35

- Soei, arXiv:2610.39468 (2026-10-29): structured observability and explicit separation between completion claims and independent proof. The study corpus is limited; its rates are not universal prevalence. https://arxiv.org/abs/2610.39468
- PASC, ESEM 2026, DOI 10.4230/LIPIcs.ESEM.2026.18: peer-aware action-space coordination for two agents; the reported scaling warning motivates a conservative default, not a universal concurrency law. https://doi.org/10.4230/LIPIcs.ESEM.2026.18
- Practitioner reports on integration failure after ordinary CI are anecdotal and were treated as problem signals, not benchmark evidence. https://www.reddit.com/r/devsecops/comments/1vzbpln/coding-agents-shifted-the-bottleneck-to/

## 7. Next safe execution order

1. Fix ARSY runtime port/start/lint contract and Docker Compose development-vs-production safety.
2. Add ARSY health/readiness and Headquarter browser accessibility/responsive checks.
3. Reconcile ORM/database PR ancestry and run compatibility tests against current main.
4. Reconcile version/tag history and changelog, then establish a real production target, secrets, backups, rollback, deployment workflow, and smoke tests.
5. Only then declare a stable release candidate.

## Audit limitations

This revalidation used the GitHub repository/API surfaces and CI evidence available in this session. It did not perform a local full clone, run Docker, access production credentials/infrastructure, inspect a live deployed application, or perform manual browser/screen-reader testing. Those checks remain explicitly unverified.
