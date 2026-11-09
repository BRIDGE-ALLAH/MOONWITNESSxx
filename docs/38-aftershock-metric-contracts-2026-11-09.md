# Aftershock metric contracts — 2026-11-09

## Purpose

AFTERSHOCK is a source-backed portfolio learning surface. It reports outcomes observed in persisted ARSY records; it does not infer web impressions, market demand, provider synchronization, or lifetime performance from a bounded Headquarter list.

All reporting windows use UTC and the half-open interval **[from, to)**. The product/opportunity records created inside the interval form the cohort. Outcome events are observed only from the record's creation timestamp up to, but not including, `to`. A future-dated outcome must not leak into an earlier report.

## Metric definitions

| Metric | Numerator | Denominator | Source / rules |
| --- | --- | --- | --- |
| Opportunity promotion rate | Cohort opportunities with at least one linked product created on/after the opportunity and before `to` | Non-archived opportunities created in [from,to) | `arsy_opportunities.created_at/archived_at`, `arsy_products.opportunity_id/created_at` |
| Product publication count | Cohort products with at least one published listing and `published_at` in [product.created_at,to) | Products created in [from,to) | `arsy_listings.status/published_at` joined to matching product/version |
| Product first-sale rate | Cohort products with at least one verified `gross-receipt` whose `occurred_at` is in [product.created_at,to) | Products created in [from,to) | `arsy_financial_events`; one product counts once, regardless of sale count |
| Product retirement count | Cohort products with an audited `lifecycle-changed` event to `retired` in [product.created_at,to) | Products created in [from,to) | `arsy_commerce_audit_events`; no lifecycle changes are recommended or executed by analytics |
| Average completed product lifetime | Sum of creation-to-first-retirement seconds | Cohort products with a qualifying audited retirement before `to` | Open/not-yet-retired products are right-censored and excluded |

The response includes explicit numerator and denominator counts for opportunity promotion and first-sale rates. Product sales are counted as product events, not currency-normalized monetary value. Financial amounts remain currency-specific in MIZAN and are not summed across currencies in AFTERSHOCK.

## Availability and freshness

- Discovery-to-opportunity conversion is **unavailable** until a trusted impression/exposure event source exists. Evidence citations are not exposure denominators.
- Support burden is **unavailable** until persisted support/maintenance cases and their lifecycle exist.
- Aggregates execute in PostgreSQL over the complete owner-scoped cohort; they are not calculated from the latest 100 UI records.
- `generatedAt` is the response computation time. It is not a provider-sync timestamp.
- Provider outcomes appear only after an operator or an authorized, documented integration records them. No provider automation or external market feed is implied.
- Empty denominators return a null percentage, not zero percent.
- Retirement/unpublish recommendations remain advisory. A human must authorize any material lifecycle action.

## Verification

The ARSY contract test verifies query bounds, numerator/denominator definitions and unavailable-state disclosure. The disposable PostgreSQL integration fixture creates two cohort products: one with publication and a verified sale before `to`, another with both outcomes after `to`. The report must count two cohort products but only one published product and one first-sale product (50%). The fixture is synthetic CI data, not marketplace evidence.

## Boundaries

This contract does not claim live marketplace analytics, impressions, conversion funnels, revenue attribution, provider reconciliation, or automatic product retirement. It formalizes the metrics that current persisted source events can support.
