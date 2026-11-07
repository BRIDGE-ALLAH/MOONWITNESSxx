# 14 — Governance, Rights, Policy & Risk

**Status:** Approved baseline  
**Version:** 1.0  
**Updated:** 2026-11-07

## 1. Governance principle

A product must be useful, lawful, accurately represented, and permitted on its destination channel. A high AI score cannot overrule a rights, safety, or platform-policy failure.

## 2. Rights and provenance

For each deliverable record:

- Human creator / operator contribution.
- Source assets and ownership/license.
- Generation and editing tools.
- Relevant model/provider terms.
- Prompt/brief and material transformation.
- Font, music, stock, code, plugin, and dependency licenses.
- AI-generated / AI-assisted status.
- Required platform disclosure.
- Derivative and source relationships.

Reject or block assets with unclear ownership, unlicensed reference material, prohibited likenesses, copied characters, trademark misuse, or unsupported commercial rights.

## 3. Marketplace policy governance

Maintain a versioned policy registry per provider:

- Official policy URL.
- Policy name and version/date.
- Last checked date.
- Affected product factories.
- Relevant restrictions and disclosures.
- Integration implications.
- Risk severity.
- Required action.
- Next review date.

A policy watcher may detect and summarize updates, but policy changes that materially affect publication must be reviewed before the system changes its behavior.

## 4. Content quality and trust

- No fake reviews or testimonials.
- No fake sales, clicks, downloads, referrals, traffic, or watch time.
- No false product demonstrations.
- No misleading before/after claims.
- No keyword stuffing or deceptive thumbnails.
- No undisclosed affiliate relationship where disclosure is required.
- No mass-produced near-duplicate submissions.
- No copying public discussion content into products.
- No misleading AI-generated images presented as real evidence.

## 5. Platform automation

Allowed:

- Official documented APIs within scopes.
- User-authorized integrations.
- Manual upload packages.
- Permitted exports and imports.
- Public research that follows source terms and rate limits.

Not allowed:

- CAPTCHA bypass or stealth automation.
- Login/session theft or cookie copying.
- Scraping private or access-controlled areas without permission.
- Fake account or identity.
- Rate-limit or moderation evasion.
- Automated engagement manipulation.
- Unapproved publication through unofficial endpoints.

## 6. Security

- Keep credentials server-side and encrypted.
- Use least privilege and separate tokens per provider.
- Never expose tokens in frontend, URLs, client logs, or source control.
- Redact secrets and personal information.
- Use access controls for assets and customer data.
- Validate file types and scan uploads.
- Restrict worker filesystem/network permissions.
- Maintain backups and restore tests.
- Preserve a tamper-evident audit trail for sensitive operations.

## 7. Financial governance

Never automate:

- Payout destination changes.
- Tax declarations or tax interviews.
- Bank account changes.
- Unbounded ad spending.
- Refund/chargeback decisions with material impact.
- Purchases or subscriptions without approval.
- Financial attestations.

Reconcile actual statements and platform exports. Separate gross sales, fees, refunds, pending balance, settled payout, tax withholding, and FX.

## 8. Sensitive product categories

Require additional review or exclude by default:

- Medical, health, legal, financial, and safety advice products.
- Regulated goods or services.
- Children's data or targeting.
- Political persuasion or sensitive personal profiling.
- Products containing user-generated private data.
- Products with potentially harmful or deceptive claims.

The initial product scope should avoid high-risk regulated categories.

## 9. Risk register

| Risk                                  | Mitigation                                                             |
| ------------------------------------- | ---------------------------------------------------------------------- |
| No marketplace discovery              | Evidence-led niche, listing quality, channel diversity, experiments    |
| Income concentration                  | Multiple product families and channel risk limits                      |
| Rejection or account suspension       | Policy registry, manual fallback, low-risk launch                      |
| Copyright/IP claim                    | Provenance, similarity checks, rights gate                             |
| AI content policy change              | Versioned policy watcher and human review                              |
| Fake metrics or hallucinated research | Evidence citations, source dates, confidence, no synthetic live claims |
| Unexpected compute cost               | Per-run and monthly budgets, model routing                             |
| Duplicate publication                 | Idempotency and external receipt checks                                |
| Payout hold or FX surprise            | Country preflight, tax/payout verification, reconciliation             |
| Security compromise                   | Secret vault, least privilege, audit, backups                          |
| Customer complaint or refund          | Clear product description, support queue, human escalation             |
| Vendor lock-in                        | Exportable assets, provider abstraction, data portability              |

## 10. Incident response

When a suspected policy, security, rights, or payment incident occurs:

1. Pause affected workflow/channel.
2. Preserve logs and evidence.
3. Avoid repeated external calls.
4. Identify affected products and listings.
5. Inform the owner with plain-language impact.
6. Recommend safe remediation.
7. Resume only after the required review and authorization.

## 11. Honest product claims

RIOTWORKS must never claim:

- Guaranteed passive income.
- Guaranteed ranking, search placement, or sales.
- Marketplace approval.
- Live integration without a successful check.
- Legal or tax compliance merely because an AI check passed.
- Human review when none occurred.
