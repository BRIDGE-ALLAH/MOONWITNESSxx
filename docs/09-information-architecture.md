# 09 — Information Architecture: Headquarter

**Status:** Approved baseline  
**Version:** 1.1  
**Updated:** 2026-11-07

## 1. Application naming

The user-facing application is named **HEADQUARTER** and lives at apps/headquarter.

The backend application is **ARSY**, located at apps/arsy. Do not use web as the frontend product or app name.

Headquarter is the human-facing RIOTWORKS command center. ARSY supplies the backend API and orchestration runtime.

## 2. Navigation model

### Main navigation

- ARSY DECK
- SIGNAL ROOM
- RIOT RADAR
- THE FORGE
- ZILL WATCH
- LAUNCH BAY
- SIDRA ARCHIVE
- AFTERSHOCK
- MIZAN LEDGER
- RIOT ENGINE

### Administration

- Policy Center
- Marketplace Accounts
- AI Providers
- Addon Manager (admin/technical only)
- ORM / Database Health (admin/technical only)
- Workspace Settings
- Security and Audit

## 3. Primary user journeys

### Journey A — Opportunity to product

1. Open SIGNAL ROOM in Headquarter.
2. Review source-backed trend/problem signals.
3. Create an opportunity in RIOT RADAR.
4. Review evidence, assumptions, and confidence.
5. Run rights, policy, country, and payout hard gates.
6. Approve, research further, or reject.
7. Create a product brief in THE FORGE.
8. Produce a versioned product.
9. Inspect it in ZILL WATCH.
10. Prepare the listing package in LAUNCH BAY.

### Journey B — Product to marketplace

1. Select a QA-approved product.
2. Select a verified channel.
3. Check account and country eligibility.
4. Check channel capability and supported action.
5. Create listing metadata and previews.
6. Review price, fee, and unit-economics assumptions.
7. Approve first publication.
8. Publish only through an allowed method.
9. Store external receipt and listing ID.
10. Track outcomes in AFTERSHOCK and MIZAN LEDGER.

### Journey C — Improve or retire

1. Review product cohorts in AFTERSHOCK.
2. Compare discovery, clicks, conversion, refunds, support burden, and contribution.
3. Inspect data source, timeframe, and sample size.
4. Choose improve, repackage, update, pause, or retire.
5. Preserve product version and publication history.
6. Record the experiment and result.

### Journey D — Weekly owner review

1. View ARSY DECK.
2. Resolve blocked jobs and approvals.
3. Review top opportunities.
4. Check QA failures.
5. Reconcile platform revenue and payouts.
6. Review policy alerts.
7. Approve a bounded next batch.

### Journey E — Platform operations

Technical operators may inspect:

- ARSY liveness/readiness.
- Addon installation/version state.
- ORM model registry.
- Database adapter capabilities.
- Migration status.
- Workflow health.
- Audit and security events.

These technical diagnostics belong in restricted administration views, not the default business dashboard.

## 4. Module responsibilities

| Module        | Main object              | Primary actions                                       |
| ------------- | ------------------------ | ----------------------------------------------------- |
| ARSY DECK     | Workspace pulse          | Review, prioritize, resolve                           |
| SIGNAL ROOM   | Evidence / research run  | Search, capture, classify                             |
| RIOT RADAR    | Opportunity              | Score, compare, decide                                |
| THE FORGE     | Product / production job | Brief, produce, version                               |
| ZILL WATCH    | Inspection               | Inspect, block, review                                |
| LAUNCH BAY    | Channel / listing        | Verify, prepare, publish where permitted              |
| SIDRA ARCHIVE | Asset                    | Preview, version, trace                               |
| AFTERSHOCK    | Performance insight      | Compare, improve, retire                              |
| MIZAN LEDGER  | Financial event          | Reconcile, classify, export                           |
| RIOT ENGINE   | Workflow / run           | Schedule, pause, inspect                              |
| Addon Manager | Installed addon          | Inspect, install/upgrade via controlled operator flow |
| ORM/DB Health | Adapter/model registry   | Diagnose, capability check                            |

## 5. Global context

Preserve workspace, selected product/opportunity, date range, timezone, currency, live/demo status, approval state, and relevant agent/run context.

## 6. Responsive behavior

Desktop: expanded navigation, primary workspace, optional context/agent panel.

Tablet: collapsible navigation and context drawer.

Mobile: prioritized cards, stacked tables, critical approvals and alerts accessible without horizontal scrolling.

## 7. API boundary

Headquarter reads/writes business state through ARSY's versioned API using packages/contract. It must never access database credentials, database adapters, or private schema-administration operations directly. Demo mode must be visually explicit.
