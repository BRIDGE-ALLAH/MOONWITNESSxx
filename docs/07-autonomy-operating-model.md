# 07 — Autonomy & Operating Model

**Status:** Approved baseline  
**Version:** 1.0  
**Updated:** 2026-11-07

## 1. Autonomy objective

RIOTWORKS should minimize repetitive owner work while keeping rights, policy, financial, and irreversible decisions accountable.

"Maximum automation" means the system can research, prepare, validate, schedule, report, and execute explicitly permitted operations. It does not mean bypassing platform rules or making unreviewed financial decisions.

## 2. Specialist workforce

| Agent               | Responsibility                             | Output                       |
| ------------------- | ------------------------------------------ | ---------------------------- |
| COMMANDER           | Plans, delegates, prioritizes              | Task plan and run ledger     |
| SCOUT               | Finds public market signals                | Evidence bundle              |
| ANALYST             | Evaluates opportunity                      | Score and confidence         |
| PRODUCT ARCHITECT   | Defines buyer job and product spec         | Product brief                |
| MAKER               | Produces approved creative assets          | Versioned artifacts          |
| EDITOR              | Reviews content, structure, claims         | Editorial report             |
| LOCALIZER           | Adapts region/language/format              | Locale package               |
| METADATA SPECIALIST | Creates channel-specific metadata          | Listing package              |
| ZILL GUARDIAN       | Checks rights, policy, quality             | Inspection report            |
| DISTRIBUTOR         | Prepares/publishes allowed listing actions | Publication receipt          |
| KEEPER              | Manages assets, versions, provenance       | Asset manifest               |
| AFTERSHOCK ANALYST  | Evaluates actual outcomes                  | Learning report              |
| MIZAN ACCOUNTANT    | Reconciles income and costs                | Ledger entries               |
| POLICY WATCHER      | Tracks official rule changes               | Policy alert and review task |

Agents are logical roles. The first MVP may use fewer runtime agents or a single orchestrator with specialized tasks.

## 3. Operating levels

- **L0 — Observe:** gather permitted data, summarize, recommend.
- **L1 — Draft:** create briefs, assets, metadata, and listing packages.
- **L2 — Execute reversible internal work:** organize files, run QA, create versions, update internal records, schedule internal jobs.
- **L3 — External action under explicit authorization:** publish/update only through an official permitted API/integration, within configured scope and budget. First publication on a new channel requires owner approval.
- **L4 — Restricted financial/legal actions:** never delegated autonomously. No payout destination changes, tax submissions, purchases, ad budget increases, refunds, legal attestations, or account ownership changes by an agent.

Level is per action, not per platform. An API that allows analytics read does not authorize publication.

## 4. Human approval requirements

Approval is required for:

- First publication on a platform.
- New product categories with uncertain rights or policies.
- Any uncertain or high-impact IP finding.
- Claims involving health, legal, finance, safety, or regulated products.
- Paid promotion and budget changes.
- Price changes outside a pre-approved rule.
- Customer-facing replies to disputes or exceptional situations.
- Refunds, payouts, tax forms, account settings, and credential permissions.
- Actions that are irreversible or may affect account standing.

Routine pre-authorized internal tasks may run without approval.

## 5. Workflow lifecycle

Every run follows:

Queued → Planned → Executing → Validating → Awaiting Approval (if needed) → Completed / Failed / Cancelled.

Each run stores:

- Run ID.
- Trigger and schedule.
- Agent/model and tool versions.
- Inputs and source references.
- Permission scope.
- Budget and rate limits.
- Idempotency key.
- Steps and timestamps.
- Outputs and checksums.
- Retry state.
- Approval identity and timestamp.
- Errors and recovery action.

## 6. Reliability and safety controls

- Idempotency for external actions where supported.
- Bounded retries with exponential backoff.
- Provider rate limits and quotas.
- Per-run and per-day compute budgets.
- Kill switch by workflow and platform.
- No hidden or infinite loops.
- Approval inbox with expiry.
- Secrets stored in a dedicated secret manager or protected server-side environment, never in frontend or ordinary logs.
- Audit trail for all external mutations.
- Dry-run mode for new workflows.
- Manual fallback package when automation is unavailable.
- Data retention and deletion controls.

## 7. Scheduling

Schedules should support:

- One-time research runs.
- Daily/weekly policy and opportunity monitoring.
- Production queue processing.
- Weekly portfolio review.
- Payout and fee reconciliation reminders.
- Seasonal research with an explicit cutoff date.

Do not continuously scrape a platform. Respect official quotas, caching rules, and terms. Report no-result runs honestly.

## 8. Failure handling

When an external action fails:

1. Stop unsafe retries.
2. Preserve the request and error response.
3. Check whether the external action partially succeeded.
4. Avoid duplicate publication or charging.
5. Present the status as unknown if not verifiable.
6. Offer a safe manual recovery package.

## 9. Operating principle

The owner is a creative director and accountable business operator—not a human button-clicker for every repetitive task, but not an absentee guarantor of an autonomous money machine either.
