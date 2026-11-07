# Headquarter Feature Rollout Register

**Authority:** `docs/09-information-architecture.md`  
**Rule:** A route existing does not mean its capability is production-ready. This register distinguishes prototype UI from backend-backed functionality.

## Operational modules

| Module | Route | Owner | Current maturity | Production gate |
|---|---|---|---|---|
| ARSY DECK | `/arsy-deck` | Headquarter / ARSY | Reference UI, demo repository | Public workspace-pulse contract, workspace permission checks, source timestamps, contract tests |
| SIGNAL ROOM | `/signal-room` | Signal domain / ARSY | Truthful empty state; no live market source or fabricated trend metrics | Approved source connectors, evidence/search contracts, provenance, pagination and source freshness |
| RIOT RADAR | `/riot-radar` | Opportunity domain / ARSY | Operator-authenticated opportunity capture/list, evidence and score review, operator-assessed hard gates, idempotent create, decision changes and archive. Product promotion is wired through The Forge. PostgreSQL and browser E2E workflows are configured; current-head results are pending. | Opportunity edit/detail history, search/filter/pagination, real PostgreSQL and browser E2E PASS, complete product/version lifecycle, asset provenance/storage, inspections and channel listing |
| THE FORGE | `/the-forge` | Production domain / ARSY | Operator-authenticated product portfolio with persisted version-1 brief creation from eligible opportunities, acceptance criteria and product detail API. No product editing or artifact storage. | Product detail UI, version update/lifecycle, artifact storage/provenance, inspection/approval workflows, browser E2E PASS and production persistence verification |
| ZILL WATCH | `/zill-watch` | Quality & policy / ARSY | Truthful empty state; no fabricated inspection results | Real inspection ingestion, rights/policy enforcement and review audit |
| LAUNCH BAY | `/launch-bay` | Distribution / ARSY | Truthful empty state; no channel accounts or publication receipts connected | Verified account/capability contract, allowed publication workflow and external receipt |
| SIDRA ARCHIVE | `/sidra-archive` | Asset domain / ARSY | Prototype | Asset/version/provenance contract and storage authorization |
| AFTERSHOCK | `/aftershock` | Analytics / ARSY | Operator-authenticated persisted counts for the latest 100 opportunities/products and verified financial summary by currency. Counts are explicitly bounded; conversion/cohort metrics are shown as unavailable. | Cursor pagination/full counts, source-backed cohorts, defined denominators/timeframes and lifecycle events |
| MIZAN LEDGER | `/mizan-ledger` | Finance domain / ARSY | Operator-authenticated manual financial-event ledger, retry-safe idempotency, evidence-backed reconciliation, and summaries computed from verified persisted events using integer minor units. No FX conversion or payout provider is simulated. PostgreSQL and browser E2E workflows are configured; current-head results are pending. | Provider integrations, FX contracts, payout lifecycle, export permissions, shared login throttling, reconciliation E2E PASS and verified production database operations |
| RIOT ENGINE | `/riot-engine` | Workflow / ARSY | Prototype | Workflow/run lifecycle, idempotent actions, operator permission, audit |

## Administration

| Capability | Route | Exposure | Current maturity | Gate |
|---|---|---|---|---|
| Workspace Settings / Policy | `/settings-policy` | Existing prototype route | Prototype placeholder | Workspace membership/settings contract, policy model, audit and confirmation |
| Policy Center | — | Disabled roadmap entry | Planned | Approved policy model and role-based write permissions |
| Marketplace Accounts | — | Disabled roadmap entry | Planned | OAuth/credential vault contract, verified health and revoke flow |
| AI Providers | — | Disabled roadmap entry | Planned | Provider secret handling, capability/health contract, operator authorization |
| Addon Manager | — | Disabled roadmap entry | Planned / technical | Signed addon metadata, sandbox lifecycle, permissions, audit |
| ORM / Infrastructure Health | — | Disabled roadmap entry | Planned / technical | Read-only diagnostics API, sensitive-field redaction, technical operator role |
| Security & Audit | — | Disabled roadmap entry | Planned | Append-only audit event contract, access policy, retention/export rules |

