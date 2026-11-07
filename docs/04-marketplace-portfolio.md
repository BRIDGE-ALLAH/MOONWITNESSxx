# 04 — Marketplace Portfolio & Channel Strategy

**Status:** Approved baseline; platform facts require revalidation at onboarding  
**Version:** 1.0  
**Updated:** 2026-11-07  
**Operator market:** Indonesia, with global distribution where eligible

## 1. Channel principles

A channel is not "supported" merely because it has a website or an affiliate program. Before activation, RIOTWORKS must verify:

1. Country and account eligibility for an Indonesian operator.
2. Identity, age, business, tax, and payout requirements.
3. Current content and AI disclosure rules.
4. Fees, royalties, commissions, refunds, and payout thresholds.
5. Discovery mechanism and realistic time-to-first-discovery.
6. Official API or permitted integration for the exact action.
7. Whether automation is allowed for upload, listing, analytics, and updates.
8. Data export and account portability options.

Store verification date, source URL, reviewer, confidence, and next review date. Platform rules can change without notice.

## 2. Channel capability levels

- **C0 — Research only:** no account or integration; channel is being evaluated.
- **C1 — Manual package:** RIOTWORKS prepares compliant files, metadata, and instructions; owner uploads.
- **C2 — Official read integration:** official API permits limited account or performance reads.
- **C3 — Official write integration:** official API explicitly permits the required create/update/publish action after authorization.
- **C4 — Monitored operations:** C3 plus tested idempotency, retries, audit logs, quota handling, and safe rollback/repair.

Never label a channel connected until authorization and a real health check succeed. Never use unofficial scraping, browser stealth, CAPTCHA bypass, or credential sharing to fake a higher capability level.

## 3. Initial channel portfolio

| Channel               | Product fit                                                                   | Discovery route                               | Indonesia status                                                                          | Default capability                                         |
| --------------------- | ----------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Adobe Stock           | Original stock images, vectors, illustrations, video                          | Stock search and licensing                    | Contributor payments page states Payoneer is required for Indonesia; verify account setup | C1 until exact contributor upload API is verified          |
| Etsy                  | Seller-designed digital downloads and qualifying seller-prompted AI creations | Etsy search, categories, recommendations      | Etsy Payments country eligibility must be checked at shop onboarding                      | C1/C2/C3 only after API permission verification            |
| Gumroad               | Digital files, packs, creator products                                        | Direct store; Discover after eligibility      | Payout setup must be verified for the account                                             | C1 initially                                               |
| Amazon KDP            | Original ebooks and print books                                               | Amazon book search and recommendation         | Confirm tax interview and local payout route during account setup                         | C1; do not assume public publishing API                    |
| Shopee Affiliate      | Honest product recommendation media                                           | Shopee ecosystem and creator content          | Check current in-app affiliate eligibility and payout                                     | C1 until official affiliate tools verified                 |
| TikTok Shop Affiliate | Product video and LIVE referral content                                       | TikTok For You, search, Shop surfaces         | Check country/account/creator eligibility in the Indonesia app                            | C1 until approved tool/API verified                        |
| YouTube               | Original tutorials, explainers, media                                         | Search and recommendations; YPP when eligible | YPP availability and thresholds must be checked in current Studio/official policy         | C1/C2/C3 only for explicitly supported YouTube API actions |
| Roblox                | Experiences, eligible creator assets, in-game products                        | Roblox discovery and Creator Store            | DevEx eligibility and payout/tax setup apply                                              | C1; Creator APIs require separate review                   |
| itch.io               | Original indie games, tools, game assets                                      | itch.io browse/search and creator page        | Confirm payment mode and payout eligibility in creator settings                           | C1 until verified                                          |

This table is a strategy baseline, not a legal or account approval. "C1" means prepare and upload manually unless official capabilities are later documented and tested.

## 4. Platform-specific operating notes

### Adobe Stock

- Use only original or properly licensed assets.
- Follow contributor generative-AI labeling and content requirements.
- Avoid near-duplicate submissions and misleading titles/keywords.
- Adobe's payment requirements page, updated 2026-09-02, states a US$25 royalty balance and 45 days after the first sale before requesting payout; it states Payoneer is required for contributors in Indonesia. Recheck this on account setup.
- Never assume all uploaded assets will be accepted or licensed.

