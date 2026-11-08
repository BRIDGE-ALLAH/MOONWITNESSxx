# 11 — MOONWITNESS Design System Specification

**Status:** Approved foundation for product integration
**Version:** 1.1
**Updated:** 2026-11-08

## 1. Design system objectives

- Express the MOONWITNESS master identity consistently.
- Balance cinematic observatory atmosphere with evidence readability.
- Support editorial research, dense operational interfaces, and long-form knowledge.
- Provide consistent dark Observatory and warm Archive surfaces.
- Deliver reusable, composable React components.
- Meet WCAG 2.2 AA as a design target.
- Keep original graphic assets and their provenance in `@riotworks/assets`.
- Avoid generic SaaS, decorative sci-fi HUD, and unrelated studio-brand drift.

## 2. Brand foundations

Source of truth:
- `docs/10-design-dna.md` — visual DNA and brand principles.
- `docs/01-ecosystem-narrative.md` — ecosystem hierarchy, narrative, and message architecture.
- `packages/assets/BRAND.md` — asset usage and licensing.
- `packages/assets/brand-tokens.css` — primitive brand tokens.

Messaging:
- Core Promise: **SEE MORE. KNOW MORE.**
- Brand Manifesto: **WHEN THE MOON RISES, WE SHARE MESSAGES.**
- Operational verbs: OBSERVE · RECORD · VERIFY · CONNECT · UNDERSTAND · SHARE.

The Core Promise belongs in product signatures and compact identity contexts. The Manifesto belongs in editorial storytelling, campaign, About, and selected onboarding contexts. Do not repeat both lines in every component.

## 3. Token layers

### Primitive colors
Use the MOONWITNESS palette from `docs/10-design-dna.md`:
- Void `#090A0F`
- Observatory `#121521`
- Slate `#242A38`
- Moonlight `#F4F1E8`
- Lunar Silver `#AEB6C6`
- Signal Gold `#E8BD62`
- Eclipse Violet `#7664A8`
- Signal Red `#C95B5B`
- Deep Ink `#171923`

### Semantic colors
Define independent tokens for success, warning, danger, info, neutral, focus, selected, and disabled. Brand accents must not be used as a substitute for semantic status. Never encode meaning through color alone.

### Surface layers
- canvas
- elevated canvas
- primary panel
- secondary panel
- inset panel
- border
- strong border
- overlay
- scrim

### Typography tokens
- display-2xl, display-xl, display-lg
- heading-xl, heading-lg, heading-md
- body-lg, body-md, body-sm
- label, overline, mono, metric

Use Space Grotesk for display/interface and IBM Plex Mono for technical data, with system fallbacks. Both upstream families are documented under SIL OFL 1.1 in `packages/assets/fonts/`; see the license record for reserved-name and redistribution conditions. Font binaries remain excluded until a pinned, hash-verified import is justified.

### Spacing, shape, and border
Use a consistent 4px base spacing scale. Prefer deliberate grids, generous whitespace, and restrained radii. Use measured lines and rules as editorial structure; avoid ornamental borders that compete with evidence.

## 4. Experience themes

### Observatory
- Default dark canvas and elevated instrument panels.
- Lunar Silver for secondary information; Signal Gold for focus and primary emphasis.
- Fine orbital geometry used at low opacity.
- Evidence, sources, dates, confidence, and uncertainty remain visible.

### Archive
- Warm Moonlight paper surfaces and Deep Ink text.
- Restrained rules, indexing, metadata, and provenance labels.
- Editorial reading widths and document-first hierarchy.
- Avoid treating Archive as a simple inverted dark theme.

## 5. Layout system

Desktop:
- Persistent left navigation.
- Top command bar.
- Main canvas.
- Optional right contextual panel.
- Content max widths appropriate to the task.

Tablet:
- Collapsible sidebar and contextual drawer.

Mobile:
- Compact navigation.
- Prioritized cards and stacked data rows.
- Persistent access to critical approvals and alerts.

Use responsive grids and avoid horizontal page overflow.

## 6. Component catalog

Core:
- MoonWitnessAppShell
- MoonWitnessSidebar
- MoonWitnessTopbar
- MoonWitnessCommandPalette
- EvidencePanel
- ArchiveCard
- ObservationCard
- SourceCitation
- ProvenancePanel
- Timeline
- MapPanel
- MoonWitnessButton
- MoonWitnessBadge
- MoonWitnessDialog
- MoonWitnessToast
- EvidenceTable
- FormField
- EmptyState
- Skeleton
- HalftoneSurface
- OrbitalSurface
- TechnicalStamp

Components must have typed props, clear variants, sensible empty/loading/error states, keyboard behavior, accessible names and focus, responsive behavior, theme support, and no dead controls.

## 7. Status system

Standard status vocabulary:
- DRAFT
- QUEUED
- RUNNING
- NEEDS REVIEW
- BLOCKED
- READY
- PUBLISHED
- PAUSED
- FAILED
- ARCHIVED

Evidence quality vocabulary:
- VERIFIED
- CORROBORATED
- UNVERIFIED
- DISPUTED
- INSUFFICIENT
- SUPERSEDED

Do not conflate product lifecycle, job execution, policy inspection, and evidence quality states.

## 8. Data visualization

- Use chart labels and units.
- Mark demo data clearly.
- Show date range and timezone.
- Provide accessible table/data alternative when a chart is important.
- Avoid decorative charts with invented business meaning.
- Reserve brand colors for emphasis, not arbitrary series coloring.

## 9. Interaction and motion

- Provide visible hover, focus, pressed, selected, disabled, and loading states.
- Support keyboard navigation.
- Respect reduced motion.
- Use short, purposeful transitions.
- Do not animate evidence or metrics in misleading ways.
- Toasts confirm only completed prototype actions or verified real actions.
- Confirm destructive or irreversible actions.

## 10. Asset rules

- Store original SVG/illustration sources in the repository.
- Use explicit asset names and static registry metadata.
- Keep logo, symbol, texture, illustration, and icon families versioned.
- Avoid hotlinked random images for production identity.
- Document licensing and source for all third-party assets.
- Meaningful artwork requires alt text; decorative artwork must be hidden from assistive technology.
- Never present generated artwork as documentary evidence.

## 11. Accessibility

Target WCAG 2.2 AA:
- Sufficient contrast.
- Visible focus.
- Semantic headings and landmarks.
- Labels for inputs.
- Screen-reader descriptions for meaningful artwork.
- No color-only states.
- Accessible dialogs and menus.
- Keyboard-operable navigation.
- Reduced motion.
- Readable type and responsive zoom behavior.

## 12. Quality gates

A component is not approved until:
- Dark Observatory and warm Archive theme states are checked.
- Desktop and mobile states are checked.
- Keyboard operation is checked.
- Focus and contrast are checked.
- Loading/empty/error states are defined.
- Provenance and licensing are recorded for assets.
- No overflow, misleading status, or unsupported certainty appears.
