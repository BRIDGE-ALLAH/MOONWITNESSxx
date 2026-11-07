# 32 — MOONWITNESS Universe & Product Architecture Registry

**Status:** Ecosystem architecture baseline; product catalog entries are target identities unless explicitly marked implemented  
**Version:** 1.0  
**Date:** 2026-11-08  
**Repository authority:** `BRIDGE-ALLAH/MOONWITNESS`  
**Related:** [01 Ecosystem Narrative](./01-ecosystem-narrative.md), [02 Product Charter](./02-product-charter.md), [09 Headquarter IA](./09-information-architecture.md), [10 Design DNA](./10-design-dna.md), [15 Roadmap](./15-roadmap-and-acceptance.md), [23 Repository Audit](./23-repository-audit-and-current-execution-plan.md), [24 Repository Governance](./24-repository-and-automation-governance.md), [28 Current-State Revalidation](./28-current-state-revalidation-2026-11-08.md), [31 Product Integrity](./31-product-integrity-phases-36-38.md).

> This document reconciles the wider product universe with the actual MOONWITNESS repository. It is not a claim that every named application, platform, domain, or service has been implemented, deployed, purchased, or approved for production.

## 1. Executive architecture

**MOONWITNESS is the master product identity and evidence-first knowledge, intelligence, and operations ecosystem.** It is designed as a universe of focused product experiences connected through explicit contracts, shared trust foundations, and independently owned domain platforms.

The universe is not one monolithic application and is not identical to this Git repository's current workspace.

- **GODPROMISE** — vision, promise, and ethical commitment narrative.
- **EMPIRE OF THE LIGHT** — the wider institutional, enterprise, knowledge, creative, and community universe.
- **MOONWITNESS** — master technology/product identity for observation, evidence, intelligence, knowledge, and operations.
- **A-L-L-A-H.COM** — intended unified public home and gateway to the wider universe.
- **ROCKSOUL** — a distinct creative/narrative identity and a separate runtime direction. ROCKSOUL DNA (creative expression) and ROCKSOUL Runtime (technical runtime) are different concerns.
- **E-ISP.ID** — connectivity business identity and customer/service ecosystem.
- **RIOTWORKS** — product and operating division within MOONWITNESS, initially owning the creative-commerce workflow. Division-level expression remains subordinate to the MOONWITNESS master identity.

These are product, organizational, and narrative relationships—not claims of spiritual authority or supernatural software capability. Sacred language must be handled respectfully and must never imply divine endorsement, guaranteed blessing, or guaranteed income.

## 2. Product universe: applications are not modules

The wider product catalog is organized as **seven core application experiences plus two additional operational/industry experiences**. These are product identities and target experiences, not nine implemented workspace applications.

| # | Product experience | Primary responsibility | Classification | Repository status |
|---:|---|---|---|---|
| 1 | **GATE** | Public entrance, orientation, discovery, and navigation across the universe | Core application | Target; no `apps/gate` in current workspace |
| 2 | **DOCK** | Community, participation, member activity, and shared spaces | Core application | Target; no `apps/dock` in current workspace |
| 3 | **HEADQUARTER** | Strategic command, governance, portfolio, approvals, and executive oversight | Core application | Implemented as a Next.js prototype at `apps/headquarter`; not production-complete |
| 4 | **MOONWITNESS ID** | Human/service identity experience, account and session management, access visibility | Core application | Product target; identity authority remains server-side in ARSY; no standalone ID app in this workspace |
| 5 | **WORLD OBSERVATORY** | Research, observations, evidence, source context, and knowledge discovery; JIZZ is a related perspective/analysis domain | Core application | Target experience; not a standalone app in this workspace |
| 6 | **MOONSKY** | Communication experience: channels, conversations, routing, and delivery | Core application | Target; no standalone app in this workspace |
| 7 | **HARBOR** | Authenticated E-ISP subscriber portal: account, service, usage, billing, and support | Core application | Target; no standalone app in this workspace |
| 8 | **COCKPIT** | Real-time NOC and infrastructure operations, dispatch, telemetry, and operator actions | Additional operational application | Target; do not merge its live operational workflow into strategic HEADQUARTER |
| 9 | **E-ISP** | Public ISP storefront: plans, coverage, service information, registration, and acquisition | Additional industry application | Target; separate from authenticated HARBOR subscriber experience |

