# Repository Revalidation — 2026-11-08

**Repository:** BRIDGE-ALLAH/MOONWITNESS  
**Default branch:** main  
**Verified HEAD:** 090c6f0051df129ae81aae32a26888090b6005bb  
**Purpose:** Replace stale repository-state assumptions with a current, evidence-based baseline. This is a point-in-time audit, not a claim that all roadmap items are complete.

## 1. Mainline and merged work

- PR #79 merged as 3e9db048eef0698f56c14543dbf2afc83a534247: ARSY Phases 18–20 security hardening.
- PR #81 merged as 1bfbae285c2871985487882b4c4ec42915bf422b: Developer Experience Phases 33–35.
- PR #81 pre-merge CI: Repository Integrity, Asset Integrity, WITNESS FABRIC, Developer Experience, Full Workspace Typecheck/Build, and CodeQL all succeeded. Its three new CLI smoke tests succeeded.
- PR #90 merged as 090c6f0051df129ae81aae32a26888090b6005bb: ARSY runtime/container contract repair. Repository Integrity, Asset Integrity, WITNESS FABRIC, Developer Experience, Full Workspace Typecheck/Build, and CodeQL all passed on its PR head.
- PR #75 and PR #80 are closed and unmerged; PR #82 superseded #80 and is now merged.
- PR #78 merged as ecb4faf2b85a24f07db2c2a5685ca04d627254f8: ARSY Core trust-boundary Phases 33–35. Its missing blockedWithoutSignal metric was fixed; current-head Repository CI, full workspace typecheck/build, and CodeQL passed before merge.
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

PR #90 is merged. The previous app/container contract defects were corrected:
- ARSY resolves a validated host/port; the default port now matches the Compose mapping (3001).
- /health/live and database-backed /health/ready endpoints are present.
- The app-owned entrypoint is used by dev/start scripts; the production Dockerfile uses the app's start command.
- PostgreSQL pool cleanup is registered through Fastify onClose rather than process-global signal handlers.
- ARSY lint no longer silently skips; the shared ESLint configuration is used and a server-config test suite was added.
- Compose readiness probes /health/ready and uses Node fetch rather than relying on curl.

PR #90 checks: Repository Integrity, Asset Integrity, WITNESS FABRIC, Developer Experience, Full Workspace Typecheck/Build, and CodeQL all passed. Repository CI specifically passed the ARSY runtime tests and Docker Compose config validation.

### Configuration and containers

- .env.docker is explicitly marked local-development-only; its placeholder password must never be used in production.
- Compose requires POSTGRES_PASSWORD to be supplied and binds PostgreSQL, Redis, ARSY, and Headquarter host ports to loopback.
- The local Compose stack explicitly runs dev commands and retains source mounts/hot reload. It is not a production deployment definition.
- Dockerfile.arsy now uses the production start command and sets NODE_ENV=production after dependency installation/build.
- The final Compose YAML parsed locally and docker compose config --quiet passed in GitHub CI.

Remaining production blockers:
- No production Compose profile or deployment workflow/environment/target is configured.
- No Docker image build-and-run integration test was executed; the Dockerfile build and container startup against a real PostgreSQL service remain unverified.
- TLS/ingress, managed secret injection, backup/restore, monitoring/alerting, rollback, and production smoke tests are not configured.
- No production URL or live health endpoint was available to verify.

Do not claim production-ready or deploy the local Compose profile. Complete a separate production runtime/deployment design with real secrets and target-specific validation first.

## 4. Release metadata

- Root package.json version is 1.0.11.
- CHANGELOG.md only documents 1.0.0.
- The only current Git tag is `v1.0.0`, and GitHub `releases/latest` also resolves to `v1.0.0` (published 2026-11-07). The annotated tag points to commit `45b769c4639ee12d472655ed2dae858ecb6d1e44`; `package.json` at that tag was `1.0.8`. Current main package.json is `1.0.11`, and the current main snapshot is 450 commits ahead of the tag commit. The tag is unsigned (`verification.verified=false`).
- No tag or GitHub Release was created in this work.
- No production deployment or production smoke test was run.

