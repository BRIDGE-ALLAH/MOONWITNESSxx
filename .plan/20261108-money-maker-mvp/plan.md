# MONEY MAKER — Execution Plan

**Issue:** #100 — https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/100  
**Branch:** `feat/money-maker-mvp`  
**Baseline:** `main` at `8621f861e5e544d8059e5216cc44b550e7077d90` (recheck before every implementation batch)  
**Scope:** Real creative-commerce workflows only. This plan does not reopen ARSY ORM, replace the backend, or duplicate PRs #93/#98/#24.

## Product contract

MOONWITNESS is the evidence-first product. RIOTWORKS is the commercial operating division within it. Initial operator: one owner/operator in Indonesia, selling original digital products globally where eligible.

Initial revenue engines:
1. P1 Digital Utility.
2. P1 Stock Assets.
3. P2 Affiliate Media as a controlled later experiment.

The workflow is:

`Evidence → Opportunity → Product Brief → Product Version / Assets → Rights & Quality Inspection → Channel Listing → Actual Financial Events / Payout → Portfolio Learning`

Truth rules:
- Empty is a valid state. No synthetic records or invented metrics in production.
- Every market claim retains source URL, capture date, evidence class, confidence and limitations.
- Every product retains version and provenance.
- Money uses integer minor units or exact decimal plus ISO currency. Never binary floating-point as financial authority.
- Revenue, gross receipts, payout balance and net contribution are different measures.
- No marketplace write automation until official API permissions, account eligibility and platform policies are verified.
- No agent may change payout destinations, submit taxes, spend advertising budget, issue refunds, or make unapproved financial/legal decisions.
- No unauthenticated access to operator, customer or financial records.
- Keep the current ARSY app as the HTTP backend unless a newer approved repository decision supersedes it. Do not revive stale stacked ORM PRs or add a second backend.

## Phase 0 — Reconcile and establish safe implementation boundary

- [x] MM-0001 Inspect current main identity, default branch and latest main commit.
- [x] MM-0002 Inspect existing product charter, business model, channel strategy, market intelligence, product factories, autonomy model and domain model.
- [x] MM-0003 Inspect actual commerce-facing Headquarter routes and confirm hardcoded/demo behavior.
- [x] MM-0004 Inspect current ARSY app factory, PostgreSQL pool, migrations and route surface.
- [x] MM-0005 Reconcile overlapping PRs #93 and #98 and shared UI PR #24; do not duplicate their changes.
- [x] MM-0006 Search open Issues/PRs for existing Money Maker scope; create Issue #100 because no matching commerce vertical-slice Issue existed.
- [x] MM-0007 Create isolated branch `feat/money-maker-mvp` from main.
- [ ] MM-0008 Re-fetch main and inspect latest merged status of #93/#98/#24 before coding.
- [ ] MM-0009 Inspect the exact current ARSY database contract, migrations, CI service dependencies and package scripts on the implementation base.
- [ ] MM-0010 Decide and document the minimum single-owner authentication/session boundary; fail closed if secrets or identity are not configured.
- [ ] MM-0011 Map existing UI route navigation to the business workflow; preserve current public URLs.

**Exit gate:** one verified implementation base; one backend owner; no unauthenticated business-data surface; no duplicate implementation.

## Phase 1 — Real evidence and opportunity intake

### Domain and persistence
- [ ] MM-0101 Define Opportunity fields from docs/05 and docs/13; keep evidence facts, inference, hypothesis and unknown distinct.
- [ ] MM-0102 Define EvidenceReference fields: canonical URL, source name/type, capture time, publication time when known, summary/excerpt, collection method, permission basis and recheck date.
- [ ] MM-0103 Define hard gates for rights, country/account eligibility, channel policy and payout feasibility; a failed gate blocks promotion.
- [ ] MM-0104 Add additive PostgreSQL migration with constraints, indexes, ownership and timestamps; never reset existing data.
- [ ] MM-0105 Add repository queries with parameterized SQL and transaction-safe writes.
- [ ] MM-0106 Add append-only audit events for opportunity create/update/decision/archive.
- [ ] MM-0107 Add idempotency/conflict handling for repeated submissions.

### API and business rules
- [ ] MM-0110 Add authenticated create/list/read/update/archive routes.
- [ ] MM-0111 Validate evidence URLs and required evidence metadata; reject malformed or empty sources.
- [ ] MM-0112 Validate score components against docs/05 weights; never synthesize missing evidence or default missing dimensions to a positive score.
- [ ] MM-0113 Implement Go / Research More / Reject decisions with hard-gate precedence and rationale.
- [ ] MM-0114 Enforce operator ownership at every read and mutation.
- [ ] MM-0115 Return stable error codes for validation, auth, conflict, not-found and database failures.

### Headquarter
- [ ] MM-0120 Replace Signal Room hardcoded trends/categories/buyer-problem counts with an honest empty state and real opportunity API client.
- [ ] MM-0121 Add opportunity capture form with evidence references and buyer job.
- [ ] MM-0122 Add opportunity detail/review view with evidence class, confidence, score breakdown and hard-gate results.
- [ ] MM-0123 Add loading, empty, error, stale and success states.
- [ ] MM-0124 Keep demo fixtures isolated to explicit development/test mode; do not display them as live data.

### Verification
- [ ] MM-0130 Unit tests for evidence classification, score math, hard-gate precedence and invalid source data.
- [ ] MM-0131 Integration tests against isolated PostgreSQL for create/read/update/archive and persistence after reconnect.
- [ ] MM-0132 Authorization tests for missing/invalid credentials and cross-owner access.
- [ ] MM-0133 Browser E2E: authenticate → create evidence-backed opportunity → review → refresh → confirm persisted state.
- [ ] MM-0134 Verify migration upgrade from the current schema without destructive operations.

