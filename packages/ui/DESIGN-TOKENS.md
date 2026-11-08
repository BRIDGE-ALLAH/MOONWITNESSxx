# MOONWITNESS UI — Design Token & Skin Contract

**Status:** Contract for the current UI foundation and planned Skin System  
**Owner:** `@riotworks/ui`  
**Canonical blueprint:** [docs/13 — Skin System Blueprint](../../docs/13-skin-system-blueprint.md)

## 1. Source of truth

- `docs/10-design-dna.md` defines the MOONWITNESS master visual DNA and skin personalities.
- `packages/assets/brand-tokens.css` defines primitive brand colors.
- `src/styles/globals.css` currently defines the implemented semantic UI tokens.
- `tailwind.config.js` exposes semantic utility aliases.
- `docs/13-skin-system-blueprint.md` defines the intended skin architecture and staged implementation.

Do not treat this document as proof that every planned skin token or runtime selector already exists.

## 2. Keep skin separate from theme mode

| Layer | Responsibility | Examples |
|---|---|---|
| Brand primitive | Stable identity color/material | Void, Moonlight, Signal Gold |
| Semantic token | Meaning that must stay consistent | background, foreground, focus, danger, success |
| Skin profile | Layout, type scale, surface character, texture, composition | observatory, archive, signal |
| Appearance mode | Supported dark/light presentation | dark, light |
| Density | Information and spacing preference | comfortable, compact |
| Accessibility | Required user/system behavior | reduced motion, contrast, zoom |

A skin may set defaults and visual recipes. It must never redefine semantic status meanings, interaction behavior, or accessibility requirements.

## 3. Experience skins

| Skin key | Role | Default presentation | Usage |
|---|---|---|---|
| `observatory` | Cinematic instrument | Dark-first | Operational, monitoring, research, decision workspaces |
| `archive` | Warm evidence editorial | Light-first | Reading, records, documentation, provenance, knowledge |
| `signal` | Moonpunk editorial | Contrast-led; supported modes require verification | Landing, onboarding, public stories, community, campaigns |

Do not use Signal as the default for dense operational data, finance, security, identity settings, or long transactional forms.

## 4. Current implementation selectors

The current stylesheet and UI source support:

- root Archive fallback for consumers that have not mounted `SkinRoot`;
- `.dark` / `.theme-observatory` compatibility selectors;
- `.theme-archive` compatibility selector;
- `[data-mw-skin="observatory"][data-mw-mode="dark"]`;
- `[data-mw-skin="archive"][data-mw-mode="light"]`;
- `[data-mw-skin="signal"][data-mw-mode="dark"]`.

A static typed registry, deterministic resolver, and server-compatible `SkinRoot` are implemented on the Skin Engine feature branch. The root Archive fallback remains for compatibility; it is not a universal application-skin decision. No global picker, preference persistence, React context, or automatic route mapping is implemented yet.

During migration, preserve legacy selectors until all consumers are updated and verified.

## 5. Semantic token rules

Use semantic utilities such as:

- `bg-background`, `text-foreground`;
- `bg-card`, `border-border`;
- `text-muted-foreground`;
- `bg-success`, `text-warning-foreground`;
- `ring-focus`.

Required role families include text, surface, border, interaction, status, and evidence-quality semantics.

- Map brand primitives to semantic roles; do not use brand colors as direct substitutes for success, warning, failure, or information.
- Gold is not success; red is not generic decoration when it conveys danger.
- Never communicate status, selection, focus, confidence, or evidence quality through color alone.
- Keep evidence quality (verified, corroborated, unverified, disputed, insufficient, superseded) distinct from job/product lifecycle states.
- Add component-specific tokens only when a stable shared requirement cannot be expressed through semantic or skin roles.

## 6. Typography, spacing, shape, and texture

- Display/interface: Space Grotesk with robust system fallbacks.
- Technical metadata: IBM Plex Mono with system monospace fallback.
- Long-form editorial serif: optional and only when license/hosting rights are recorded.
- Spacing: documented 4px base scale.
- Shapes and radii: skin-aware but predictable for controls.
- Texture: restrained and never behind dense text, controls, focus indicators, or critical data.
- Motion: state-led, short, optional, and respectful of `prefers-reduced-motion`.

Legacy RIOTWORKS Tailwind palette aliases remain only for existing prototype compatibility. Do not introduce them into new MOONWITNESS screens; remove them only after all consumers have migrated.

## 7. Proposed runtime scope contract

The planned runtime may use a stable application/route root such as:

```html
<div data-mw-skin="observatory" data-mw-mode="dark" data-mw-density="comfortable">
  <!-- application-owned page -->
</div>
```

Allowed skin keys: `observatory`, `archive`, `signal`.  
Allowed modes: `dark`, `light`, only where the pairing is designed and tested.  
Allowed densities: `comfortable`, `compact`.

These attributes are applied by the current `SkinRoot` component. Consumers still choose the skin explicitly; automatic route mapping and preference persistence are not part of this initial foundation.

## 8. Verification status

Source-level token and skin contract tests cover the registry, fallback contract, root attributes, and semantic token presence. They do not prove browser visual correctness or WCAG conformance.

Release gates still include:

- browser verification for every supported skin/mode pairing;
- text, control, border, and focus contrast review;
- keyboard and screen-reader behavior;
- responsive screenshots and 200% zoom/reflow;
- reduced-motion behavior;
- truthful empty/loading/error/demo states;
- asset and font licensing review.
