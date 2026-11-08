# 11 — MOONWITNESS Design System & Skin Framework

**Status:** Canonical design-system foundation; skin framework implementation is a target  
**Version:** 1.2  
**Updated:** 2026-11-08

## 1. Purpose

The MOONWITNESS design system translates one master brand into a consistent, accessible product language across different user tasks.

It must support three distinct experiences without creating three products:

- **Observatory** — operational and research instruments.
- **Archive** — reading, evidence, records, and knowledge.
- **Signal** — expressive public storytelling and community.

The design system owns reusable presentation and interaction infrastructure. Applications own page composition, domain meaning, API access, permissions, and workflows.

## 2. Canonical sources

- [01 — Ecosystem Narrative](./01-ecosystem-narrative.md): why MOONWITNESS exists, its message, values, and narrative boundaries.
- [10 — Design DNA](./10-design-dna.md): the visual language and personality of the master brand and three skins.
- [12 — Brand Architecture](./12-brand-architecture.md): master brand, experience, program, and division hierarchy.
- [13 — Skin System Blueprint](./13-skin-system-blueprint.md): skin architecture, token layering, adoption, and implementation sequence.
- [Asset Brand Kit](../packages/assets/BRAND.md): logo, artwork, usage, and licensing rules.
- [UI Token Contract](../packages/ui/DESIGN-TOKENS.md): current package token semantics and migration rules.

Messaging:

- Core Promise: **SEE MORE. KNOW MORE.**
- Brand Manifesto: **WHEN THE MOON RISES, WE SHARE MESSAGES.**
- Operational verbs: **OBSERVE · RECORD · VERIFY · CONNECT · UNDERSTAND · SHARE**

The Core Promise belongs in product signatures and compact identity contexts. The Manifesto belongs in editorial storytelling, campaigns, About, and selected onboarding contexts. Do not repeat both lines in every component.

## 3. Architecture: separate the visual layers

Do not implement “skin” as a synonym for dark/light mode. Keep the following layers independent:

| Layer | Owns | Example |
|---|---|---|
| Brand primitives | Stable master-brand values and assets | Moonlight, Void, Signal Gold, master mark |
| Semantic tokens | Meaning and accessible roles | background, foreground, focus, danger, success |
| Skin profile | Visual grammar, composition, typography, texture, shape, and component recipes | observatory, archive, signal |
| Appearance mode | Supported light/dark presentation of a skin | dark, light |
| Density | Amount of information and spacing | comfortable, compact |
| Accessibility preferences | Non-negotiable user/system needs | reduced motion, contrast preference, zoom/reflow |

A skin may define a preferred appearance mode, but it must not redefine what success, danger, focus, selected, disabled, or verified means.

### 3.1 Skin profiles

#### Observatory

- Dark-first, cinematic, instrument-like.
- Operational and data-dense layouts with measured grid, stable panels, source trails, timelines, and visible uncertainty.
- Signal Gold is identity/focus emphasis, not a success state.
- Default for Headquarter workspaces and operational experiences unless a route has a stronger reading or storytelling purpose.

#### Archive

- Light-first, warm paper and editorial.
- Reading-oriented layouts with citations, indexes, metadata, provenance, and clear document structure.
- It is not simply the dark theme inverted.
- Default for long-form research, records, documentation, and knowledge retrieval.

#### Signal

- Expressive Moonpunk editorial.
- Poster-like typography, asymmetric compositions, restrained halftone, print grain, manga-line energy, and original illustration.
- Default only for public storytelling, onboarding introductions, community, campaign, and selected launch surfaces.
- Not suitable as the default for dense tables, identity/security settings, finance, or long transactional forms.

### 3.2 Appearance modes

Observatory is dark-first; Archive is light-first. Signal may have light and dark expressions only when each pairing has its own contrast and component review. Do not promise every skin in every mode before it is designed and tested.

The package currently has an Archive root fallback and Observatory/Archive selectors. That is a compatibility baseline, not a decision that every application should default to Archive.

## 4. Token architecture

### 4.1 Brand primitive layer

Maintain the palette and stable identity assets in the brand source of truth. Do not copy raw palette values into every component.

### 4.2 Semantic layer

Define tokens for:

- Text: primary, secondary, muted, inverse.
- Surfaces: canvas, panel, elevated, inset, overlay, scrim.
- Borders: subtle, default, strong.
- Interaction: hover, pressed, focus, selected, disabled.
- Status: success, warning, danger, information, neutral, blocked.
- Evidence: verified, corroborated, unverified, disputed, insufficient, superseded.
- Data visualization: series palette, threshold, baseline, and accessible fallback.

Evidence-quality tokens and job/lifecycle status tokens must remain semantically distinct.

### 4.3 Skin layer

A skin maps its visual personality to semantic roles through skin-scoped values and composition recipes. It may define typography scale, shape, border treatment, grid, texture, elevation, and component-specific emphasis.

