# 33 — Platform Capability Ownership & Dependency Map

**Status:** Repository-backed planning baseline; ADR 0002 accepted; adapter #181 merged on 2026-11-08  
**Audit date:** 2026-11-08  
**Audited main:** 0746714208c0c816baabe1546b28f92642b1d5f7  
**Purpose:** Establish one owner per capability, map actual source/API surfaces and existing GitHub work, and prevent duplicate implementation before new platform issues are created.  
**Related:** [ADR 0002 — Docker Workload and Deployment Ownership](./adr/0002-docker-workload-deployment-ownership.md), [ADR 0001 — ATLAS PostgreSQL Storage](./adr/0001-atlas-postgresql-storage.md), [32 — Universe & Product Architecture Registry](./32-universe-and-product-architecture-registry.md), [24 — Repository and Automation Governance](./24-repository-and-automation-governance.md), [28 — Current-State Revalidation](./28-current-state-revalidation-2026-11-08.md), [29 — Docker Connector](./29-docker-connector.md).

> This is a dated repository/issue/PR snapshot, not a claim of production readiness. A file, route, workflow, branch or draft PR existing is not proof that a capability is merged, durable, secure, operational, or accepted. Re-fetch exact PR heads and checks before implementation or merge.

## 1. Executive decisions

1. **One owner per capability.** The component in the owner column is responsible for the domain contract, canonical state and acceptance criteria. Collaborators consume its contract; they do not create competing state machines.
2. **One control-plane authority.** ARSY owns caller identity, authorization, policy/approval integration, orchestration and canonical audit. HEADQUARTER is its operator UI.
3. **Separate observation from mutation.** The current Docker Connector remains read-only. Mutating workload operations require a separately reviewed adapter/interface and threat model.
4. **Keep ATLAS and AEGIS bounded.** ATLAS owns DNS/RADIUS/observability control-plane workflows. AEGIS owns narrowly delegated network infrastructure execution. Neither owns application deployment or Docker workload lifecycle.
5. **Build is not deploy.** A future Build Engine creates and attests image artifacts in an isolated environment. ARSY authorizes target deployment; a single Docker Workload Adapter applies the runtime change.
6. **Queues are transport, not business truth.** A durable job/operation record and outbox/idempotency contract must exist before a queue adapter is selected. Current BullMQ and ORACLE in-memory implementations are not production deployment foundations.
7. **GitHub Issues are the backlog.** PRs are integration candidates, .plan is session state, and todo.md is historical/roadmap material. Do not create duplicate issues by copying unchecked checklist lines.
8. **ADR 0002 is accepted.** Dependency-ordered PaaS implementation issues may now be created within its boundaries. Acceptance does not authorize production deployment, unrestricted Docker mutation, or weakening the existing read-only connector contract.

## 2. Capability ownership matrix

“Current implementation” describes what is verifiably present on the audited main, not what exists only on an unmerged branch.