### 2.1 Seven core experiences

The seven core identities are GATE, DOCK, HEADQUARTER, MOONWITNESS ID, WORLD OBSERVATORY, MOONSKY, and HARBOR.

### 2.2 Two additional experiences

COCKPIT and the E-ISP public storefront complete the wider nine-experience product catalog. They are separate because their user journeys and operational responsibilities differ:

- HEADQUARTER answers: what is happening, why it matters, and what decision is needed?
- COCKPIT answers: what is running now, what is failing, and what operational action is required?
- E-ISP answers: what service can a prospective customer buy?
- HARBOR answers: what is the status of an existing subscriber's service and account?

The catalog can grow, but a name is not automatically an application. Promote a product identity to a separately deployed app only when it has a distinct user journey, lifecycle, security boundary, operational owner, and justified deployment need.

## 3. HEADQUARTER modules

The following are modules/workspaces inside HEADQUARTER, not separate top-level applications:

| Module | Responsibility |
|---|---|
| ARSY DECK | Workspace pulse, priorities, approvals, and operator overview |
| SIGNAL ROOM | Source-backed research and market/evidence capture |
| RIOT RADAR | Opportunity evaluation, scoring, and decision records |
| THE FORGE | Product briefs, production coordination, and version lifecycle |
| ZILL WATCH | Rights, integrity, quality, and policy inspection |
| LAUNCH BAY | Channel readiness, listing preparation, and authorized distribution |
| SIDRA ARCHIVE | Assets, source files, provenance, and version continuity |
| AFTERSHOCK | Performance, portfolio learning, and retirement decisions |
| MIZAN LEDGER | Financial events, fees, payouts, reconciliation, and accountability |
| RIOT ENGINE | Agent/workflow runs, schedules, budgets, and execution records |
| Policy Center | Policy configuration and review surfaces |
| Marketplace Accounts | Channel/account eligibility and connection status |
| AI Providers | Provider/model configuration and capability visibility |
| Addon Manager | Restricted technical addon lifecycle interface |
| ORM / Database Health | Restricted technical diagnostics |
| Workspace Settings | Workspace-level preferences and configuration |
| Security and Audit | Security events, access reviews, and audit inspection |

The current Headquarter route and feature registers remain authoritative for what is actually rendered. A route or menu item does not prove that its backend workflow is complete. The current app is explicitly a prototype/demo surface with a persistent disclosure; static/demo values must not be described as live business data.

## 4. Platform and service ownership

Applications are user-facing products. Platforms and services provide reusable capabilities. Engines execute specialized technical work. Keep these layers separate.

| Name | Layer | Owns | Must not become |
|---|---|---|---|
| **ARSY** | Central application/backend authority | API composition, identity authority, authorization, policy integration, orchestration, application contracts, canonical audit boundaries | A second UI app, DNS server, or duplicate infrastructure execution engine |
| **ATLAS** | Infrastructure control plane | Infrastructure inventory, desired state, DNS/observability engine configuration, reconciliation and operator control surfaces | DNS protocol server, metrics database, log storage engine, or replacement ARSY |
| **AEGIS** | Infrastructure execution/runtime | Narrowly scoped infrastructure provisioning and execution behind authenticated internal contracts | Identity authority or a second general-purpose orchestrator |
| **ZILL** | Governance/policy capability | Integrity, rights, quality, protection, policy checks and inspection decisions | Authentication, account identity, or a generic application |
| **MIZAN** | Financial/accountability domain | Financial event classification, reconciliation, and ledger evidence | Generic telemetry or a replacement for a regulated accounting/tax professional |
| **ORACLE** | Intelligence coordination concept | Coordination of reasoning/research capabilities when implemented behind explicit contracts | A second database or unbounded autonomous authority |
| **DIVINE** | Research/domain package | Framework-neutral ontology, attributed research, evaluation and knowledge-method primitives | Spiritual authority or an automatic source of truth |
| **WITNESS FABRIC** | Evidence/trust capability | Evidence lineage, provenance, execution traces, integrity and replay-related primitives | A claim that hashes alone provide signatures or trusted timestamps |

