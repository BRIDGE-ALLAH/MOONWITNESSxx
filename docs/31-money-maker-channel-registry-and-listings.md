# Money Maker Channel Registry & Manual Listing Workflow

## Purpose

The Launch Bay is a persisted registry of channel policy, country/account eligibility, payout requirements, format/metadata limits and evidence. It creates version-bound manual listing packages and records actual submission/publication/withdrawal receipts. It does not log in to marketplaces, publish, scrape, or manage payouts.

## Capability levels implemented

- **C0 — Research only:** channel is recorded but manual listing package readiness is blocked.
- **C1 — Manual package:** current policy, account eligibility, payout and format evidence are present. This permits package generation only; it does not imply API access or permission to publish automatically.
- **C2–C4:** deliberately unavailable in this implementation. A future capability promotion requires official permission evidence, verified scopes, tested integration, quota/error handling, and a separate reviewed release.

The API schema accepts only C0/C1. It does not allow an operator to claim higher capabilities.

## Channel registry

Each owner-scoped channel stores:
- stable channel key and display name;
- seller/account country code and eligibility state;
- official policy URL, review date and recheck date;
- payout requirements and setup state (no bank account numbers, credentials or secrets);
- accepted product families, media types, size/metadata limits;
- granted scope names and quota notes;
- C0/C1 capability and active/paused status;
- optimistic revision number.

Evidence is append-only and includes type, source name/URL, capture time, optional review time, evidence class, summary, limitations and actor. C1 requires official-policy, account-eligibility, payout-requirements and format-requirements evidence. Policy evidence must be classified as an observed fact for listing readiness; account and payout evidence can remain operator attestations and are explicitly identified as such.

## Listing readiness gates

A package is ready only when every gate passes:
1. The selected immutable product version is in review.
2. The channel is active and C1.
3. Country/account eligibility is eligible and supported by evidence.
4. Official policy evidence matches the registered policy URL and is within its recheck window.
5. Payout setup is configured and supported by evidence.
6. The product brief explicitly names the selected channel.
7. Required buyer/product metadata and acceptance criteria are present and within recorded channel limits.
8. At least one asset exists for the exact product version.
9. Every asset has all required inspections from qualified, non-owner trusted actors.
10. Every asset matches accepted channel media types, size limits and the product family is accepted.
11. Channel-specific listing disclosure is supplied.

Unknown information is never treated as a pass. A blocked package is still stored with its exact gate snapshot so the operator can see what remains.

## Deterministic manual package

The generated package is bound to product ID/version and channel ID. It includes:
- immutable product brief and acceptance criteria;
- channel identity, policy dates and payout/format requirements;
- version-bound asset metadata, SHA-256 and provenance (never storage keys);
- channel-specific disclosure;
- readiness gate snapshot and manual upload instructions.

A canonical JSON serialization is hashed with SHA-256. The hash proves the package content is stable; it is not proof of channel acceptance or publication. Idempotency keys make retries safe and reject reuse with different content.

## Real-world receipts

Listing state transitions are evidence-backed:
- `ready` → `submitted` only after an explicit manual-submission receipt;
- `submitted` → `published` only after a publication-confirmation receipt;
- `published` → `withdrawn` only after a withdrawal-confirmation receipt.

Every receipt requires a human confirmation statement and at least one URL/reference. Publication and withdrawal confirmations require a public URL or external listing ID. Receipts record the operator, time, evidence and external identifier. A click, package generation or draft listing never implies submission or publication.

## Non-goals and safeguards

- No automatic marketplace publishing or API write integration.
- No scraping behind login, browser stealth, CAPTCHA bypass or credential sharing.
- No inferred account eligibility, payout readiness, channel acceptance or sales.
- No secrets, bank account details or payout credentials in channel JSON.
- No C2–C4 capability claims.
- No package is marked ready while asset inspection source identity remains untrusted.