| Capability | Sole owner | Collaborators / external system | Current mainline truth | Canonical paths / API | Existing tracking |
|---|---|---|---|---|---|
| Operator UI and product navigation | HEADQUARTER | ARSY API | Next.js prototype; route presence does not mean live workflow | apps/headquarter/src/app/, src/shell/, src/platform/arsy/ | [#100](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/100), [#73](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/73) |
| Server-side browser/API boundary | HEADQUARTER | ARSY | Signed single-operator session and BFF/proxy exist for Docker; not general multi-user RBAC | apps/headquarter/src/lib/arsy-proxy.ts, src/lib/operator-session.ts, src/app/api/ | [#123](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/123), [#100](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/100) |
| API composition and caller authentication | ARSY | HEADQUARTER, internal services | Fastify app and global operator-token guard for /api/v1/*; current model is single operator/service credential | apps/arsy/src/app.ts, src/index.ts, src/auth/operator-token.ts | [#73](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/73), [#123](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/123) |
| Application persistence and database pool | ARSY application (current authority) | PostgreSQL; future ORM/System Mode | PostgreSQL pool and explicit SQL migrations exist. The complete custom ORM/schema control plane is not implemented on main | apps/arsy/src/db.ts, apps/arsy/migrations/ | ORM PR chain [#15–#41](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pulls?q=is%3Apr+15) (stale stacked candidates; see §7) |
| Docker Engine connection and inspection | ARSY Docker Connector | Docker Engine local socket or verified remote TLS/mTLS | **Implemented read-only**: connection registration, Engine info, bounded container inventory and logs; PostgreSQL ownership metadata and audit | apps/arsy/src/docker/engine.ts, routes.ts, security.ts; GET/POST /api/v1/infrastructure/docker/servers, GET .../:id/info, GET .../:id/containers, GET .../:id/containers/:containerId/logs | [#116](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/116) closed for initial slice; [PR #154](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/154) merged |
| Docker workload mutations | **ARSY — Docker Workload Adapter** (accepted ADR 0002) | Docker Engine; ARSY policy/approval and durable operations | **Not implemented on main**; implementation is tracked separately from read-only inspection | ARSY internal port + isolated adapter; no public mutation route yet | [#180](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/180), [#181](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/181); persistence prerequisite [#179](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/179); current journal PR [#188](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/188) |
| Git source checkout | **Build Engine** (separate from ARSY runtime) | Git provider and scoped repository credential | Not implemented as application deployment capability | Build isolation decision and source adapter | [#182](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/182), [#183](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/183) |
| Image build, cache and provenance | **Build Engine** | Isolated builder, OCI registry | Not implemented for application deployment | Build request/receipt contract, immutable image digest | [#182](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/182), [#183](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/183) |
| Image registry lifecycle | Future Build Engine / registry adapter | External or self-hosted OCI registry | No managed registry lifecycle evidenced | Registry adapter selected by explicit deployment ADR | No dedicated accepted PaaS issue found |
| Deployment intent, desired state, history and rollback | **ARSY** | Build Engine, Docker Workload Adapter, HEADQUARTER | No public deployment domain/API on main; durable deployment/operation schema and repository are merged; outbox delivery is merged; orchestration route/worker is not wired | ARSY-owned deployment contract, durable operations and lifecycle API | [#179](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/179), [#184](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/184), [#185](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/185); journal [PR #188](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/188), outbox [PR #198](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/198) |
| Runtime container state | Docker Engine (source of observed runtime truth); ARSY stores authorized deployment records | Docker Workload Adapter, monitoring | Inspection exists; no authorized mutation or continuous reconciliation | Current inspection API in apps/arsy/src/docker/routes.ts | [PR #154](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/154) |
| DNS configuration control | ATLAS | PowerDNS Authoritative; future Unbound/dnsdist | Candidate source exists only in draft PR #176; not merged into main | apps/atlas/src/dns.rs, controllers/api.rs in candidate; see [#155](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/155) | [#155](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/155), [PR #176](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/176), superseding source [PR #156](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/156) |
| RADIUS control and SQL data | ATLAS control plane; FreeRADIUS is protocol/data-plane engine | PostgreSQL radius database, Redis coordination | Candidate in draft #176; PAP Access-Accept Compose smoke currently fails | apps/atlas/src/radius.rs, radius_db.rs, FreeRADIUS config in PR #176 | [#155](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/155), [PR #176](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/176) |
| Network infrastructure execution | AEGIS | Netmaker/WireGuard/RouterOS/firewall systems when adopted | Foundation candidate only; no accepted authenticated command protocol or actual network mutations | Candidate apps/aegis/ in PR #153; not present on audited main | [#151](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/151), [PR #153](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/153) |
| Metrics/log storage and query | External VictoriaMetrics / VictoriaLogs engines | ATLAS integration/configuration; collectors/agents | Stack direction accepted; end-to-end operational query/alert/retention APIs remain deferred in ATLAS issue | Candidate Compose and ATLAS adapters in PR #176; actual engines own storage | [#155](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/155), [ADR 0001](./adr/0001-atlas-postgresql-storage.md) |
| Application ingress, reverse proxy and TLS | **Pending separate architecture decision** | ARSY authorizes exposure; ATLAS owns DNS configuration within its domain; one selected proxy/certificate provider executes | Not implemented as a managed lifecycle | ADR 0004 decision boundary | [#187](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/187) |
| Durable jobs, outbox and worker runtime | **ARSY owns operation semantics, outbox and delivery contract** | Manually invoked worker/handler adapter; transport is at-least-once and is not canonical business state | Durable journal and fenced `SKIP LOCKED` claim/lease/ack/retry/dead-letter store are merged. Dispatcher is callable but not auto-started. Legacy BullMQ/ORACLE in-memory work remain non-canonical | apps/arsy/migrations/003_arsy_deployment_operations.sql; apps/arsy/migrations/005_arsy_deployment_outbox_leases.sql; apps/arsy/src/deployments/operation-store.ts; apps/arsy/src/deployments/outbox-store.ts; apps/arsy/src/deployments/outbox-dispatcher.ts | [#179](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/179), [#197](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/197), [#184](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/184); [PR #198](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/198) merged |
| ORACLE computation | ORACLE | ARSY authenticated API boundary; WITNESS FABRIC for evidence lineage | Stage 1 deterministic analysis service merged, but job and idempotency state are process-memory only | apps/oracle/src/oracle/; ARSY src/oracle/client.ts, contracts.ts, routes.ts | [PR #171](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/171), [PR #173](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/173), issues #170/#172 closed for foundation/integration |
| Evidence, provenance, execution trust | WITNESS FABRIC / framework-neutral ARSY Core primitives | ARSY authorization and domain packages | Libraries and tests exist; production key custody, signatures, durable integration and enforcement remain separate gates | packages/witness-fabric/, packages/arsy-core/src/evidence/, attestation/, knowledge/, runtime-contract/, evaluation/ | [#73](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/73); PRs #78/#79 and related merged phases |
| Policy, rights and quality | ZILL domain capability; ARSY enforces decisions | HEADQUARTER review UI | Governance primitives/inspection direction exist; no blanket authorization authority | packages/policy/, packages/arsy-core/src/runtime-contract/, Headquarter feature modules | [#100](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/100), [#119](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/119) |
| Product/opportunity/asset/finance workflows | Domain modules under ARSY; HEADQUARTER presents operator surfaces | PostgreSQL and storage adapter | Candidate implementation is draft PR #126; not accepted on main | Candidate apps/arsy/src/opportunities/, products/, assets/, inspections/, channels/, listings/, finance/, analytics/ and matching Headquarter routes | [#100](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/100), [#119](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/119), [#120](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/120), [#121](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/121), [#122](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/122), [#126](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/126) |
| Shared login throttling | One shared ARSY/Headquarter security boundary | Trusted ingress or shared store | Mainline Docker connector documents process-local fallback; distributed limiter is not established by the verified mainline connector | Candidate apps/arsy/src/auth/login-attempts.ts, migration 005_shared_login_attempts.sql in PR #126 | [#123](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/123) |
| Evidence/provenance URL validation | Shared ARSY contract/schema utility | All domain routes | Mainline candidate work exists only in PR #126; don't create a second URL validator | Candidate apps/arsy/src/http-url.ts | [#138](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/138), PR #126 |
| Database schema lifecycle / ORM | **Not fully settled**; ARSY System Mode is the target authority in docs 18–22 | Provider adapters (PostgreSQL/libSQL) and domain declarations | Complete ORM, adapter SPI and System Mode are not present on main; draft stacked PRs are candidate source only | Target docs 18–22; current ARSY SQL migrations under apps/arsy/migrations/ | Legacy PR chain #15–#41; see §7 |
| Backup and restore | Future platform operations owner to be assigned with the production runtime ADR | PostgreSQL, registry, persistent volumes, object storage | No verified backup/restore drill or production recovery path | No production workflow/verified target | Release NO-GO in [docs/28](./28-current-state-revalidation-2026-11-08.md) |
| Release/deployment environment | Future release/platform operations owner | CI, registry, secrets, ingress, production target | No verified production deployment target, managed secrets or production deployment workflow | Current workflows in .github/workflows/ are CI/integration, not production deployment | [#73](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/73) |

## 3. What each existing application/service is allowed to own

### HEADQUARTER

Allowed: operator experience, navigation, forms, presentation, browser-side state, same-origin BFF routes, safe API client and honest lifecycle states.

Not allowed: direct DB/ORM access, Docker socket/TLS credential access, policy bypass, duplicated domain transition graphs, treating synthetic fixtures as live records.

### ARSY

Allowed: canonical API composition, caller identity, authorization and policy enforcement, approval orchestration, canonical deployment/business records, domain services, durable job semantics, Docker workload adapter interface, and canonical audit boundary.

Not allowed: becoming the DNS/RADIUS protocol server, metrics/log storage engine, general-purpose unrestricted Docker proxy, or multiple independent queue/business-state authorities.

### Docker Connector

Allowed now: owner-scoped registration and read-only inspection with strict TLS, DNS, request-size, inventory and log bounds.

Not allowed now: start/stop/restart/exec/remove, arbitrary Engine API forwarding, Compose deployment, build execution, proxy/TLS lifecycle or rollback. A mutation interface must be separately named, authorized, audited and tested.

### ATLAS

Allowed: its own engine registry, DNS/RADIUS/observability configuration, desired state, reconciliation and operator visibility.

Not allowed: Docker socket access, application deployment, build execution, protocol implementation that belongs to the external engine, metrics/log storage, ARSY identity or generic orchestration.

### AEGIS

Allowed: explicitly delegated network infrastructure execution with bounded command types, authorization context and execution receipts after those contracts are implemented.

Not allowed: identity authority, policy authority, general purpose workflow engine, generic Docker workload executor, application deployment or direct user-facing public control plane.

### ORACLE

Allowed: bounded, versioned computation and analysis with explicit provenance/limitations.

Not allowed: user identity, authorization, canonical evidence storage, durable job ownership unless separately designed, application deployment, or unbounded agent authority.

## 4. Dependency graph

The following graph distinguishes control plane, build/execution path and infrastructure domains. It is a target interaction graph; missing boxes are not implemented capabilities.

**Application deployment path**

HEADQUARTER (UI/BFF) → authenticated API contract → ARSY CONTROL PLANE (identity, authorization, policy/approval, desired state, durable jobs, audit).

ARSY → Build Request Port → isolated Build Engine (Git source, Dockerfile/buildpack, build cache, build logs, image provenance) → OCI Registry.

ARSY → Docker Workload Port → one Workload Adapter → authorized Docker Engine host(s) → application containers → proxy/ingress/TLS → user traffic.

Docker Engine reports observed container state to ARSY through the adapter. The control plane is not in the application request/data path.

**Infrastructure domain path**

ARSY → authorized domain calls → ATLAS → DNS/RADIUS/observability control adapters → external engines and services.

ARSY → separately authorized network command → AEGIS → network infrastructure engines (when implemented).

**Observability path**

Application/container/host sources → collectors/adapters → VictoriaMetrics and VictoriaLogs (storage/query plane) → ATLAS control-plane configuration and operational visibility APIs → ARSY/HEADQUARTER.

Key constraints:
- HEADQUARTER never calls Docker, ATLAS engines or AEGIS mutation endpoints directly.
- ARSY is the only caller-facing control-plane authority.
- Build Engine and Docker Workload Adapter have different credentials, interfaces, resource limits and failure policies.
- ATLAS and AEGIS never become a second ARSY.
- External services own their own protocol/data-plane behavior.

## 5. Dependency and delivery sequence

A feature may start only after its upstream contract and owner are settled.

| Order | Work package | Sole owner | Required predecessor | Exit evidence |
|---:|---|---|---|---|
| 0 | Accept ADR 0002 and record the ownership decision | Project owner / architecture | #178 decision; ADR 0002 | **Done:** ADR 0002 Accepted; docs 32/33 aligned |
| 1 | Durable deployment aggregate, operation journal, idempotency, events and transactional outbox | ARSY | Order 0 | Database migration + typed store; restart-safe records; replay/conflict and owner-isolation tests — [#179](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/179), [PR #188](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/188) |
| 2 | Deny-by-default deployment authorization, approval and actor evidence | ARSY | Orders 0–1 | Principal/target/action scope, policy decision and approval evidence; missing policy fails closed — [#180](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/180) |
| 3a | One-host Docker Workload Adapter | ARSY platform boundary | Orders 1–2; read-only connector remains unchanged | Allowlisted mutation only, bounded receipts, isolation tests and persistent-data protection — [#181](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/181) |
| 3b | Select and threat-model isolated Build Engine | Architecture / Build Engine boundary | Order 0; may run in parallel with 1–3a | Accepted build isolation ADR with adversarial proof — [#182](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/182) |
| 4 | Implement isolated source-to-OCI build and provenance | Build Engine | Orders 1–2 and 3b | Untrusted build cannot read control secrets/socket; immutable digest, scoped credentials and cleanup — [#183](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/183) |
| 5 | ARSY deployment API, outbox dispatcher and first end-to-end orchestration | ARSY | Orders 1–4 | Atomic intent, idempotent dispatch, fenced leases, build/deploy/verify transitions and crash recovery — [#184](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/184) |
| 6 | Observed-state reconciliation, application health and audited rollback | ARSY | Order 5 | Failed release preserves last known healthy release; fault-injection and volume-preservation evidence — [#185](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/185) |
| 7 | Operator deployment BFF and UI | HEADQUARTER | Orders 5–6 | Real ARSY-backed lifecycle UI; no direct Docker or database access — [#186](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/186) |
| 8 | Application ingress/domain/TLS architecture decision | Architecture maintainers | ADR 0002; may run in parallel with the core workflow | One provider/owner, private upstream, explicit public-exposure approval and certificate lifecycle — [#187](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/187) |
| 9 | Metrics/logs/alerts operational API | ATLAS owns control-plane integration; external systems own storage | Orders 3–6 and collector contracts | Real source-backed telemetry and alerts with timestamp/freshness |
| 10 | Persistent resource backup/restore and recovery drill | Platform operations owner to be assigned | Stable data/volume contracts from order 6 | Tested restore to isolated target; checksums and application-level verification |
| 11 | Multi-host management, quotas, team/RBAC and operational maturity | ARSY + respective adapter owners | Orders 1–10 | Cross-tenant isolation, concurrency, host failure, recovery and audit tests |

Do not parallelize tasks that change the same API, migration, Compose file, environment schema, or Headquarter route. The repository's DevX collision/treaty tools are advisory; they do not replace isolated branches/worktrees, runtime namespaces or human review.

## 6. Existing issue and pull-request map

This section prevents duplicate backlog creation. State below was re-fetched during the 2026-11-08 audit; always verify again before changing an issue or PR.

| Existing work | What it owns | Current status at audit | Required handling |
|---|---|---|---|
| [Issue #73](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/73) | Broad execution audit, merged delivery evidence and next work | Open umbrella issue; prior body contains older main snapshots and historical PR status | Add this map as current architecture/backlog cross-reference; don't clone another generic execution issue |
| [Issue #155](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/155) | ATLAS DNS/RADIUS/observability control plane | Open; expressly excludes Docker workload execution and assigns ARSY/ATLAS/AEGIS separate roles | Keep ATLAS scope. Link ADR 0002 to state no Docker workload scope; retain its remaining ATLAS acceptance gates |
| [PR #176](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/176) | Current-main successor candidate for ATLAS | Draft; 42 additions and no modifications/deletions against audited main. Rust unit/Clippy/release/image stages passed, but Compose PAP Access-Accept smoke failed; diagnostics failed. Cargo.lock/reproducibility findings remain | Keep draft. Fix exact-head PAP input, diagnostics env and committed locked dependency graph; require real persisted-subscriber Access-Accept before review-ready |
| [PR #156](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/156) | Original ATLAS implementation source | Draft, old base; superseded as merge candidate by #176 | Do not merge directly; #176 is the current successor path |
| [Issue #151](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/151) | AEGIS network runtime foundation | Open | Keep limited to truthful foundation and its stated acceptance; later command protocol/execution work must be separately scoped after contract design |
| [PR #153](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/153) | AEGIS Go runtime foundation | Draft; old base, non-mergeable at audit; modifies root Compose, CI, README and Docker guide while adding apps/aegis/. Some checks passed and other checks were cancelled in observed runs | Rebase/reconcile against current main and exact-head gates; do not add Docker workload responsibilities |
| [Issue #100](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/100) | First real Money Maker vertical slice | Open parent issue | Keep as commerce owner. Do not use it as a PaaS/deployment umbrella |
| [PR #126](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/126) | Persisted commerce workflows across ARSY and Headquarter | Draft, non-mergeable at audit; wide diff across ARSY, migrations, env, Compose, workflows and Headquarter | Reconcile as one commerce successor; do not concurrently edit its hot paths or cherry-pick its overlapping source without current diff review |
| [PR #119](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/119) | Asset provenance and rights inspection | Draft, stacked on older feature ancestry | Integrate only through the settled Money Maker base; no parallel asset ownership |
| [PR #120](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/120) | Channel registry and controlled listing | Draft, stacked on #119 branch | Keep dependency on product/version + asset/inspection contracts; do not merge ahead of dependencies |
| [Issue #121](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/121) | FX, payout and provider reconciliation | Open | Financial-only scope; do not duplicate in deployment/observability |
| [Issue #122](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/122) | Source-backed Aftershock portfolio learning | Open | Analytics-only scope; metrics must be defined from real source events |
| [Issue #123](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/123) | Shared login-attempt throttling | Open | Security owner. Candidate code exists only in draft Money Maker work at this audit; verify before implementing separately |
| [Issue #138](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/138) | HTTP(S)-only evidence/provenance URL schema | Open | Candidate shared validator exists in PR #126; verify exact head and tests before implementation to avoid a second validator |
| [PR #171](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/171) / [#173](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/173) | ORACLE Stage 1 service and ARSY integration | Merged and verified for bounded computation/service-to-service E2E | Preserve ORACLE's computation boundary; durable job recovery remains a separate capability gap |
| [PRs #78/#79/#81/#82](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pulls?q=is%3Apr+is%3Amerged) | Trust-boundary, ARSY security, DX and Divine foundations | Merged | Consume existing primitives; don't create renamed duplicates. Runtime enforcement and durable integration remain gated |
| [ORM PR chain #15–#41](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pulls?q=is%3Apr+15) | ORM declarations, registry, recordsets, UoW, schema planner/reconciler, adapters and System Mode | Old stacked draft candidates; not a current-main implementation. Chain includes #15 → #16 → #18 → #19 → #21 → #23 → #29 → #32 → #34 → #36, with #40/#41 branching from #36; #20 is a separate lifecycle branch | No bulk merge. Revalidate source/contract, port compatible slices to a fresh current-main branch, and prove real PostgreSQL behavior |
| [PR #24](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/24) | Broad UI package expansion and signal-intelligence changes | Open, large stale/non-mergeable branch at prior audit | Extract only independently useful UI components after focused review; do not let it own platform API or deployment behavior |

### 6.1 Current candidate source files and overlap hotspots

| Hotspot | Current main | Candidate changes / collision risk | Ownership rule |
|---|---|---|---|
| ARSY composition root | apps/arsy/src/app.ts, src/index.ts | PR #126 modifies app composition; future PaaS adds routes/services | ARSY owner only; route registration through one composition root |
| ARSY database and migrations | apps/arsy/src/db.ts, apps/arsy/migrations/ | PR #126 adds migrations and a runner; legacy ORM branches add another schema/System Mode design | No independent migration runner without accepted schema-authority decision |
| Docker Connector | apps/arsy/src/docker/* | Future mutations could accidentally extend read-only API | Keep read-only interface; new workload port has separate contract and tests |
| Root Compose/env | docker-compose.yml, .env.example, .env.docker | PR #153 modifies root Compose; PR #126 modifies Compose/env/workflows; PR #176 uses isolated ATLAS Compose | One PR owner at a time; local-dev Compose is not a production deployment definition |
| CI/workflows | .github/workflows/* | PR #153 and #126 add/modify workflows; platform work will add gates | Keep each workflow purpose narrow; never make a green status by skipping failed checks |
| Headquarter route/BFF | apps/headquarter/src/app/api/*, src/lib/arsy-proxy.ts | PR #126 adds many domain routes; future deployment UI would touch same route tree | UI/BFF only; authorization and transition rules stay in ARSY |
| ATLAS application | No apps/atlas on audited main | 42-file candidate in PR #176 | ATLAS-only paths; no Docker socket/workload execution |
| AEGIS application | No apps/aegis on audited main | Candidate in PR #153 | AEGIS-only paths; no general application deployment |
| ORACLE service | apps/oracle/* | Stage 1 queue is in-memory | Keep computation only; do not use as durable deployment orchestration |

## 7. Duplicate/superseded implementation register

| Existing material | Classification | Rule |
|---|---|---|
| packages/bullmq/ | Experimental transport prototype; has placeholder job behavior and incomplete runtime contract | Do not call it canonical jobs/domain API; reuse only after defining queue-agnostic job contracts and tests |
| services/queue/ | Legacy excluded service that wraps BullMQ; not in workspace | Do not add services/* to workspace; extract only unique useful behavior, then retire deliberately |
| apps/oracle/src/oracle/jobs.py | Bounded in-process Stage 1 ORACLE job coordinator | Not durable; must not become deployment job store |
| ARSY SQL migrations | Current direct migration files | Do not introduce a competing ORM/schema lifecycle; reconcile with System Mode target first |
| todo.md | Long-lived historical/roadmap checklist (584 unchecked lines at audit) | Not the official issue backlog; every actionable item must map to a current issue or be verified as obsolete/completed |
| .plan/* | Session/plan artifacts, including stale stubs and tasks | Not a second backlog; never execute without checking current main and issue/PR status |
| Old ORM PR branches | Historical stacked candidate implementation | Source material only; no bulk integration or stale ancestry merge |

## 8. PaaS implementation backlog — active issues and explicit deferred decisions

ADR 0002 is accepted. The following non-overlapping issues now represent the initial dependency graph:

1. [#179 — durable deployment and idempotent operation journal](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/179) — completed in [PR #188](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/188).
2. [#197 — fenced deployment outbox dispatcher](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/197) — completed in [PR #198](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/198); dispatcher remains manually invoked, no startup worker is enabled.
2. [#180 — deny-by-default deployment authorization and approval](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/180) — ARSY authorization gate; valid service-token authentication alone is insufficient.
3. [#181 — isolated Docker Workload Adapter](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/181) — ARSY-only mutation boundary, separate from the read-only Docker Connector.
4. [#182 — isolated OCI build architecture](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/182) — choose and adversarially test build isolation before code is enabled.
5. [#183 — isolated source-to-OCI Build Engine](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/183) — implement only the selected ADR 0003 provider and execution boundary.
6. [#184 — durable deployment orchestration](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/184) — versioned ARSY API, dispatcher, outbox leases, state transitions and crash recovery.
7. [#185 — health reconciliation and audited rollback](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/185) — preserve the previous healthy release and persistent data.
8. [#186 — Headquarter deployment workflow](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/186) — UI/BFF only, backed by stable ARSY APIs.
9. [#187 — ingress/domain/TLS architecture](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/187) — separate ADR required before public exposure or certificate operations.

Existing #73 remains the broad execution audit. Existing #155/#151 and their PRs remain ATLAS/AEGIS work and are not duplicated here. No issue in this list authorizes production exposure, unrestricted Docker API access, or destructive persistent-volume operations.

Every implementation PR must keep one owner, declared paths, explicit non-goals, predecessor references, disposable test resources, security invariants and exact-head CI evidence. The first PR is [#188](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/188); it is draft and must not be merged until all checks and review findings are resolved.

## 9. Rules for parallel execution and file ownership

1. A task declares exact paths, exported interfaces, API routes, schema/migration objects, environment keys and runtime resources before implementation.
2. Two concurrent tasks may not edit the same ARSY composition root, DB migration set, root Compose file, environment schema, Headquarter BFF route, or shared UI token without an explicit integration owner.
3. Separate branches/worktrees do not isolate databases, ports, Redis queues, Docker volumes, container names, test accounts or secrets. Every integration test must use a uniquely named resource namespace and deterministic cleanup.
4. Cross-component work uses consumer/provider contracts. A producer change that breaks a declared consumer must be acknowledged and tested against the same contract fingerprint before merge.
5. A PR may claim completion only from evidence on its exact final head. Historical green checks from an earlier SHA do not satisfy the merge gate.
6. Merged implementation, candidate code, planned architecture and unverified external infrastructure must be reported separately.
7. The repo's DevX collision forecast, interface treaty, resource passport and merge-proof tools are advisory data validators. They are not authenticated GitHub CI gates, locks, sandboxing or authorization.
8. No Docker mutation, external network change, destructive storage action, production secret, deployment or public ingress is permitted under this document alone.

## 10. Verification and update procedure

Before any issue is created or implementation begins:

1. Read the latest main SHA and compare it with this document's audited SHA.
2. Re-fetch the existing issue and every related PR, including head/base SHA, merge state, changed files, reviews and current exact-head checks.
3. Search open and closed issues for the capability and its synonyms.
4. Inspect current source paths and tests; do not infer implementation from PR title or document status.
5. Assign one owner and list the exact files/API/contracts it may change.
6. Add dependencies and a test/rollback plan.
7. Update this map only when a reviewed ownership or implementation fact changes; preserve dated audit snapshots rather than rewriting history.

## 11. Explicit non-goals of this map

- It is not a Coolify parity certification.
- It does not authorize a production deployment.
- It does not add Docker mutation endpoints or expose Docker sockets.
- It does not select a reverse proxy, TLS provider, object store, registry or buildpack system.
- It does not approve merging PR #126, #153, #176 or the old ORM PR chain.
- It does not turn ORACLE, BullMQ, ATLAS or AEGIS into a general-purpose deployment orchestrator.
- It does not claim every component named in the product registry already exists in main.