**Release readiness: NO-GO.** The tag/compare range is now known, but the root source version is three patch increments beyond the last tagged package version without corresponding numbered changelog/release entries. Decide whether 1.0.9–1.0.11 were internal-only development bumps or missed releases; do not invent tags or backfill releases. Product functionality, runtime, security, deployment, rollback, and production-health gates still block a new release.

## 5. Headquarter UX baseline

The existing Headquarter audit identifies 12 original page routes and later governance/decision/scenario routes. The product remains a prototype surface:
- Several legacy feature pages still use local/static demo data. The authenticated read-only Docker connector is a verified live ARSY integration on main; the commerce/finance/Aftershock workflows remain on unmerged draft PR #126.
- The Docker connector has an operator session and owner-scoped server-side routes. General multi-user identity/roles, authorization and persisted workspace selection are not established across all legacy modules; route-aware locale is not established.
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

1. Build a separate production runtime/deployment definition; build and run the ARSY image against PostgreSQL, and verify readiness from a real container.
2. Establish production secrets, TLS/ingress, backup/restore, monitoring, rollback, deployment target, and smoke tests.
3. Complete Headquarter browser accessibility/responsive checks and consistent demo/lifecycle-state UX.
4. Reconcile ORM/database PR ancestry and run compatibility tests against current main.
5. Reconcile version/tag history and changelog, then create a stable release only after production verification.

## Audit limitations

This revalidation used the GitHub repository/API surfaces and CI evidence available in this session. It did not perform a local full clone, run Docker, access production credentials/infrastructure, inspect a live deployed application, or perform manual browser/screen-reader testing. Those checks remain explicitly unverified.


## 8. Current mainline revalidation after Docker connector — 2026-11-08

