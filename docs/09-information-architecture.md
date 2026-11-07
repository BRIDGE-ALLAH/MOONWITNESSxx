# 09 — Information Architecture & User Workflows

**Status:** Approved baseline  
**Version:** 1.0  
**Updated:** 2026-11-07

## 1. Navigation model

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
- Workspace Settings
- Security and Audit

## 2. Primary user journeys

### Journey A — Opportunity to product
1. Open SIGNAL ROOM.
2. Review source-backed trend/problem signals.
3. Create an opportunity in RIOT RADAR.
4. Review evidence and assumptions.
5. Run hard-gate checks for rights, policy, and channel eligibility.
6. Approve or reject the opportunity.
7. Create a product brief in THE FORGE.
8. Produce first version.
9. Run ZILL WATCH.
10. Prepare channel package in LAUNCH BAY.

### Journey B — Product to marketplace
1. Select a QA-approved product.
2. Select a verified channel.
3. Check country/account eligibility.
4. Check supported integration capability.
5. Generate listing metadata and previews.
6. Review price and unit economics.
7. Approve first publication.
8. Publish only through an allowed method.
9. Store platform receipt and external listing ID.
10. Track results in AFTERSHOCK and MIZAN LEDGER.

### Journey C — Improve or retire
1. Review product cohort in AFTERSHOCK.
2. Compare discovery, clicks, conversions, refunds, support burden, and contribution.
3. Inspect evidence and timeframe.
4. Select improve, repackage, update, pause, or retire.
5. Preserve version and publication history.
6. Record the experiment and outcome.

### Journey D — Weekly operator review
1. View ARSY DECK.
2. Check exceptions and approvals.
3. Review top opportunities.
4. Check failed or blocked production jobs.
5. Reconcile platform revenue and payouts.
6. Review policy alerts.
7. Approve a bounded next batch.

## 3. Page responsibilities

| Module | Primary object | Main actions |
|---|---|---|
| ARSY DECK | Workspace pulse | Review, prioritize, resolve exceptions |
| SIGNAL ROOM | Evidence item / research run | Search, capture, classify, link evidence |
| RIOT RADAR | Opportunity | Score, compare, go/research/reject |
| THE FORGE | Product / production job | Brief, create, version, package |
| ZILL WATCH | Inspection | Inspect, block, warn, approve for next gate |
| LAUNCH BAY | Channel / listing | Verify, prepare, authorize, publish where permitted |
| SIDRA ARCHIVE | Asset | Preview, version, license, trace |
| AFTERSHOCK | Performance insight | Compare, experiment, improve, retire |
| MIZAN LEDGER | Financial event | Reconcile, classify, export, review |
| RIOT ENGINE | Workflow / run | Schedule, pause, execute, inspect logs |

## 4. Global context

Every module should preserve:
- Current workspace.
- Selected product or opportunity when relevant.
- Date range and timezone.
- Currency display preference.
- Data source / live vs demo status.
- Approval status.
- Relevant agent/run context.

## 5. Dashboard hierarchy

ARSY DECK should answer, in order:
1. Is anything blocked or waiting for approval?
2. What is currently producing, ready, or published?
3. What opportunities deserve attention?
4. What is the real financial position?
5. What has changed since the last review?
6. What should happen next?

## 6. Responsive information architecture

Desktop:
- Expanded navigation.
- Main work canvas.
- Optional context/agent panel.

Tablet:
- Collapsible navigation.
- Context panel becomes a drawer or tab.

Mobile:
- Compact navigation and prioritized operational cards.
- Critical approvals and alerts remain accessible.
- Dense financial tables become readable stacked records rather than horizontal overflow.

## 7. Prototype requirement

The first v0 prototype must fully design ARSY DECK, SIGNAL ROOM, RIOT RADAR, THE FORGE, and ZILL WATCH. Secondary modules must have coherent, useful views—not dead menu items.