### Etsy

- Respect Etsy Creativity Standards and listing requirements.
- Seller-prompted AI creations are permitted only within the applicable standards; AI use must be disclosed in the listing description.
- AI prompt bundles and listings that do not meet the Creativity Standards are not allowed.
- The seller must contribute original design, direction, selection, or meaningful creative work.
- Do not assume generic mass-produced AI packs are acceptable.
- Confirm Indonesia shop onboarding, payment reserve, listing, transaction, processing, and any setup fees in the live seller flow.

### Gumroad

- Separate direct sales from Discover sales in the ledger.
- Current Discover documentation requires payout settings, at least US$100 in genuine sales, risk review, and product-level eligibility conditions. The review may take time.
- Do not present Discover as guaranteed traffic or an immediate first-sale source.
- Check current fees, payout method, tax handling, and product rules before activating.

### Amazon KDP

- Use original, properly licensed text, images, and translations.
- Disclose AI-generated text, images, or translations when required by KDP; distinguish AI-generated from AI-assisted work.
- Never create thin, repetitive, misleading, or rights-infringing books.
- Verify tax interview, withholding, payout, trim, cover, metadata, and content requirements before submission.

### Affiliate platforms

- Promote only eligible products with accurate descriptions, truthful demonstrations, and required disclosures.
- Commission rates, campaign availability, product eligibility, creator thresholds, and payout rules can vary by account and category.
- Do not treat TikTok One / Creator Marketplace criteria as universal TikTok Shop Affiliate criteria.
- No fake reviews, false claims, fabricated demonstrations, or undisclosed material relationships.
- Preserve original content and affiliate attribution evidence.

### YouTube

- Build original, useful, and meaningfully differentiated media.
- AI assistance is not a blanket monetization ban, but repetitive, mass-produced, reused, or low-value content can fail monetization policies.
- Keep scripts, research, edit decisions, project files, sources, and transformation records as evidence of original production.
- Do not infer monetization eligibility from view counts alone; verify current YPP conditions in YouTube Studio.

### Roblox

- DevEx is not a simple automatic withdrawal. Current official documentation lists requirements including age 13+, at least 30,000 Earned Robux, verified email, valid DevEx portal, W-8/W-9 tax documentation, and ongoing compliance.
- Current standard DevEx conversion is 0.0038 USD per Earned Robux, subject to program terms and Roblox discretion.
- Avoid template-game abuse and fake engagement. Roblox explicitly excludes some non-genuine or violative Robux from Earned Robux.

## 5. Marketplace launch sequence

### Initial pilot

1. Adobe Stock — stock asset package and metadata workflow.
2. Etsy — original digital utility/product package after policy and seller eligibility checks.
3. One affiliate channel — only after account eligibility and product disclosure workflow are confirmed.

### Second wave

4. Amazon KDP — after editorial and disclosure controls are working.
5. Gumroad — as a product storefront; Discover only after eligibility conditions are met.
6. YouTube — as a long-term media and discovery asset.

### Experimental

7. Roblox creator products and microgames.
8. itch.io creator products.
9. Other extension, plugin, audio, 3D, or creator marketplaces only after a source-backed channel assessment.

## 6. Channel registry fields

For every channel store:

- Provider and account identifier (never store raw secrets in ordinary records).
- Country/region.
- Eligibility state and evidence.
- Payment method state.
- Policy version / last checked date.
- Permitted product categories and file specifications.
- API capability level C0-C4.
- API scopes and authorization expiry.
- Rate limits and quota notes.
- Last successful health check.
- Known failure modes.
- Manual fallback instructions.
- Next policy review date.

## 7. Stop conditions

Pause a channel when:

- Account eligibility is unclear or revoked.
- Required tax or payment setup is incomplete.
- Platform rules conflict with the product.
- Integration relies on an unofficial or prohibited mechanism.
- Rights or provenance cannot be established.
- Unexpected rejection, suspension, or payout hold occurs.

The operator must be shown the reason and the next safe action.
