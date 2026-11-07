# Headquarter Feature Rollout Register

**Authority:** `docs/09-information-architecture.md`  
**Rule:** A route existing does not mean its capability is production-ready. This register distinguishes prototype UI from backend-backed functionality.

## Operational modules

| Module | Route | Owner | Current maturity | Production gate |
|---|---|---|---|---|
| ARSY DECK | `/arsy-deck` | Headquarter / ARSY | Reference UI, demo repository | Public workspace-pulse contract, workspace permission checks, source timestamps, contract tests |
| SIGNAL ROOM | `/signal-room` | Signal domain / ARSY | Prototype | Evidence/search contracts, provenance, pagination, source freshness |
| RIOT RADAR | `/riot-radar` | Opportunity domain / ARSY | Prototype | Opportunity lifecycle, evidence provenance, decision permissions |
| THE FORGE | `/the-forge` | Production domain / ARSY | Prototype | Brief/product/job contracts, versioning, artifact storage |
| ZILL WATCH | `/zill-watch` | Quality & policy / ARSY | Prototype | Inspection contract, rights/policy enforcement, review audit |
| LAUNCH BAY | `/launch-bay` | Distribution / ARSY | Prototype | Verified account/capability contract, allowed publication workflow, external receipt |
| SIDRA ARCHIVE | `/sidra-archive` | Asset domain / ARSY | Prototype | Asset/version/provenance contract and storage authorization |
| AFTERSHOCK | `/aftershock` | Analytics / ARSY | Prototype | Source-backed event/metric definitions, timeframe, sample size |
| MIZAN LEDGER | `/mizan-ledger` | Finance domain / ARSY | Prototype | Financial event contract, reconciliation, export permissions and audit |
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
