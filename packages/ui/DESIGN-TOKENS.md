# MOONWITNESS UI — Design Token Contract

The source of truth for semantic UI tokens is `src/styles/globals.css`. Primitive brand colors are defined by `packages/assets/brand-tokens.css` and `docs/10-design-dna.md`; Tailwind aliases are defined in `tailwind.config.js`.

## Experience themes

| Semantic role | Observatory | Archive | Usage |
|---|---|---|---|
| Background / foreground | Void / Moonlight | Moonlight / Deep Ink | Primary canvas and readable text |
| Card / popover | Observatory | Warm Moonlight | Elevated content and overlays |
| Secondary / muted | Slate / Lunar Silver | Warm neutral / Muted Ink | Secondary controls and quiet content |
| Primary | Signal Gold | Darkened Eclipse Violet | Main action; pair with a compliant foreground |
| Accent | Eclipse Violet | Dark Gold | Deliberate identity emphasis |
| Destructive | Signal Red | Accessible dark red | Failure and destructive actions |
| Focus | Signal Gold | Darkened Eclipse Violet | Visible keyboard focus |

The Archive theme intentionally overrides inherited dark theme tokens on its route root. A page using `.theme-archive` inside the application-level `.dark` class must render as a light editorial surface.

## Rules

- Prefer semantic classes such as `bg-background`, `text-foreground`, `border-border`, `bg-success`, `text-warning-foreground`, and `ring-focus`.
- Map MOONWITNESS brand primitives to semantic roles; do not use brand colors as substitutes for success, warning, failure, or information.
- Legacy RIOTWORKS Tailwind aliases remain for existing prototype pages only; do not introduce them into new MOONWITNESS product screens. Migrate existing consumers before removing those compatibility aliases.
- Never communicate status, selection, or focus through color alone; pair color with text, iconography, or accessible semantics.
- Use Space Grotesk for display/interface and IBM Plex Mono for technical data, with documented system fallbacks.
- Keep lunar geometry and textures subtle and away from dense data, essential text, and focus indicators.
- Honor `prefers-reduced-motion`. Motion must communicate state or hierarchy, not decorate every interaction.
- Theme switching must preserve semantic meaning and readable contrast in both experiences.

## Verification status

Theme selectors and semantic token contracts have automated source-level tests. This is not browser visual verification or WCAG certification. Rendered-state contrast, keyboard/focus behavior, responsive screenshots, and assistive-technology review remain release gates.
