# Headquarter Feature Rollout Register

**Authority:** `docs/09-information-architecture.md`  
**Rule:** A route existing does not mean its capability is production-ready. This register distinguishes prototype UI from backend-backed functionality.

## Operational modules

| Module | Route | Owner | Current maturity | Production gate |
|---|---|---|---|---|
| ARSY DECK | `/arsy-deck` | Headquarter / ARSY | Reference UI, demo repository | Public workspace-pulse contract, workspace permission checks, source timestamps, contract tests |
| SIGNAL ROOM | `/signal-room` | Signal domain / ARSY | Prototype | Evidence/search contracts, provenance, pagination, source freshness |
| RIOT RADAR | `/riot-radar` | Opportunity domain / ARSY | Development vertical slice: signed operator session, evidence-backed capture/list/review, idempotent PostgreSQL API, score rationale and hard gates | Browser E2E, migration/backup operations in target deployment |
| THE FORGE | `/the-forge` | Production domain / ARSY | Development vertical slice: approved opportunity → persisted versioned product brief, acceptance criteria and revision notes | Asset binary storage and provenance editor |
| ZILL WATCH | `/zill-watch` | Quality & policy / ARSY | Development vertical slice: append-only rights/policy/technical/creative inspections; READY requires latest four passes | Asset-level inspection, broader evidence policy and browser E2E |
| LAUNCH BAY | `/launch-bay` | Distribution / ARSY | Development vertical slice: evidence-gated C0/C1 registry, C1 manual listing package, operator-recorded publication receipt | Official API integrations, OAuth/account verification, marketplace receipt import and browser E2E |
| SIDRA ARCHIVE | `/sidra-archive` | Asset domain / ARSY | Development vertical slice: authenticated 5 MiB local-volume upload/download/archive, SHA-256 and structured provenance | Object-storage replication, malware scanning, richer provenance editing and browser E2E |
| AFTERSHOCK | `/aftershock` | Analytics / ARSY | Development read model: persisted opportunity/product counts and verified contribution by currency; unavailable cohort metrics are labelled | Source-exposure/conversion events, cohorts, product lifetime and metric denominators |
| MIZAN LEDGER | `/mizan-ledger` | Finance domain / ARSY | Development vertical slice: exact minor-unit events, idempotency, pending/verified/disputed/reversed reconciliation, audit and currency-grouped net contribution | Provider import, payout reconciliation, FX conversion, export controls and production accounting review |
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
5. Before production promotion, each feature must satisfy the Definition of Done in `TODO.md`, including contract, permission, failure-state, accessibility, test, and observability evidence.
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