### 4.1 Current ATLAS / AEGIS integration decision

The current GitHub work records ATLAS as a proposed standalone control-plane application in [Issue #155](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/155), and AEGIS as a proposed infrastructure execution foundation in [Issue #151](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/151).

Important unresolved stack conflict: Issue #155 proposes MariaDB for ATLAS operational storage and ClickHouse for log analytics. The previously selected MOONWITNESS direction uses PostgreSQL as the primary transactional database, Redis for cache/transient coordination, VictoriaMetrics for metrics, and VictoriaLogs for logs; ClickHouse and DuckDB were rejected in that architecture discussion. **Do not silently treat MariaDB or ClickHouse as adopted.** Resolve the ATLAS storage/observability proposal through an explicit architecture decision before implementing or provisioning those dependencies.

ARSY remains the identity, authorization, policy, approval, orchestration, and canonical audit authority. ATLAS controls domain infrastructure configuration. AEGIS executes narrowly scoped infrastructure actions. DNS, RADIUS, VPN, firewall, metrics, and log engines retain their own runtime boundaries.

## 5. Knowledge, research, and narrative domains

These are knowledge domains, data products, packages, or research programs. They are not automatically standalone applications:

- **CORPUS** — source-grounded corpus and reference material.
- **QORPUS** — structured knowledge and query/retrieval experience.
- **MFTL** — narrative/knowledge interpretation framework; retain its documented typed domains and provenance.
- **LEGEND** — historical/event records.
- **SUPERHERO** — people/character/entity relationships in the relevant narrative model.
- **RGBL** — exact source-text representation.
- **AWS** — legal applicability domain as defined by its owning specification; do not expand the acronym without that source.
- **JIZZ** — perspective/framing and analysis domain; World Observatory is the user-facing experience, not an automatic synonym for the engine.
- **CORRELATION** — relationships among records and observations.
- **DIVINE** — implemented research package with its own package documentation and phase records.
- **ROCKSOUL Narrative Universe** — original stories, characters, symbols, timelines, source records, and interpretations.

The ROCKSOUL story catalog must preserve the exact supplied spellings and separate verified source, fiction, interpretation, and unresolved reference. The Batteries, IsRockFeel, Walter White, and Mike belong in the narrative/source catalog for research and classification; this registry does not invent their intended relationships or reinterpret the fictional characters. Resolve the exact referent for “Mike” from the originating story/source before assigning a canonical character record.

## 6. Shared ecosystem fabric

Cross-application capabilities should be shared through contracts and clear ownership, not duplicated in every app:

- Identity and authentication — ARSY authority; applications consume scoped sessions/contracts.
- Authorization and policy — central enforcement integrated with ZILL policy capabilities.
- Workspace/tenant context — explicit scope, never inferred from UI state.
- API and event contracts — versioned schemas and compatibility rules.
- Evidence and provenance — source, actor, time, derivation, rights, and verification state.
- Audit and accountability — append-oriented, access-controlled records.
- Jobs and workflows — queue-independent contracts, one transport owner, idempotency and bounded retries.
- Notifications and communication — delivery capability with explicit channel/provider ownership.
- Files and assets — metadata, checksum, access policy, and object-storage adapter.
- Search and knowledge retrieval — source-grounded results with uncertainty and provenance.
- Observability — metrics, logs, traces, health and operational alerts.
- Design system — shared components and tokens, while each experience retains its own information architecture and approved brand scope.

A shared capability does not imply shared database tables without ownership, shared permissions, or universal access.

## 7. Technology and data boundaries

### 7.1 Verified current repository foundations

The current repository includes:
- `apps/headquarter`: Next.js human-facing prototype.
- `apps/arsy`: Fastify API/runtime with app-owned lifecycle and health/readiness behavior.
- `packages/*`: shared UI, contracts/types/policy/notifications/feature flags, assets, Divine, evidence and developer tooling as recorded in the current tree.
- PostgreSQL and Redis in the local Docker Compose stack.
- A scoped, authenticated, owner-scoped, read-only Docker Engine connector through ARSY and Headquarter.
- WITNESS FABRIC, Divine research tooling, repository automation and developer-experience capabilities.

Redis being declared/configured in the local stack does not prove that every intended cache, session, queue, or coordination consumer is already integrated. Verify each consumer before claiming it is active.

### 7.2 Approved architecture targets and constraints

- **Frontend:** Next.js, React, TypeScript.
- **Application API:** Fastify and TypeScript in ARSY.
- **Primary production SQL direction:** PostgreSQL.
- **Lightweight/local SQL direction:** libSQL/SQLite under explicit single-node/write-concurrency assumptions.
- **Query builder:** Kysely internal to concrete SQL adapters; it is not a second ORM.
- **ORM:** custom TypeScript ORM is a target contract in docs/18–22, not an implemented mainline package at the current revalidation.
- **Cache/transient coordination:** Redis is in the local stack; define consumers and failure semantics individually.
- **Metrics:** VictoriaMetrics is the selected metrics direction.
- **Logs:** VictoriaLogs is the selected log-storage direction; do not reintroduce ClickHouse without a new reviewed decision.
- **Events:** NATS is a candidate/target only until contracts, outbox/inbox, deployment, and consumers are implemented.
- **Infrastructure engines:** PowerDNS/CoreDNS, WireGuard, FreeRADIUS, and nftables remain independent engines when adopted. ATLAS/AEGIS integrate and control them through bounded contracts.
- **RADIUS:** FreeRADIUS is the selected engine direction; it is not an ARSY module.

Do not create a second ORM, duplicate backend, duplicate schema authority, or a database per application by default. Database selection follows data ownership, durability, concurrency, and operational need—not brand boundaries.

### 7.3 Implementation truth

At the current repository baseline:
- HEADQUARTER and ARSY are the only canonical application workspaces.
- The Docker connector is read-only; it does not start/stop/exec/deploy containers or manage Compose, domains, TLS ingress, metrics, or rollback.
- The custom ORM, provider adapters, and Base Platform addon suite remain target architecture and are not present as complete mainline implementations.
- Production deployment is **NO-GO** until the separate target, managed secrets, TLS/ingress, backup/restore, monitoring, rollback, and live smoke-test gates are evidenced.
- A passing build or repository CI does not by itself establish production readiness.

Use [docs/28](./28-current-state-revalidation-2026-11-08.md) and [docs/31](./31-product-integrity-phases-36-38.md) for the time-bounded evidence and limitations. These audit snapshots should be superseded by a new dated revalidation, not silently rewritten as if older observations never existed.

## 8. Domain and public entry-point map

All entries below are **proposed naming and routing**, not proof of domain ownership, DNS records, TLS certificates, deployments, or live services.

| Domain | Intended role | Proposed public entry points |
|---|---|---|
| `A-L-L-A-H.COM` | Unified public home for the wider universe | `www`, `gate`, `dock`, `learn`, `community`, `docs` |
| `MOONWITNESS.BIZ.ID` | MOONWITNESS technology/product home | `www`, `hq`, `cockpit`, `id`, `observatory`, `sky`, `api`, `status`, `docs` |
| `E-ISP.ID` | ISP storefront and customer services | `www`, `portal` (HARBOR), `support`, `status` |
| `ROCKSOUL.ID` | Future ROCKSOUL public identity and narrative/runtime home | Reserved for future planning; no subdomain is active or committed |

### 8.1 ROCKSOUL.ID future domain

ROCKSOUL.ID is a future domain the owner intends to purchase. Until the purchase is completed and ownership is verified:
- Treat it as an unregistered/unconfirmed future domain.
- Do not publish DNS records, issue certificates, configure ingress, create production links, or claim it is live.
- Keep ROCKSOUL Runtime and ROCKSOUL creative/narrative identity distinct in product architecture.
- After acquisition, decide whether the apex is a brand home and whether separate runtime/docs endpoints are justified. Do not pre-create subdomains just to reserve names.

### 8.2 Network exposure rule

Public web entry points may expose only deliberately designed frontends and API gateways. PostgreSQL, Redis, NATS, RADIUS control endpoints, internal service APIs, Docker sockets, and infrastructure credentials remain private. A public DNS name does not authorize public network exposure.

## 9. Naming and ownership rules

1. MOONWITNESS remains the master product brand. RIOTWORKS is its product/operating division; division-owned products may use a distinct expression without replacing the MOONWITNESS master identity.
2. HEADQUARTER and COCKPIT are distinct application experiences; do not collapse strategy/governance into real-time NOC control.
3. HARBOR and E-ISP are distinct: authenticated subscriber self-service versus public ISP storefront.
4. GATE and DOCK are product experiences, not ARSY backend services.
5. MOONWITNESS ID is an identity experience; ARSY remains the server-side identity and authorization authority.
6. WORLD OBSERVATORY is an experience; JIZZ is a related domain capability, not a blanket synonym.
7. ZILL WATCH is a HEADQUARTER module; ZILL is a cross-cutting governance/policy capability.
8. MIZAN LEDGER is a financial domain/module; it is not a generic audit log.
9. ARSY, ATLAS, and AEGIS have non-overlapping responsibilities and communicate through versioned internal contracts.
10. A module becomes a separate application only when its user journey, ownership, security boundary, deployment lifecycle, and operational needs justify it.
11. Product catalog status and repository implementation status must always be reported separately.
12. Do not create empty app/package directories as a way to make the product catalog look implemented.

## 10. Roadmap alignment

1. **Repository foundation:** keep the existing mainline reproducible and secure; follow the current execution order in docs/23 and dated revalidation in docs/28.
2. **HEADQUARTER + ARSY:** finish the existing vertical slice and remove prototype/data-truth gaps before adding unrelated applications.
3. **Persistence and Base Platform:** reconcile old ORM PR material against current main; implement only after real PostgreSQL/SQLite adapter contracts, authorization, and recovery tests are proven.
4. **ATLAS / AEGIS:** resolve the MariaDB/ClickHouse versus PostgreSQL/VictoriaMetrics/VictoriaLogs conflict before implementation; preserve ARSY authority and bounded execution.
5. **Knowledge and Observatory:** define source, provenance, licensing, retrieval, and review contracts before creating a separate frontend.
6. **GATE / DOCK / ID / MOONSKY / HARBOR / E-ISP / COCKPIT:** establish independent product requirements, identity, API contracts, and deployment boundaries before adding workspace apps.
7. **ROCKSOUL.ID:** plan brand/domain activation only after domain purchase and owner verification.
8. **Production readiness:** separate deployment, security, backup/restore, monitoring, rollback, accessibility, and live smoke-test evidence from code-level completion.

## 11. Sources of truth and change control

- Brand and narrative: docs/01 and docs/10.
- Initial product scope: docs/02–07.
- HEADQUARTER navigation/module ownership: docs/09 and the Headquarter feature rollout register.
- Technical architecture and ORM/database targets: docs/08 and docs/18–22.
- Repository current-state and execution order: docs/23, superseded for later snapshots by dated docs/28 and subsequent dated revalidations.
- Automation/governance: docs/24.
- Research: docs/16, docs/25–27 and package-level research records.
- Product/runtime integrity: docs/29–31.
- This registry: wider universe, product application catalog, brand/domain relationships, and cross-platform ownership map.

When a source document conflicts with this registry, update the owning source document and this registry in the same reviewed change. Do not copy full technical specifications into this page; link to the canonical owner.