**Exit gate:** an operator can create, review and persist a real opportunity with source evidence; no mock market signals or invented confidence values are shown.

## Phase 2 — Product portfolio, provenance and financial ledger

### Product lifecycle
- [ ] MM-0201 Define Product and ProductVersion lifecycle using docs/06 and docs/13.
- [ ] MM-0202 Promote only approved opportunities into product briefs.
- [ ] MM-0203 Record buyer/job, differentiator, product family, target channel, format and acceptance criteria.
- [ ] MM-0204 Add product versioning without overwriting previously approved artifacts.
- [ ] MM-0205 Add Asset and ProvenanceRecord with author/owner, source asset, license, tool/model, edit history, checksum, disclosure and derivative links.
- [ ] MM-0206 Add Inspection records for rights, policy, technical QA and creative QA; blocking findings prevent channel readiness.
- [ ] MM-0207 Replace The Forge sample products and Picsum previews with persisted records and honest empty states.

### Finance
- [ ] MM-0210 Define FinancialEvent and Payout using exact amount, currency, event type, occurred/recorded time, provider reference, source evidence and reconciliation state.
- [ ] MM-0211 Separate gross receipt, fee, refund, chargeback, FX, variable cost, attributable production cost, tax reserve and payout.
- [ ] MM-0212 Implement decimal-safe arithmetic and currency validation; preserve original currency and FX source/rate/time.
- [ ] MM-0213 Add immutable financial event ingestion/manual entry with actor, source and idempotency key.
- [ ] MM-0214 Compute net contribution from persisted events; do not accept client-submitted aggregate totals as authority.
- [ ] MM-0215 Replace Mizan Ledger demo rows with real persisted financial events and explicit no-data states.
- [ ] MM-0216 Add reconciliation status for pending, verified, disputed and reversed events; never count pending commission as received income.

### Verification
- [ ] MM-0220 Unit tests for currency precision, rounding, FX provenance, refunds and contribution formula.
- [ ] MM-0221 Integration tests for product promotion, versioning, provenance and audit history.
- [ ] MM-0222 Integration tests for duplicate financial event idempotency and reversal behavior.
- [ ] MM-0223 E2E: approved opportunity → product brief/version → record cost/receipt → refresh → verify ledger totals.
- [ ] MM-0224 Verify financial aggregates against underlying events.

**Exit gate:** products and their provenance persist; financial totals reconcile to immutable source events; no demo revenue is represented as real.

## Phase 3 — Channel readiness, distribution and portfolio learning

### Channel and listing
- [ ] MM-0301 Create a channel registry with country eligibility, policy review date, payout requirements, capability C0–C4, scopes, quotas and manual fallback.
- [ ] MM-0302 Keep all channels C0/C1 until current official evidence supports a higher capability.
- [ ] MM-0303 Implement channel readiness checks for rights, product format, metadata, disclosure, eligibility and payout setup.
- [ ] MM-0304 Generate listing packages for manual upload before any automated publishing integration.
- [ ] MM-0305 Store Listing and PublicationReceipt only after a real operator action or verified official provider response.
- [ ] MM-0306 Do not implement scraping, stealth browser automation, CAPTCHA bypass or credential sharing.

### Aftershock and operations
- [ ] MM-0310 Compute metrics only from persisted opportunities, products, listings, financial events and support/maintenance records.
- [ ] MM-0311 Define metric numerator, denominator, date window, timezone, currency and source for every displayed metric.
- [ ] MM-0312 Replace Aftershock demo percentages with real cohort and contribution calculations or honest unavailable states.
- [ ] MM-0313 Add product retirement recommendations based on observed discovery, conversion, margin, support burden and relevance; recommendations never silently delete or unpublish.
- [ ] MM-0314 Add bounded workflow runs, retries, idempotency, cost budgets, kill switch and approval records for permitted internal automation.
- [ ] MM-0315 Keep first publication, policy exceptions and material financial/legal actions approval-gated.

### Release hardening
- [ ] MM-0320 Complete critical workflow E2E and regression matrix.
- [ ] MM-0321 Verify permissions, input validation, rate limits, secret handling and audit history.
- [ ] MM-0322 Verify backup/restore and migration rollback procedures for the selected deployment target.
- [ ] MM-0323 Update README and affected product docs to match verified code only.
- [ ] MM-0324 Reconcile all linked Issues/PRs and record exact CI run/commit evidence.
- [ ] MM-0325 Evaluate release readiness; production remains NO-GO without approved target, managed secrets, backup/restore, rollback and live smoke tests.

**Exit gate:** channel capabilities are evidence-backed; financial and performance analytics reconcile to real records; production readiness is reported honestly.

## Execution rules

1. Before each batch, re-fetch main, issue #100, relevant PRs and current CI. Reuse existing PRs where scope overlaps.
2. Implement one dependency-coherent vertical slice at a time; do not create placeholder packages or broad abstractions.
3. Assign file ownership before parallel work. Keep one integration owner.
4. Add tests with the behavior; never suppress failures.
5. Run the actual package lint, typecheck, tests, build and relevant E2E. If unavailable, record NOT RUN, not PASS.
6. Review the complete diff and `git diff --check`; preserve unrelated changes.
7. Commit/push to this feature branch. Integrate only through repository policy and verified CI.
8. Do not bump a release or deploy production until the actual production readiness gate is satisfied.
9. After each verified task, update this checklist and continue to the next dependency-ready task.
10. If blocked, record the exact evidence and proceed with independent safe work.
