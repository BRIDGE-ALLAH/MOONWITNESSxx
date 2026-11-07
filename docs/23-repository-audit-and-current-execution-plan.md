# 23 — Repository Reality Audit & Current Execution Plan

**Status:** Authoritative execution baseline | **Version:** 2.0 | **Audited:** 2026-11-07  
**Audited repository:** https://github.com/BRIDGE-ALLAH/MOONWITNESS  
**Audited branch/commit:** main / 70a7a3fe2b3b2757c71d592a721470c34695cc98

> This document supersedes earlier assumptions about repository implementation status and execution order. It does not erase the historical design decisions in docs/01–22. If an older document describes a target package as already implemented, this audit's inventory is authoritative.

## 1. Executive decision

MOONWITNESS is the canonical repository. RIOTWORKS is a product/business division within it, not a separate repository target for future work.

The repository currently contains:
- a substantial product, business, design and technical documentation baseline (docs/01–22);
- an early pnpm/Turborepo monorepo;
- a minimal Next.js-shaped Headquarter UI prototype;
- a minimal Fastify ARSY route prototype;
- several early utility packages (UI, types, policy, notifications, feature flags, seed data);
- a BullMQ prototype and a second, conflicting services implementation;
- Git hooks and GitHub automation that need repair before they can be trusted.

It does **not** yet contain the custom ORM, database runtime, SQL adapters, Base Platform addon suite, production ARSY core, complete Headquarter, or a proven commercial workflow. Architecture docs are target contracts, not implementation evidence.

**Execution priority:** first reconcile repository structure and make the existing monorepo reproducibly buildable. Do not start the 17-addon Base Platform or a broad UI build before the foundation is healthy.

## 2. Snapshot and evidence

At the audit snapshot:
- Default branch: main.
- HEAD: 70a7a3fe2b3b2757c71d592a721470c34695cc98.
- Recursive Git tree: 121 entries; tree response was not truncated.
- Open GitHub issues: 0.
- Open pull requests: 0.
- Latest commits include a merge of the RIOTWORKS documentation line into MOONWITNESS, followed by local automation commits for Wiki/Pages assets, version/changelog hooks, auto-detection and Kilo Gateway commit-message generation.

This is a repository inspection, not a local execution of pnpm install/build/test. No build or test result is asserted by this audit.

## 3. Actual repository inventory

### 3.1 Applications

| Path | Observed state | Audit finding |
|---|---|---|
| apps/headquarter | Next.js App Router app, layout, page, Tailwind config and next.config.ts | At the original audit snapshot, the manifest described Fastify. **That mismatch has since been corrected**: current source declares Next.js/React and Next scripts. The stale home-page architecture copy was also corrected in the Headquarter Phase 1 change. See `apps/headquarter/AUDIT.md`. |
| apps/arsy | Fastify app with one / status route | Minimal prototype. It imports @riotworks/arsy-core, but that package has no implementation entrypoint in the current tree. It imports UI unnecessarily. Server starts directly on port 3000; no config/lifecycle/DB/ORM/auth/route composition yet. |

### 3.2 Actual packages

| Path | Observed state | Decision |
|---|---|---|
| packages/arsy-core | Manifest only; no src/index.ts or implementation files in tree | Implement as shared Fastify platform core; do not let it become a second app. |
| packages/ui | Small shared component library (button, badge, card, separator and utilities) | Keep as UI-only package; expand only against the design system. |
| packages/types | Package manifest and small src/index.ts | Keep framework-neutral; verify real exports and scripts. |
| packages/contract | Manifest only | Add runtime request/response/event contracts and exports. |
| packages/lint | Manifest only | Repair shared tooling; it is not a runtime package. |
| packages/policy | Manifest and small source entrypoint | Keep as ZILL policy domain only if boundaries and tests are made explicit. |
| packages/notifications | Manifest and source entrypoint | Keep as delivery service/contract; avoid overlap with communication and event ownership. |
| packages/feature-flags | Manifest and source entrypoint | Keep technical feature-flag evaluation separate from user preferences and business settings. |
| packages/seed-data | Manifest only in visible tree | Demo/seed tooling only; never production business data. |
| packages/bullmq | Early queue prototype with producer/job/worker files | Treat as experimental transport code, not the canonical job domain or source of truth. |

### 3.3 Duplicate/stranded service implementations