## Release rules

1. Planned entries are not links and cannot be opened as if they were implemented.
2. Prototype routes remain visibly marked as demo/prototype and must not imply live status.
3. No navigation visibility decision is a security boundary; ARSY must authorize every protected request.
4. Do not show connected/healthy/running/approved states without a source-backed status and timestamp.
5. Before production promotion, each feature must satisfy its documented acceptance criteria, including contract, permission, failure-state, accessibility, test, and observability evidence.
6. Keep the IA aligned with the approved product journey; technical internals belong in restricted administration, not the daily command surface.


## Emerging domain modules (Phase 7–8)

| Module | Domain owner | Current maturity | Production gate |
|---|---|---|---|
| Decision Graph / WHY Engine | Governance / ARSY | Pure graph contract + integrity assessor; no UI or live data | Append-only decision/evidence API, provenance, redaction, retention, workspace authorization, graph UX |
| Scenario Forge / Shadow Reality | Planning / ARSY | Deterministic shadow-only calculation kernel; no UI or live snapshot | Versioned read-only snapshots, units/freshness, uncertainty model, scenario persistence, explicit approval boundary |

These are foundations, not production features. Scenario results must never be promoted directly to live mutations; Decision Graph explanations must never be mistaken for evidence.


## Emerging modules (Phase 9–10)

| Module | Route | Current maturity | Production gate |
|---|---|---|---|
| Decision Graph Explorer | `/decision-graph` | Read-only synthetic explorer; graph assessment and Decision Debt display | Versioned append-only ARSY graph contract, workspace authorization, redaction/retention, browser accessibility, graph pagination |
| Scenario Arena | `/scenario-forge` | Interactive synthetic scenario comparison; deterministic shadow-only calculations | Versioned ARSY snapshot contract, units/freshness, uncertainty semantics, replay capsule, persistence and authorization |

The interfaces are operator-facing prototypes. No scenario can be promoted to a live mutation; no fixture represents real workspace state.


## Emerging governance modules (Phase 11–13)

| Module | Route | Current maturity | Production gate |
|---|---|---|---|
| Replay Capsule | `/governance-lab` | SHA-256 content-addressed capsule with deterministic replay verification; synthetic only | ARSY signed attestations, trusted timestamp authority, schema/version registry, immutable storage, workspace access control |
| Decision Debt Compiler | `/governance-lab` | Pure compiler for stale/missing/contradictory rationale and downstream impact | Authorized graph snapshot API, append-only review workflow, reviewer identity, event/audit persistence, false-positive evaluation |
| Uncertainty & Governance Gate | `/governance-lab` | Pure low/base/high uncertainty assessment and fail-closed human-review gate | Domain-calibrated thresholds, metric contracts/units, evidence coverage semantics, policy enforcement and approval audit |

The Governance Lab is a read-only prototype. `eligible_for_human_review` is not approval; all states require human approval and ARSY enforcement. SHA-256 is an integrity checksum, not a digital signature or proof of authorship/time.


## Emerging governance modules (Phase 14–16)

| Module | Current maturity | Production gate |
|---|---|---|
| Belief Drift Sentinel | Pure snapshot comparator; descriptive drift findings only | Versioned belief/event contract, source lineage, calibrated review thresholds, temporal evaluation set |
| Counterfactual Blast-Radius Map | Deterministic traversal of explicit `causes` edges; no causal inference | ARSY-owned causal edge provenance, cycle/scale tests, incident-postmortem validation |
| Evidence Expiry Budget | Pure validity-window prioritization and dependent-decision exposure count | Evidence-class-specific validity contracts, trusted timestamps, tenant isolation, append-only expiry/revocation events |

All are prototype domain kernels, not production enforcement. A result can prioritize human review but cannot approve, reject, or mutate a decision.
