# 05 — Market Intelligence & Demand Gap Mining

**Status:** Approved baseline  
**Version:** 1.0  
**Updated:** 2026-11-07

## 1. Mission

SIGNAL ROOM turns public, permitted, and source-backed signals into product hypotheses. It does not pretend to know private marketplace sales, hidden search volume, or competitor revenue.

The core rule: **no product at scale without a documented buyer problem and a plausible distribution route.**

## 2. Intelligence sources

Potential source classes:
- Public Reddit discussions and community forums.
- Public reviews and Q&A where collection/use is permitted.
- Official marketplace category pages and public search suggestions.
- Official trend and keyword tools.
- Public creator documentation, changelogs, and policy updates.
- Search trends and seasonal calendars.
- RIOTWORKS' own impression, click, conversion, refund, and support data.
- GitHub issues/discussions and open-source project activity for developer/workflow product opportunities.

Use official APIs or permitted public access. Follow site terms, robots/rate limits, privacy and data protection obligations. Do not collect private account data, bypass login barriers, or build personal profiles of commenters.

## 3. Evidence model

Every observation must record:
- Evidence ID.
- Source name and canonical URL.
- Capture time and source publication time, if available.
- Source type.
- Query or research context.
- Exact excerpt or concise permitted summary.
- Topic and buyer job.
- Evidence reliability and limitations.
- Collection method and permission basis.
- Expiry/recheck date.

Separate evidence classes:
- **Observed fact:** directly visible in a trusted source.
- **Community anecdote:** an individual report, not a market-wide statistic.
- **Inference:** reasoned interpretation from evidence.
- **Hypothesis:** an idea needing validation.
- **Unknown:** no reliable evidence yet.

Never convert an anecdote into an industry average.

## 4. Buyer-problem mining

Look for:
- Repeated workarounds.
- Confusing or incomplete existing products.
- Repeated complaints about complexity or missing features.
- Region-specific localization gaps.
- Accessibility barriers.
- Compatibility or format problems.
- Time-consuming repetitive tasks.
- Seasonal needs with predictable lead time.
- Requests for a specific deliverable that can be productized.

Do not copy a commenter’s wording, file, design, or product. Extract the underlying need and create an independent solution.

## 5. Opportunity score

Use a 100-point explainable score:

| Dimension | Weight |
|---|---:|
| Demand evidence strength | 25 |
| Competition / quality gap | 20 |
| Product usefulness and differentiation | 15 |
| Marketplace and buyer-intent fit | 15 |
| Production feasibility and cost | 10 |
| Durability / repeat demand / update potential | 10 |
| Distribution readiness | 5 |

**Policy, rights, country eligibility, and payout feasibility are hard gates, not a small weighted score.** A red hard gate blocks production or publication regardless of the score.

Each dimension must have evidence, confidence, and reason. Missing data lowers confidence and may trigger Research More.

Default decision bands are hypotheses to calibrate:
- 80–100: prototype candidate.
- 65–79: further research or small test.
- Below 65: park or reject.
These bands must not be presented as validated predictive accuracy.

## 6. Research workflow

1. Capture a specific buyer problem.
2. Gather multiple independent evidence points where possible.
3. Check recency and source reliability.
4. Map existing solutions and observable gaps.
5. Identify the exact buyer and job-to-be-done.
6. Select a marketplace with relevant existing discovery.
7. Estimate price and fees using current published data.
8. Check rights, policies, account eligibility, and production complexity.
9. Score the opportunity.
10. Record Go / Research More / Reject with rationale.

## 7. Anti-hallucination requirements

- No invented search volume, competition count, revenue, conversion, ranking, or sales estimate.
- Do not infer a competitor's sales from likes, reviews, ranking, or listing age unless a reliable source explicitly provides that data.
- Distinguish sample data from live platform evidence.
- Store the source and date behind every material claim.
- If evidence cannot be obtained, display "unknown" and lower confidence.
- Clearly label model-generated synthesis and assumptions.

## 8. Out-of-the-box research modes

### Demand Gap Mining
Aggregate recurring problem patterns from permitted public discussion.

### Review Friction Mining
Identify what buyers say is difficult, missing, confusing, or poorly documented in existing products.

### Localization Gap Radar
Compare the needs of a target region against the languages, units, currencies, formats, and examples offered by existing products.

### Seasonal Opportunity Radar
Track events, school calendars, tax/planning seasons, holidays, and recurring buying moments with production lead times.

### Workflow Pain Mining
Use public GitHub issues, discussions, and release notes to identify repetitive developer tasks that could become reusable templates, starter packs, or utilities.

### Format Gap Mining
Find cases where useful information exists but is difficult to use in a particular format—e.g., an unclear guide that could become an accessible checklist or structured spreadsheet, subject to platform rules.

## 9. Research output contract

Each opportunity package includes:
- One-sentence buyer problem.
- Defined buyer segment and job.
- Evidence list with URLs/dates.
- Existing alternatives and observable weakness.
- Product concept and differentiator.
- Candidate channels.
- Price and fee assumptions.
- Hard-gate status.
- Score and confidence.
- Production plan.
- Test plan.
- Stop conditions.
- Last reviewed date.
