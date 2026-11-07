# 13 — Domain Model & Data Foundations

**Status:** Approved conceptual model  
**Version:** 1.0  
**Updated:** 2026-11-07

## 1. Design principles

- Model business objects explicitly.
- Keep immutable history for decisions and external actions.
- Separate evidence, assumptions, and generated recommendations.
- Separate asset binaries from metadata.
- Separate marketplace account state from channel capability.
- Separate financial events from dashboard aggregates.
- Preserve provenance and version lineage.
- Do not store credentials in ordinary domain tables or frontend state.

## 2. Core entities

### Workspace
Owner settings, country, timezone, currencies, preferences, and limits.

### MarketSource
Source identity, canonical URL, source type, access method, permission basis, and review status.

### EvidenceItem
Captured observation, timestamp, excerpt/summary, source reference, reliability, and privacy classification.

### Opportunity
Buyer problem, segment, job-to-be-done, channel fit, score, confidence, hard-gate state, and decision history.

### Product
Product family, buyer value, category, lifecycle, owner, and current version.

### ProductVersion
Version number, changelog, deliverables, preview, compatibility, and approval status.

### ProductionJob
Brief, factory, workflow, agent assignments, budget, artifacts, and run state.

### Asset
File identity, storage location, checksum, dimensions/format, creator, source, and metadata.

### ProvenanceRecord
Prompt/brief, tool/model, source materials, license, edits, human contribution, AI disclosure, and derivative links.

### Inspection
Rule set version, findings, evidence, severity, reviewer, decision, and timestamp.

### Channel
Provider identity, eligible product types, countries, policies, capability level, and review date.

### ChannelAccount
External account reference, authorization state, allowed scopes, token reference, and expiry. Never store raw tokens in ordinary app responses or logs.

### Listing
External listing identity, product version, channel, title, description, price, status, and publication receipt.

### Workflow
Schedule, trigger, steps, guardrails, permissions, and version.

### WorkflowRun
Run ID, input, output, costs, logs, idempotency key, approvals, and error state.

### FinancialEvent
Gross sale, commission, royalty, fee, refund, chargeback, tax withholding, adjustment, or payout.

### Payout
Provider, currency, amount, status, destination reference, and reconciliation evidence.

### Experiment
Hypothesis, variable, sample, period, result, confidence, and decision.

### AuditEvent
Actor, action, target, timestamp, before/after summary, authorization, and trace ID.

## 3. Product and asset lifecycle

Product:
IDEA → BRIEF → IN PRODUCTION → QA → READY → PUBLISHED → NEEDS UPDATE / PAUSED → ARCHIVED / RETIRED.

Asset:
INGESTED → INSPECTED → APPROVED → PACKAGED → REFERENCED BY PRODUCT → ARCHIVED.

A new product version does not silently replace an already-published version. Channel updates require their own authorization and receipt.

## 4. Opportunity score model

Store per-dimension score and evidence:
- Demand evidence: 25%.
- Competition/quality gap: 20%.
- Product usefulness/differentiation: 15%.
- Marketplace fit: 15%.
- Production feasibility/cost: 10%.
- Durability/repeat demand: 10%.
- Distribution readiness: 5%.

Policy, IP, country eligibility, payout feasibility, and rights are separate hard gates. A blocked gate prevents production/publishing regardless of numeric score.

Store scoring model version to preserve historical comparability.

## 5. Financial ledger

FinancialEvent should include:
- Provider event ID.
- Product/listing.
- Event type.
- Gross amount.
- Fee amount.
- Refund/adjustment amount.
- Net amount.
- Currency.
- FX rate and source if converted.
- Event date and payout date.
- Pending/settled/reversed status.
- Source evidence.
- Reconciliation status.

Never treat estimates or pending commissions as settled cash. Use append-only corrections instead of silently rewriting financial history.

## 6. Multi-currency model

Preserve original transaction currency and amount. Store converted reporting currency, FX rate, source, and conversion timestamp separately. Keep local timezone and UTC timestamps for events.

## 7. Data retention and privacy

- Collect only data needed for the business function.
- Avoid storing personal data from public community authors unless necessary and lawful.
- Prefer aggregated, anonymized insight over profile-level data.
- Provide deletion/export workflows where appropriate.
- Keep customer information isolated and access-controlled.
- Set retention policies for logs, source snapshots, and generated artifacts.