**Observed main HEAD:** `b26ffb50a4cfb3e1c63fa7404b98a0c8d68dcb98` (PR #164 documentation revalidation; includes Docker connector PR #154).

### Merged real product capability
PR #154 adds a narrowly scoped, authenticated, owner-scoped Docker Engine read-only connector:
- ARSY server-side adapter for local Unix socket and remote verified TLS/mTLS endpoints.
- Remote DNS resolution/address validation and address pinning, explicit local socket allowlist, bounded requests, and no arbitrary API proxy.
- PostgreSQL-persisted connection metadata, encrypted TLS credentials, append-only audit events.
- Headquarter operator session, server-side proxy, real Engine info/container inventory/logs.
- Read-only by design. No start/stop/exec/deploy operations are exposed.
- IPv6 IETF special-purpose parent range `2001::/23` is denied by default with regression tests.

Exact PR-head gates passed before merge: Repository CI (including WITNESS FABRIC, Developer Experience, Asset Integrity, repository integrity, full workspace typecheck/build), Docker/PostgreSQL integration, real Headquarter browser E2E including reload/persistence, CodeQL, and ARSY/Headquarter container image build. Issue #116 is closed for this completed initial slice.

**Security boundary:** access to a local Docker socket is host-root-equivalent and remains explicit opt-in. The branch's process-local fallback limiter is not distributed protection; shared PostgreSQL login throttling remains a separate production gate in Issue #123.

### Current Money Maker state — not integrated
The successor candidate remains draft PR #126, latest inspected head `1920e6357c2de45e3e4851773b3e81df2c16bc43`:
- Contains persisted opportunities, product briefs/version history, assets/provenance, inspections, channel review, manual listing package, financial events, payouts/FX, and shared login attempt storage.
- Product version creation uses an expected-version compare-and-swap at the database row-lock boundary; an owner-scoped history read endpoint and UI are present.
- A shared HTTP(S)-only evidence URL schema and route-level tests are present.
- Aftershock uses API-derived persisted data and explicitly reports unavailable conversion/cohort metrics rather than fabricating them.

However, PR #126 remains a draft, is not mergeable, and is 116 commits ahead / 78 behind main from the old base `75ec7ab9...`. Its 130-file diff overlaps the ARSY composition root/database setup, Docker/Compose, env/config/workflow files, Headquarter routes/UI, and shared UI theme files. It must be reconciled carefully with the merged Docker connector and current main; do not force-merge or discard existing branch work. No workflow run is registered for the exact head `1920e...` at this revalidation. The browser test still has a locator mismatch for the payout empty state; Aftershock's financial summary is all-time while cohort metrics use a selected window; new Money Maker boards still use legacy RIOTWORKS palette/brand; and disputed payout-resolution paths lack explicit integration coverage. These are open acceptance items.

### Current package and design state
- UI/Assets consumer documentation, SVG resource isolation, font runtime/rights correction, and evidence-based asset checklist updates are merged (#159, #160, #162, #163).
- `@riotworks/ui` remains a private source-exported workspace package; no standalone public distribution or package publication is authorized.
- The custom MOONWITNESS Signal WOFF2 remains unlicensed/internal-only and is not loaded by runtime.
- Logo/brand owner approval, external asset redistribution policy, browser visual regression, rendered-state contrast, keyboard/screen-reader and WCAG 2.2 AA checks remain open.

### Release metadata and production decision
- Root package version is still `1.0.11`; the only current tag/latest stable release is `v1.0.0`, whose tagged package manifest was `1.0.8`. Main is 450 commits beyond that tag. CHANGELOG still has only `1.0.0` plus Unreleased. Reconcile the three post-tag package version bumps and changelog scope before a future release.
- Workflow inventory currently has CI, CodeQL, container build, Docker/PostgreSQL integration, Headquarter browser E2E, PR labeling, lockfile refresh, corpus migration and weekly detection. No production deployment workflow is present in this inventory.
- No verified production target, managed secrets, TLS/ingress, backup/restore, monitoring/alerting, rollback authority or live smoke-test credentials/URL are recorded.

**Production readiness remains NO-GO.** No package publication, version bump, tag, GitHub Release or production deployment was attempted.

### Verification boundary
This update is based on current GitHub main files, PR diffs, issue state and exact PR #154 workflow results. It does not claim access to a local working tree, production PostgreSQL, production secrets, live deployment, manual cross-browser review, or manual assistive-technology testing.


## Version and tag history verified — 2026-11-08

- The repository has one current Git tag: `v1.0.0`; GitHub `releases/latest` is also `v1.0.0`, published 2026-11-07.
- The annotated tag points to commit `45b769c4639ee12d472655ed2dae858ecb6d1e44`; the root package manifest at that tagged commit reports `1.0.8`.
- Current main package version is `1.0.11`; current main is 450 commits ahead of the tag target.
- The tag object is unsigned (`verification.verified=false`). This is provenance information, not evidence of maliciousness; follow an explicit signed-tag policy if one is adopted.
- The latest numbered changelog heading remains `1.0.0`. The three package version bumps after the tagged manifest need a policy decision and accurate changelog treatment before release.



## Post-ORACLE integration revalidation — 2026-11-08

**This addendum supersedes the earlier main-HEAD snapshot above for the changes recorded here.**  
**Verified `main` HEAD:** `d7150c4d30377b0f5f2d9c7bfa2b924e5f3d2a56`.

### Merged implementation

- PR #171 merged as `12445d22b3a31d6cd69eed6eeb43c21b43b2c484`: standalone Python ORACLE Stage 1 service under `apps/oracle`.
- PR #173 merged as `d7150c4d30377b0f5f2d9c7bfa2b924e5f3d2a56`: ARSY-owned authenticated API/client, private Compose service wiring, service-to-service E2E, and integration documentation.
- PR #169 universe/product architecture registry remains merged at `27703b6a485b70c360da24543773304882a0960f`.
- Integration issue #172 and ORACLE foundation issue #170 are closed after their merged acceptance scopes.

### Actual execution path verified

`POST /api/v1/oracle/jobs` and `GET /api/v1/oracle/jobs/:jobId` are exposed by ARSY behind its operator-authentication boundary. ARSY validates input and response contracts, supplies a separate ORACLE bearer service token, applies bounded request timeouts, disables redirects, and maps upstream failures safely.

ORACLE is a private Compose service on the existing bridge network. It has no published host port. ARSY depends on ORACLE readiness. The browser does not call ORACLE directly.

The new Compose E2E starts real PostgreSQL, Redis, ORACLE and ARSY containers using isolated CI credentials and ephemeral volumes. It submits:
- `statistics.describe` for `[10, 12, 15, 19]`, verifies count 4, mean 14, median 13.5, evidence passthrough and SHA-256 provenance;
- `text.profile`, verifies the deterministic lexical count and method provenance;
- a repeated statistics submission with the same idempotency key, verifies replay and stable job ID.

Both tests passed (2 passed, 0 failed, 0 skipped). The CI-only operator token is masked in logs, and the Compose stack, network and volumes are removed at teardown.

### Exact-head and post-merge verification

PR head `ef961130bd769d8994869d58ac4464b4c476154a` passed:
- Repository CI / full workspace typecheck and build: run `42432323774`
- ORACLE Compose E2E: `42432323815`
- ORACLE Python 3.12/3.13: `42432323870`
- CodeQL: `42432323798`
- ARSY and Headquarter container builds: `42432323867`
- Docker connector PostgreSQL integration: `42432323817`
- Headquarter Docker connector browser E2E: `42432323829`

After merge, `main` at `d7150c4d30377b0f5f2d9c7bfa2b924e5f3d2a56` passed:
- Repository CI / full workspace validation and builds: `42432495390`
- ORACLE Compose E2E: `42432495389`
- ORACLE Python 3.12/3.13: `42432495367`
- CodeQL: `42432495383`
- ARSY and Headquarter container builds: `42432495368`

### Explicit implementation boundaries

- ORACLE Stage 1 retains jobs and idempotency records in process memory. A service restart loses retained job state; there is no durable queue/job store or restart recovery.
- This slice does not add database persistence, canonical audit storage, an ORACLE user interface, model-provider/GPU inference, public ingress, production secrets, or deployment.
- ORACLE remains a deterministic bounded computation service. Its digests and method metadata are derivation information, not a trusted timestamp, signature, source-authenticity proof, or replacement for WITNESS FABRIC.
- HEADQUARTER remains a clearly disclosed prototype/demo surface. The ORACLE API integration does not make its financial, marketplace, account, or dashboard demo records live user data.

### Release decision — still NO-GO

- Root package version remains `1.0.11`; latest stable GitHub Release/tag remains `v1.0.0`; latest numbered CHANGELOG heading remains `1.0.0`.
- Do not infer or manufacture releases for the intervening package version bumps.
- No approved production target, managed secret injection, TLS/ingress, backup/restore proof, monitoring/alerting, rollback path, production deployment workflow, or live production smoke URL/credentials were verified.
- A green container build and successful disposable Compose E2E are not evidence of a production deployment.

**Next engineering priorities:** (1) decide and implement durable ORACLE job/idem state and worker recovery with an explicit persistence/ownership ADR; (2) continue the real commerce/product vertical slice through the existing draft Money Maker work, first resolving its dependency graph and unmergeable state; (3) continue ORM/Business Database work only with database-backed CRUD, migrations, access-policy and real persistence tests—not by treating declaration/registry scaffolding as complete.


## Deployment control-plane revalidation — 2026-11-08 (mainline `cbec238492053b3ee9126b3f29aa3a936e8f9fb1`)

This addendum supersedes earlier deployment-capability statements in this document where they conflict with the merged mainline work listed below.

### Verified mainline foundation

The following deployment foundations are present on the verified main branch:

- PR #188 / Issue #179: PostgreSQL deployment aggregate, operation journal, append-only events and transactional outbox; owner-scoped idempotency and request-hash conflict behavior.
- PR #189 / Issue #180: deny-by-default deployment authorization and approval evidence, using the existing capability-policy primitives.
- PR #195 / Issue #181: a separate, narrowly allowlisted Docker Workload Adapter. The existing Docker Connector inspection API remains read-only.
- PR #198 / Issue #197: generic PostgreSQL outbox delivery with `FOR UPDATE SKIP LOCKED`, bounded leases, fencing tokens, retries and dead-letter handling. The dispatcher is callable and at-least-once; it is not automatically started by the ARSY HTTP process and has no deployment-specific handler on main.
- PR #203: bounded dead-letter reaping and database-clock retry/lease handling.
- PR #205: binds deployment authorization to an authenticated ARSY principal only after operator-token verification and bounds policy evaluation with a fail-closed timeout.

The implementation is distributed across `apps/arsy/src/deployments/` and migrations `003_arsy_deployment_operations.sql`, `004_arsy_deployment_authorization.sql`, and `005_arsy_deployment_outbox_leases.sql`. These are real persistence, authorization, adapter and transport foundations; they are not a complete application PaaS.

### What is still missing

At this mainline snapshot, no end-to-end deployment request can yet be submitted and carried through by the product. In particular, the repository does not yet contain:

- the deployment-specific versioned intent/read API and atomic request-to-operation wiring;
- a deployment-specific outbox handler and bounded worker lifecycle/recovery loop;
- a Build Engine runtime that checks out an immutable authorized source commit, builds an image and publishes a verifiable OCI digest;
- application-level deployment health reconciliation, safe audited rollback, and a Headquarter operator workflow backed by those APIs;
- an accepted ingress/domain/TLS lifecycle and a verified production deployment target.

The generic outbox dispatcher must not be represented as a deployment worker. The Docker Workload Adapter must not be represented as a source-to-image builder. A passed image build or disposable Compose integration test must not be represented as a production deployment.

### Build Engine and dependent execution order

ADR 0003 is still **proposed for maintainer review**, not accepted. It recommends BuildKit rootless only subject to mandatory isolation proof gates, with a disposable per-job VM as the preferred trust boundary. Issue #182 owns the decision and adversarial proof; Issue #183 owns implementation only after that decision is accepted. Do not run untrusted repository build instructions inside ARSY or with access to the production Docker socket or control-plane credentials.

Issue #184 should implement only deployment-specific orchestration on top of the already-merged journal, authorization, adapter and generic outbox foundations. It must not recreate those components. Its prerequisites are #179, #180, #181 and #197; its Build Engine dependency is #183, which is itself blocked on acceptance of #182. Issues #185 (health/reconciliation/rollback) and #186 (Headquarter BFF/operator workflow) remain downstream of the deployment API/orchestration.

### Exact-head GitHub Actions evidence

For main commit `cbec238492053b3ee9126b3f29aa3a936e8f9fb1`, the following GitHub Actions runs were retrieved as completed successfully:

- Repository CI: [42455420748](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42455420748)
- Container build verification: [42455420783](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42455420783)
- CodeQL: [42455420787](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42455420787)
- ORACLE Compose E2E: [42455420765](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42455420765)

These runs are exact-main-head CI evidence only. They do not establish a completed deployment API/worker, a production runtime, a production URL, or a live production smoke test.

### Product truth and release status

- HEADQUARTER remains a prototype/demo experience; static feature datasets and financial/dashboard values must not be described as live customer or business records.
- ORACLE Stage 1 still retains job/idempotency state in process memory; restart-safe durable job recovery is not established.
- The current root package version remains `1.0.11`; the only stable tag/release remains `v1.0.0`; the numbered changelog still only documents `1.0.0`. Do not fabricate intervening releases or backfill versions without a verified release decision.
- This audit did not perform a local clone, local install/test run, manual browser/accessibility review, local Docker deployment, production credential inspection, production deployment, or production smoke test. Those remain NOT RUN / NOT AVAILABLE in this session.

**Release readiness remains NO-GO.** The exact-head CI runs above are green, but no configured production target, managed secret injection, TLS/ingress, backup/restore drill, production monitoring/alerting, rollback procedure, live URL, or production smoke evidence was available. No version bump, tag, GitHub Release or production deployment was attempted.
