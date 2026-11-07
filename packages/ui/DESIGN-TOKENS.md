# RIOTWORKS UI — Design Token Contract

The source of truth for visual tokens is `src/styles/globals.css`. Tailwind aliases are defined in `tailwind.config.js`. Applications must consume these shared tokens rather than redefining semantic colors locally.

## Theme mapping

| Semantic role | Night Riot | Paper Riot | Usage |
|---|---|---|---|
| Background / foreground | Obsidian / Paper Bone | Paper Bone / Obsidian | App canvas and default text |
| Card / popover | Deep Industrial | Warm paper surface | Grouped content and overlays |
| Secondary / muted | Panel Charcoal | Warm neutral | Secondary controls and quiet surfaces |
| Primary | Acid Lime | Acid Lime | Main action and intentional signal |
| Accent | Riot Orange | Riot Orange | Brand emphasis, not generic status |
| Destructive | Red | Red | Destructive action and failure |
| Success | Accessible green range | Dark green range | Confirmed success only |
| Warning | Amber | Dark amber | Caution and attention |
| Info | Electric cyan range | Dark cyan range | Informational state |
| Focus | Acid Lime | Darkened lime | Keyboard focus indicator |

## Rules

- Prefer semantic classes such as `bg-background`, `text-foreground`, `border-border`, `bg-success`, `text-warning-foreground`, and `ring-focus`.
- Brand utilities such as `text-riot-orange` and `bg-acid-lime` are for deliberate identity moments, not arbitrary status meaning.
- Never communicate success, warning, failure, or selection through color alone; pair color with text, icon, or accessible status semantics.
- Use display typography for short identity-led headings, UI typography for operational reading, and monospace for codes, timestamps, and telemetry.
- Keep corners tight and surfaces structured. Avoid adding glow, gradients, or motion to every component; visual intensity should establish hierarchy.
- Honor `prefers-reduced-motion`. Motion must communicate state or hierarchy, not decorate every interaction.
- Theme changes must preserve semantic meaning and readable contrast in both themes.

## Verification status

The shared semantic foundation and initial Badge/Button mappings are implemented. WCAG contrast measurements, full component migration, visual regression, and browser verification remain open tasks. Do not treat this document as an accessibility certification.