The services directory exists in Git but is not included by the root pnpm-workspace.yaml, which currently includes only apps/* and packages/*.

- services/arsy duplicates the ARSY application under apps/arsy.
- services/queue duplicates queue submission responsibilities already present in packages/bullmq.
- services/arsy/index.ts imports ./queue, but no corresponding services/arsy/queue file appears in the tracked tree.
- The queue package and service expose inconsistent function names and payload shapes.
- Do not add services/* to the workspace just to make these duplicates active.

**Decision:** apps/arsy is the only HTTP backend application. Queue contracts/transport belong in packages; a separately deployed worker, if required, will be apps/worker. First extract any unique useful behavior from services/, then archive/remove duplicate service code in a deliberate cleanup task. Do not delete it before verifying whether local unpushed work depends on it.

### 3.4 Missing target packages

The following architecture packages are documented but do not exist in the audited tree:
- packages/orm
- packages/orm-db
- packages/orm-db-adaptor
- packages/orm-db-adaptor-libsql
- packages/orm-db-adaptor-postgres
- packages/orm-addon-base
- packages/orm-addon-project
- packages/orm-addon-intelligent

This is expected unfinished work, not evidence that the docs are wrong. Do not create empty directories or placeholder packages and call them implemented.

## 4. Confirmed consistency defects and risks

| ID | Severity | Finding | Required correction |
|---|---|---|---|
| AUD-001 | Critical | **Resolved after the original audit snapshot:** Headquarter package manifest previously described Fastify while source was Next.js | Current `apps/headquarter/package.json` declares Next.js/React and Next build/type-check scripts. Keep the manifest aligned with the App Router application. See `apps/headquarter/AUDIT.md`. |
| AUD-002 | Critical | ARSY imports arsy-core, but arsy-core has no source entrypoint in tracked tree | Implement core factory/lifecycle or remove the false dependency until ready. |
| AUD-003 | Critical | apps/arsy depends on @riotworks/ui | Remove UI from backend dependency graph. |
| AUD-004 | Critical | services/arsy duplicates apps/arsy and references a missing local queue module | Make apps/arsy canonical; extract useful behavior then retire duplicate. |
| AUD-005 | High | services/* is outside pnpm workspace globs | Keep it out; resolve/retire it rather than silently activating a second app topology. |
| AUD-006 | Critical | README/master architecture lists ORM/adapter packages that are not implemented | Label them as planned; update status from code evidence only. |
| AUD-007 | High | Root scripts reference inconsistent/missing package scripts and mix background shell processes | Define a single deterministic task graph; use Turbo task dependencies and fail-fast commands. |
| AUD-008 | High | apps/headquarter page has stale apps/web text | Replace with Headquarter/ARSY architecture wording. |
| AUD-009 | High | BullMQ prototype duplicates queue/service concerns and has inconsistent APIs | Define one queue port, typed job contracts, one adapter and one worker owner; validate BullMQ version compatibility before reuse. |
| AUD-010 | Critical | .husky/pre-commit performs version/changelog mutations and optional network AI generation | Pre-commit must be local, deterministic, fast, and must not call paid/external AI or mutate release versions. |
| AUD-011 | High | Pre-commit suppresses lint/type errors with || true | Required checks must fail the commit; optional checks must be explicit and separately reported. |
| AUD-012 | Critical | scripts/auto-detect.js hardcodes REPO='RIOTWORKS' | Use repository metadata/env with MOONWITNESS as default; deduplicate findings and never create issue spam. |
| AUD-013 | Critical | Auto-detection code has incomplete checks and suspicious/incomplete control flow; it must pass syntax and fixture tests before execution | Rewrite as small deterministic scanners; test no-finding, duplicate, and API-failure cases. |
| AUD-014 | Critical | Weekly workflow has malformed step syntax, wrong cd RIOTWORKS, npm cache for pnpm, and references a report that is not generated | Rewrite workflow from repository root; validate YAML and workflow expressions; generate report before publishing. |
| AUD-015 | High | Changelog/version automation is coupled to every commit | Adopt release-time versioning (Changesets or equivalent); root and package version policies must be explicit. |
| AUD-016 | High | .env.example contains stale RIOTWORKS-only labels and automation credentials without a clear threat model | Document variable ownership; never require GitHub/Kilo secrets for local build/test. |
| AUD-017 | High | Docs 08/15/18/19/21 contain historical three-field BaseEntity text alongside later five-field clarification | Normalize all canonical sections to the five-field contract; remove contradictory old statements. |
| AUD-018 | High | Base platform addon suite is specified but no registry/manifest/ORM implementation exists | Implement only after ORM/schema foundation; stage required vs optional addons. |
| AUD-019 | High | Root pnpm-workspace.yaml omits services intentionally, but docs do not explain this | Record canonical apps/packages topology and worker future placement. |
| AUD-020 | Medium | Commit generator writes temp artifacts and suggests a Kilo model/key as part of pre-commit | Keep AI commit assistance optional, explicit, offline fallback; generated files must not be silently staged. |
| AUD-021 | High | Package scripts in several manifests point to absent source/config or another package's scripts | Audit every manifest main, exports, and script against actual tracked files. |
| AUD-022 | Medium | Documentation Wiki/Pages generation currently produces only local docs assets, not proof of a published Wiki or Pages site | Treat docs as source; deploy/publish only through a validated explicit workflow. |
| AUD-023 | High | .copilot-instructions.md still describes a different local path and apps/web, and forbids root config changes even when required | Replace with canonical MOONWITNESS instructions, current topology and docs/23 precedence. |
| AUD-024 | High | turbo.json has no test task and root scripts target package scripts that are missing or indirect | Define test task and align every root/package script with real package capabilities. |

## 5. Canonical target architecture — reconciled

### 5.1 Topology

Use one workspace topology:

    apps/
      headquarter/     # Next.js frontend
      arsy/            # Fastify API/composition root
      worker/          # optional future background worker process

    packages/
      arsy-core/
      contract/
      types/
      ui/
      orm/
      orm-db/
      orm-db-adaptor/
      orm-db-adaptor-libsql/
      orm-db-adaptor-postgres/
      orm-addon-base/
      orm-addon-project/
      orm-addon-intelligent/
      jobs/                         # queue-agnostic contracts/runtime
      jobs-adapter-bullmq/          # optional transport adapter, if selected
      policy/
      notifications/
      feature-flags/
      lint/
      seed-data/

Root workspace patterns remain apps/* and packages/*. Do not introduce services/*. If a separate worker is needed, it is an app with its own lifecycle and deployment unit. Packages are libraries, not deployable processes.

### 5.2 Ownership rules

- Headquarter: Next.js UI, browser state, API client; never DB credentials or direct ORM access.
- ARSY: only public/private HTTP API, application composition, authn/authz, services, ORM runtime wiring.
- ARSY Core: reusable Fastify lifecycle/plugins/config/logging/health; no business models or SQL.
- ORM: metadata, model registry, field/relation semantics, domains, recordsets, lifecycle, mixin composition.
- ORM DB runtime: transactions/unit-of-work, schema planning/reconciliation, schema receipts, adapter coordination.
- SQL adapters: provider-specific connection, introspection, mapping, query/DDL execution and capabilities.
- Base addons: foundational domain capabilities, each with explicit ownership/dependencies.
- Jobs: queue-independent job definitions, idempotency and handler contracts.
- Queue adapter: transport only; it does not own business job semantics.
- Worker app: consumes jobs/events and invokes application services; no duplicate domain implementation.
- Policy: ZILL rules and quality/rights decisions, not authentication/authorization.
- Notifications: outbound delivery; communication/chatter owns collaboration threads.
- Feature flags: release/technical capability flags; settings own business/operator preferences.

### 5.3 Queue and event decision

Do not let BullMQ become a second source of business truth. A job is a delivery/execution attempt; business state remains in domain records. Use an outbox for reliable dispatch from committed business transactions. Queue messages carry stable IDs, tenant/workspace context, actor/source, correlation ID, idempotency key and schema version—not arbitrary filesystem paths or trusted user IDs.

For the first vertical slice, do not require Redis/BullMQ unless a real workflow needs asynchronous execution. Define packages/jobs contracts first. Later choose one transport adapter and one worker application. If BullMQ is retained, Redis is an explicit infrastructure dependency and BullMQ-specific APIs stay behind the adapter. Do not maintain both services/queue and packages/bullmq as separate implementations.

### 5.4 BaseEntity and Base Platform

The authoritative persisted BaseEntity is exactly:
- id
- createdAt
- createdById
- updatedAt
- updatedById

The ORM composes them once. Actor IDs come from trusted execution context, not client payloads. System/bootstrap/import actors are explicit principals or documented null-provenance cases.

Do not put active, archive, soft-delete, version, workspace, company, ownership, display name or arbitrary metadata on every model. Those remain opt-in mixins or owning-addon fields.

The 17 logical base addon manifests in docs/22 remain the full target catalog, but implementation is staged:
- **Foundation required first:** base.core, base.identity, base.security, base.workspace, base.audit, base.events.
- **Next reusable capabilities:** base.settings, base.attachment, base.sequence, base.transient.
- **Optional/domain-dependent:** base.company, base.communication, base.activity, base.import-export, base.integration, base.taxonomy.

One source package packages/orm-addon-base may contain independent addon manifests. Do not create 17 npm packages without a demonstrated deployment/versioning need.

### 5.5 Database and schema decision

- PostgreSQL is the production target.
- libSQL/SQLite is the local, embedded and single-node profile.
- PocketBase is not part of v1: avoid duplicate auth, BaseModel, API and schema authorities.
- Kysely is private SQL-adapter infrastructure, not the ORM or addon API.
- No routine handwritten schema migration files. TypeScript model declarations are desired schema; ARSY's private schema API plans/reconciles through the selected adapter.
- Schema changes are serialized and recorded with fingerprints/receipts. Safe additive changes may auto-apply; semantic data transforms use typed programmatic handlers; destructive changes require explicit approval, backup and recovery plan.
- A provider switch is a data export/import and verification exercise, not a connection-string change.

## 6. Revised implementation roadmap

### Phase 0 — Repository alignment and deterministic tooling
1. Make this repository's docs the single canonical plan.
2. Fix Headquarter manifest/runtime mismatch.
3. Fix ARSY/arsy-core contract and remove backend-to-UI dependency.
4. Remove or quarantine duplicate services implementations after extracting useful behavior.
5. Repair root workspace scripts and Turbo graph.
6. Make lint/typecheck/build scripts real, deterministic and fail-fast.
7. Remove network AI/version mutations from pre-commit; make commit generation optional.
8. Repair or disable invalid GitHub workflows until they validate.
9. Make auto-detection repository-aware, deduplicated and tested.
**Exit:** clean install, build, lint, typecheck and tests work from repository root; CI reproduces them.

### Phase 1 — Headquarter foundation
1. Correct Next.js package manifest and dependencies.
2. Establish route/layout, theme, responsive shell, locale /id and /en, and API client boundary.
3. Implement design tokens and reusable UI primitives from docs/10–12.
4. Replace demo-only labels/copy that contradict current architecture.
5. Add explicit mock/demo data provider with no false live claims.
**Exit:** Next build and typecheck pass; responsive shell has no dead controls; demo/live data is clearly distinguished.

### Phase 2 — ARSY Core and contracts
1. Implement packages/contract runtime schemas and generated/inferred wire types.
2. Implement framework-neutral packages/types.
3. Implement packages/arsy-core factory, plugin lifecycle, config validation, errors, logging, correlation, health/readiness and shutdown.
4. Make apps/arsy the only Fastify composition root.
5. Add versioned API routes, schema validation, injection tests and OpenAPI output.
**Exit:** ARSY starts/stops cleanly; health/readiness and contract tests pass; Headquarter calls ARSY through typed contracts.

### Phase 3 — ORM kernel (small, test-first)
1. Add package manifest/build/test contract for packages/orm.
2. Implement typed model/field metadata and deterministic registry.
3. Implement addon manifest dependency graph, cycle detection, conflict reporting and extension ordering.
4. Implement persistent/abstract/transient model kinds.
5. Implement BaseEntity composition exactly once.
6. Add typed scalar/relation constraints and portable query/domain AST.
7. Implement record operations, lifecycle and request environment.
**Exit:** deterministic composition, conflict/cycle tests, BaseEntity tests and adapter-independent model tests pass.

### Phase 4 — Database runtime and schema API
1. Implement provider-neutral adapter contracts and capability registry.
2. Implement orm-db transaction/unit-of-work/schema reconciler/ledger.
3. Implement libSQL adapter first for fast local feedback.
4. Implement PostgreSQL adapter against the same contract suite.
5. Implement plan/safe/strict/off modes, serialization lock, receipts, drift checks and recovery.
6. Add typed data-upgrade handler interface; no routine handwritten migration files.
**Exit:** shared provider contract tests, transaction/audit tests, schema idempotency/drift/recovery tests pass.

### Phase 5 — Base Platform (staged)
1. Required foundation addons: core, identity, security, workspace, audit, events.
2. Add opt-in mixins: ownership, archive, soft-delete, toggle, version, workspace scope, company scope.
3. Add settings, attachment, sequence and transient when required by first product workflow.
4. Add communication, activity, integration, import/export, localization and taxonomy as independent capabilities when a real use case requires them.
**Exit:** model ownership, dependency graph, permissions, record rules, workspace isolation and audit consistency tested.

### Phase 6 — RIOTWORKS business addons
1. Project addon only for actual product/project planning needs.
2. Intelligent addon for providers/models/agents/runs/tools/prompts/evaluations/usage/cost.
3. ZILL policy services remain a distinct policy boundary.
4. MIZAN financial ledger remains append-oriented and evidence-backed.
**Exit:** business models do not duplicate base fields, security, audit, jobs or notifications.

### Phase 7 — First end-to-end commercial slice
1. Evidence-backed signal capture.
2. Opportunity score with source/date/confidence.
3. Product brief and original asset creation.
4. ZILL rights/provenance/quality gate.
5. Manual marketplace-ready listing package.
6. MIZAN costs/revenue/refund/payout reconciliation.
**Exit:** one real product can move through the complete workflow with auditable records; no fabricated marketplace API, sales or traffic.

### Phase 8 — Jobs and safe automation
1. Define queue-independent job contracts and outbox dispatch.
2. Select one transport only when required.
3. Add apps/worker only when separate worker scaling/lifecycle is justified.
4. Implement idempotency, bounded retries, leases, dead-letter handling, budgets, approvals and observability.
**Exit:** retry/replay/recovery tests pass; jobs cannot bypass ZILL or authorization.

### Phase 9 — Production readiness and expansion
Security review, threat model, backup/restore drills, observability, deployment profile, rate limits, secret handling, marketplace policy verification, accessibility, load/concurrency tests, release process, and operational runbooks.

## 7. Tooling and automation policy

- Root package manager: pnpm; lockfile is authoritative.
- Node and pnpm versions must be pinned and supported by CI; do not assume engines alone pins them.
- Workspace patterns: apps/*, packages/*; no services/*.
- Turbo owns task graph; scripts must use dependency-aware task definitions and correct package filters.
- Pre-commit: formatting/staged-file lint and fast deterministic checks only. No network calls, release bumps, changelog rewrites, issue creation or forced success.
- CI: install frozen lockfile → format check → lint → typecheck → unit tests → package builds → integration tests where services are available → security/dependency checks.
- Release: version/changelog generated at release/changeset time, not on every commit.
- AI commit message generation is optional developer assistance; fallback works offline; never blocks commits or writes hidden temp artifacts.
- Auto-detection is advisory. It creates at most one issue per stable fingerprint, updates/reopens existing issues, and never creates duplicates every week.
- GitHub automation must use MOONWITNESS repository metadata; no hardcoded RIOTWORKS repo path.
- Validate YAML/workflow syntax and run scripts with fixtures before enabling scheduled automation.

## 8. Governance and definition of done

A task is complete only with:
- implementation in the canonical path;
- typecheck/lint/tests/build evidence;
- documented ownership and dependencies;
- authn/authz and tenant-scope behavior;
- error/retry/idempotency behavior;
- audit/observability where applicable;
- updated docs and changelog at release time;
- no duplicate implementation or misleading placeholder;
- CI evidence attached to the issue/PR.

Every feature has one canonical owner. No direct cross-app source imports. No addon imports provider SQL. No route bypasses application services. No public endpoint exposes generic ORM model CRUD by default. No destructive schema action is autonomous.

## 9. Current next actions (ordered)

1. **P0:** repair root CI/workspace and package manifests (AUD-001 through AUD-007, AUD-010, AUD-014, AUD-021).
2. **P0:** resolve duplicate ARSY/queue code and update stale repo automation target (AUD-004, AUD-005, AUD-009, AUD-012, AUD-013).
3. **P1:** normalize docs 08/15/18/19/21 BaseEntity statements and make docs/23 the canonical plan (AUD-017).
4. **P1:** finish Headquarter shell and ARSY core/contracts (Phases 1–2).
5. **P2:** implement ORM kernel and schema adapters (Phases 3–4).
6. **P2:** implement required base addon foundation, not all optional modules at once (Phase 5).
7. **P3:** business addons, commercial slice, then automation (Phases 6–8).

No new large feature should begin until P0 exits. Do not create GitHub issues automatically from this audit until the repository's issue automation is repaired and duplicate-safe.

## 10. Audit remediation already applied in this documentation pass
- Added this audit and revised execution plan as docs/23.
- Updated README to distinguish actual prototype packages from planned ORM/database packages and linked the new audit.
- Updated MASTER-PROMPT to v3.4 with MOONWITNESS as canonical repository and docs/23 precedence.
- Replaced stale .copilot-instructions.md with MOONWITNESS paths, app ownership, five-field BaseEntity, schema and automation rules.
- Updated docs/08, 15, 18, 19, 20, 21 and 22 to align the five-field BaseEntity and staged implementation plan.

These are documentation/governance corrections only. No application runtime, package manifest, workflow, hook, or service code has been repaired in this pass. P0 code fixes remain open.

## 11. Audit limitations

This audit uses the tracked GitHub tree and file contents at the stated commit. It does not have the user's local uncommitted files, secrets, runtime environment, or CI execution results. If the local machine has additional unpushed changes, push them before asking for a new audit. Never infer a successful build from the presence of package manifests or lockfiles.


---

## 12. Remote revalidation addendum — 2026-11-08

**Verified default branch:** `main`  
**Verified HEAD:** `5a996dd546f06591405569f9cf0ca19f66f8f5ee`  
**HEAD message:** Merge PR #71: objective control plane, interface escrow and proof-carrying merge.

This addendum supersedes the older repository/PR counts above wherever they conflict. The earlier sections remain historical audit evidence for their stated commit.

### 12.1 Confirmed mainline deliveries

- PR #56 — Repository Doctor, Change Planner and Agent Context Compiler: merged.
- PR #61 — Repository Flight Recorder, Parallel Collision Forecast and Context Leases: merged.
- PR #66 — Objective Delta Watchdog, Interface Treaties and Resource Passports: merged.
- PR #72 — Divine Phases 12–14: merged.
- PR #74 — Divine Phases 15–17: merged.
- PR #50 — consolidated governance/installer/runtime phases 0–5: merged.
- PR #49 is closed as superseded; canonical ARSY Phase 18–20 hardening is tracked in PR #79.

### 12.2 Active integration queue

- PR #71 — DX Phases 30–32; draft and stacked on the now-merged #66 branch. Re-target to main and revalidate the unique diff before review.
- PR #59 — Headquarter Sentinel Fabric Phases 14–16: merged at `bc60664e6f94e633aa645274e4ba9f8189940aba`; Repository CI and CodeQL passed.
- PR #55 — closed/deferred because its standalone package-graph CLI overlaps the merged DevX planner and Headquarter blast-radius kernel; revisit only as a measured DevX subcommand gap.
- PR #53 — closed as superseded after the canonical DevX doctor, planner, format check and CI feedback loop entered main.
- PR #49 — closed as superseded; its alternative Phase 18–20 numbering conflicted with the canonical ARSY roadmap.
- Earlier ARSY ORM/database PRs (#15–#41) are still represented as open stacked PRs. They must be evaluated as a dependency chain, not merged individually into main out of order.

### 12.3 Current quality evidence

- Main HEAD `5a996dd546f06591405569f9cf0ca19f66f8f5ee`: Repository CI and CodeQL passed.
- PR #80's first CI run found an implicit-any type error in runtime validation of untrusted parent references. The callback is now explicitly typed `unknown`; refreshed CI and CodeQL are pending.
- PR #79's prior Repository CI and CodeQL passed; its branch was refreshed against the latest main and requires revalidation.
- PR #78's CI and CodeQL are running. No queued or in-progress result is treated as a pass.

### 12.4 New implementation under review

PR #80, `feat/divine-phases-18-20-provenance-assurance-v2`, adds:
- transitive source-lineage closure and conservative independence classification;
- a deterministic provenance red-team mutation suite;
- a claim/scope/method/Corpus-release-bound assurance capsule;
- Divine tests and an explicit CI step to execute the Divine test suite.

The branch is not merged. Its implementation status remains pending refreshed CI and review. SHA-256 fingerprints are integrity checks only, not signatures, trusted timestamps, source-authenticity proofs, or authorization tokens.

### 12.5 Execution correction

PR #56, #61, #66, #71 and #59 are merged. PR #49, #53 and #55 are closed as superseded/deferred. Canonical ARSY hardening is tracked in #79; Divine provenance assurance is tracked in #80; the new ARSY trust-boundary Phases 33–35 are tracked in #78. Do not use the older PR snapshot as current state.
