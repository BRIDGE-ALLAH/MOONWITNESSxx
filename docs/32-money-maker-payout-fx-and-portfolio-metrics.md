# MONEY MAKER — Payout, FX and Portfolio Metrics

**Status:** Implemented on the Money Maker delivery branch; exact-head CI and PostgreSQL integration are required before acceptance.  
**Runtime owner:** ARSY / PostgreSQL.  
**Operator UI:** Headquarter / Mizan Ledger and Aftershock.

## Payout lifecycle

A payout is a channel-scoped expected or actual cash movement. It is not gross revenue, net contribution, a provider balance, or a bank balance.

Supported states and transitions:

| Current state | Allowed next states |
|---|---|
| pending | paid, failed, disputed |
| paid | reversed, disputed |
| failed | disputed |
| disputed (never paid) | paid, failed |
| disputed (previously paid) | paid, failed, reversed |
| reversed | terminal |

Every status transition requires an operator rationale, evidence URL and evidence capture timestamp. The append-only payout event history and commerce audit event retain the transition. A paid transition creates a verified payout financial event; a reversed transition creates a verified payout-reversal event. Failed/disputed states do not create cash movements. Reversal is blocked unless the payout was previously marked paid.

New payout creation requires a reviewed, enabled C1-or-higher channel and is always recorded as pending. The source evidence supplied during creation supports the expected payout record; it is not evidence that funds have been paid.

The current workflow is manual statement reconciliation. There is no provider webhook/API ingestion, no inferred success, and no automatic payout destination change.

## Exact FX conversion

FX conversions are immutable records linked to a verified source financial event. The source event, original amount and original currency remain unchanged.

- Amounts are positive integer minor-unit strings.
- The rate is an exact positive rational number: rateNumerator / rateDenominator target minor units per source minor unit.
- Conversion uses integer arithmetic and round-half-up: (sourceMinor × numerator + denominator / 2) / denominator.
- The submitted target amount must exactly match the computed result.
- Rate source, source URL and observed timestamp are required.
- Currency summaries remain separate. An FX conversion does not silently combine IDR and USD totals or rewrite net contribution.

No external FX provider is called by this implementation. The operator records a source-backed rate manually.

## Portfolio metrics

The Aftershock metrics endpoint uses database-side aggregates across the complete owner-scoped cohort; it does not infer lifetime counts from a UI list limit.

All cohort windows are offset-aware ISO timestamps interpreted by PostgreSQL as absolute instants and reported as UTC. The interval is [from, to).

| Metric | Numerator | Denominator / cohort |
|---|---|---|
| Opportunity promotion rate | Non-archived opportunities linked to at least one product as of query time | Non-archived opportunities created in the selected window |
| Product publication count | Products with at least one persisted published listing receipt | Products created in the selected window |
| Product first-sale rate | Products with a verified gross-receipt financial event occurring on/after product creation | Products created in the selected window |
| Retired products | Products with an append-only lifecycle-changed audit event to retired | Products created in the selected window |
| Average completed lifetime | Average seconds from product creation to first recorded retirement event | Retired products in the selected product cohort |

A rate is null when its denominator is zero. Financial totals are sourced from verified events and grouped by currency; no cross-currency aggregation occurs.

### Explicitly unavailable metrics

- **Discovery → opportunity:** unavailable because the product does not yet capture verified impressions/exposures with a defined denominator. An opportunity evidence URL is not an impression.
- **Support burden:** unavailable because there is no persisted support/maintenance case workflow.
- **Demand/retirement recommendations:** not generated until discovery, first-sale and support signals provide a valid comparison basis. The application must not manufacture a recommendation from missing data.

## API surface

- GET /api/v1/payouts?limit=...
- POST /api/v1/payouts
- PATCH /api/v1/payouts/:id/status
- GET /api/v1/fx-conversions?limit=...
- POST /api/v1/fx-conversions
- GET /api/v1/portfolio-metrics?from=...&to=...

Headquarter exposes corresponding same-origin BFF routes. ARSY remains the sole business API and database owner. All endpoints require the configured operator identity and private ARSY service token.

## Verification requirements

- Unit tests cover transition rules, exact rational arithmetic, amount mismatch and authentication.
- PostgreSQL integration tests verify payout history, linked payout/reversal financial events, FX provenance and portfolio cohort aggregates after real inserts.
- The two-instance login limiter integration test uses two independent ARSY pools against the same PostgreSQL database.
- Browser E2E must cover operator login, persisted commerce journey, payout/FX screens, and logout/anonymous isolation.
- No production deployment is approved until managed secrets, TLS/ingress, backup/restore, rollback, monitoring and live smoke tests are evidenced.