Skin-level values must not override semantic status meaning or accessibility requirements.

### 4.4 Component layer

Create component-specific tokens only when a component has a stable need that cannot be expressed cleanly through semantic or skin tokens. Avoid a token for every CSS declaration.

### 4.5 Typography, spacing, shape, and motion

- Typography roles: display, heading, body, label, overline, mono, metric, caption.
- Spacing: 4px base scale with named layout and component steps.
- Shape: skin-aware radii and border treatment, while preserving consistent control affordances.
- Elevation: restrained, layered, and theme-aware; do not use glow as a universal shadow.
- Motion: short, purposeful, state-led, with reduced-motion behavior.

## 5. Layout and responsive system

Desktop may use a persistent navigation region, command bar, main canvas, and optional context panel. These are composable regions, not mandatory chrome on every screen.

- Desktop: support deliberate multi-column workspaces and clear content bounds.
- Tablet: collapse navigation and move context into a drawer or stacked region.
- Mobile: prioritize the main task, use compact navigation, stack data, and keep critical actions reachable.
- Reading surfaces: optimize line length and content hierarchy rather than filling the viewport.
- Poster/editorial surfaces: preserve headline, message, and action order at narrow widths.
- Dense operational surfaces: avoid horizontal page overflow and provide a deliberate table-to-card or scroll strategy.

## 6. Component model

### Foundation primitives

Buttons, links, fields, selection controls, badges, separators, cards, overlays, tooltips, feedback, and typography utilities. Their semantics and keyboard behavior remain consistent across all skins.

### Compositional patterns

Evidence panel, observation record, source citation, provenance panel, archive entry, timeline, metric group, data table, filter bar, empty state, error state, form field, approval presentation, job monitor, and record inspector.

### Experience compositions

An application may create a skin-specific composition when a real user task requires it. Such compositions must use shared primitives and tokens; they must not fork the same component's business behavior.

Do not build every catalog item in advance. Add components when a real consuming application needs them.

## 7. Application and package boundaries

- `@riotworks/ui` owns reusable components, semantic tokens, skin profiles, composition helpers, interaction/accessibility patterns, and visual workbench examples.
- `@riotworks/assets` owns original logo, illustration, texture, and pattern sources plus provenance and registry metadata.
- Applications choose the skin that serves each route or task, compose pages, and own data, permissions, navigation, and workflow state.
- ARSY and backend packages own authorization, business logic, and persisted state; UI skin configuration is never a security boundary.

The `@riotworks/*` scope is a technical package namespace. Public-facing screens follow MOONWITNESS brand architecture.

## 8. Interaction, evidence, and status semantics

Use explicit state vocabulary and visible feedback. Do not collapse the following into one color-coded badge:

- Product lifecycle: draft, ready, published, archived.
- Job execution: queued, running, blocked, failed, completed.
- Evidence quality: verified, corroborated, unverified, disputed, insufficient, superseded.
- Authorization outcome: allowed, denied, requires review.

Every meaningful claim must retain source context and uncertainty. Demo data must be clearly disclosed. No skin may make mock data look more authoritative.

## 9. Accessibility and motion

Target WCAG 2.2 AA:

- Contrast for text, controls, focus, and important graphics.
- Semantic headings, landmarks, labels, and relationships.
- Keyboard-operable navigation and overlays.
- Visible, unobscured focus indicators.
- No color-only or texture-only meaning.
- Reduced motion and no flashing/rapid strobing.
- Readable zoom/reflow and touch-target behavior.
- Meaningful artwork has alt text; decorative art is hidden from assistive technology.

A skin is not approved because its token values look correct in source. Verify the rendered component states.

## 10. Asset rules

- Store original SVG/illustration/texture sources in the repository.
- Use explicit, static asset registry metadata.
- Record source, ownership, license/usage status, accessibility, dimensions, and skin applicability.
- Never hotlink random imagery for production identity.
- Never represent generated artwork as documentary evidence.
- Keep decorative texture away from body text, data, controls, and focus indicators.
- No font binary or third-party art is approved for redistribution without verified rights.

## 11. Quality and release gates

A component or composition is not approved until all applicable checks pass:

- Correct MOONWITNESS master identity and intended skin.
- Semantic colors and evidence/status meanings remain consistent.
- Supported appearance-mode pairings render correctly.
- Desktop, tablet, and mobile layouts are verified.
- Hover, focus, pressed, selected, disabled, loading, empty, error, and success states are defined where relevant.
- Keyboard, accessible names, roles, states, and focus restoration are verified.
- Text and important controls pass rendered contrast review.
- Reduced-motion behavior is verified.
- No dead controls, misleading prototype state, console errors, or unintended overflow.
- Asset and font provenance/rights are recorded.
- Package exports and a real consuming application are tested.

The complete architecture and staged delivery plan live in [docs/13](./13-skin-system-blueprint.md).
