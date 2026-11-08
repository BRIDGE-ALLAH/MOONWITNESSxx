# MOONWITNESS Brand Architecture

**Version:** 1.2  
**Decision:** MOONWITNESS is the master brand; RIOTWORKS is its product and operating division.  
**Updated:** 2026-11-08

## 1. Brand hierarchy

| Layer | Name | Role | Identity rule |
|---|---|---|---|
| Vision / ethical narrative | GODPROMISE | Vision, promise, and ethical commitment | Does not become a software product logo |
| Wider universe | EMPIRE OF THE LIGHT | Institutional, enterprise, knowledge, creative, and community universe | Provides the wider narrative setting |
| Public gateway | A-L-L-A-H.COM | Intended unified home and gateway | Does not replace product-specific identity |
| Master product | MOONWITNESS | Evidence-first knowledge, intelligence, and operations ecosystem | Owns master symbol, wordmark, promise, voice, and visual grammar |
| Experience | Observatory | Research, observation, evidence, operations | Uses the master identity with cinematic instrument expression |
| Experience | Archive | Records, memory, retrieval, provenance | Uses the master identity with warm editorial expression |
| Experience | Signal | Public storytelling, onboarding, community, campaigns | Uses the master identity with expressive Moonpunk editorial expression |
| Program | MOONWITNESS XV | Program/release designation | Typographic descriptor only; never a competing master identity |
| Product division | RIOTWORKS | Product and operating division, initially creative-commerce workflows | Division attribution only where ownership/context is relevant; subordinate to MOONWITNESS |
| Creative identity | ROCKSOUL | Distinct creative/narrative identity | Does not replace MOONWITNESS or become a skin alias |
| Backend authority | ARSY | Application/backend authority and orchestration runtime | Technical identity, not a consumer-facing master brand |

The `@riotworks/*` npm scope is a repository-internal package namespace retained for compatibility and ownership history. It is not a rule that MOONWITNESS product screens must display RIOTWORKS.

## 2. Message architecture

### Core Promise

**SEE MORE. KNOW MORE.**

Primary product promise. It communicates the value delivered by MOONWITNESS and belongs on the primary lockup, concise product signatures, and product entry points.

### Brand Manifesto

**WHEN THE MOON RISES, WE SHARE MESSAGES.**  
Shorthand: **WMR-WSM**.

Poetic expression of the brand's human purpose. It belongs in the About page, editorial/campaign storytelling, launch materials, community messages, and selected onboarding moments. It complements rather than replaces the Core Promise.

### Operational verbs

**OBSERVE · RECORD · VERIFY · CONNECT · UNDERSTAND · SHARE**

Use these verbs to explain the knowledge practice. Preserve evidence provenance and context when sharing information.

## 3. Brand promise and narrative

MOONWITNESS is a bridge between human curiosity, evidence, and a clearer view of the world.

The Moon is a poetic language for changing perspective, cycles, timing, and illumination. The witness is an accountable observer, not surveillance. A message is worth sharing when its source, context, and uncertainty are treated with care.

The brand does not claim supernatural capability, divine endorsement, omniscience, or guaranteed outcomes. It supports human observation, research, memory, creativity, and responsible knowledge-sharing.

## 4. Three experience skins, one master identity

| Skin key | Experience | Primary use | Visual direction |
|---|---|---|---|
| `observatory` | Observatory | Operational, monitoring, research, workbench, decision surfaces | Dark cinematic instrument, lunar geometry, measured precision |
| `archive` | Archive | Reading, evidence, documents, knowledge, provenance | Warm paper, editorial hierarchy, source notes, archival rules |
| `signal` | Signal / Moonpunk Editorial | Landing, onboarding, campaigns, public stories, community | Poster typography, restrained grunge, halftone, manga-line energy |

Skins are visual expression profiles, not sub-brands. All three retain the same master mark, brand promise, evidence semantics, accessibility requirements, interaction conventions, and product truth.

Do not create separate master logos for each skin. Use a small product descriptor when it improves orientation, never as a substitute for MOONWITNESS.

## 5. RIOTWORKS division attribution

RIOTWORKS is an internal product and operating division within MOONWITNESS. It may own a specific workflow, commercial capability, or product surface and may use a division-level visual expression where that ownership is relevant.

Rules:

- Do not append RIOTWORKS to the MOONWITNESS lockup by default.
- Do not show `MOONWITNESS // RIOTWORKS` as a global application signature unless a specific division-owned context requires it.
- Do not use legacy RIOTWORKS Acid Lime or punk-comic styles as the default MOONWITNESS palette.
- Do not rename `@riotworks/*` workspace packages solely to make the technical namespace match the public brand.
- Where RIOTWORKS is credited, make the relationship clear: “A MOONWITNESS product, operated by RIOTWORKS” or an equally clear local descriptor.

## 6. Identity lockups

- **Primary:** master symbol + MOONWITNESS wordmark + Core Promise.
- **Compact:** master symbol only, after legibility testing at the target size.
- **Horizontal:** symbol left, wordmark right.
- **Descriptor:** master lockup plus a small experience/product descriptor (e.g. OBSERVATORY).
- **Monochrome:** one-color symbol/wordmark for stamps, print, and low-color contexts.
- **Manifesto signature:** Core Promise lockup with the Manifesto as a separate supporting line in editorial/campaign contexts.

The archive seal is a supporting archival asset, not a replacement for the primary mark. Preserve clear space, proportions, contrast, and registered asset usage.

## 7. Verbal system

Use confident but measured language. Distinguish facts, observations, recollections, interpretations, hypotheses, and unknowns. Avoid pseudo-technical copy and claims unsupported by product behavior.

Operational microcopy must be plain and direct. Editorial copy may be poetic, playful, or energetic when context remains clear.

## 8. Asset governance

- Source files live in `packages/assets/assets`; declarations live in `packages/assets/src/registry.ts`.
- Each asset records source, license, usage status, accessibility, dimensions, theme applicability, and tags.
- Current original assets remain UNLICENSED for external redistribution until repository-owner rights and licensing decisions are explicit.
- Font families are recommendations only; no font binaries are bundled for runtime under the current policy.
- References to XIV/XV, ROCKSOUL, and other creative works are research inputs, not licenses to copy their artwork, logos, or characters.
- No visual skin may imply that generated illustrations are documentary evidence.

## 9. Source of truth

- Ecosystem, message hierarchy, and narrative boundaries: [docs/01](./01-ecosystem-narrative.md).
- Master visual DNA and skin personalities: [docs/10](./10-design-dna.md).
- Skin architecture and adoption blueprint: [docs/13](./13-skin-system-blueprint.md).
- Component, token, and accessibility contract: [docs/11](./11-design-system.md).
- Asset source, registry, and rights: [packages/assets/BRAND.md](../packages/assets/BRAND.md).

When these sources conflict, update the canonical owner documents together in one reviewed change. Do not use a package README, screenshot, or historical PR as a competing brand authority.
