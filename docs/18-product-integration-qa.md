# MOONWITNESS Product Integration QA

## Theme contracts

| Experience | Root class | Semantic surface | Expected appearance |
|---|---|---|---|
| Observatory | `theme-observatory` (or app-level `dark`) | `bg-background text-foreground` | Deep instrument canvas, high-contrast lunar text, gold focus |
| Archive | `theme-archive` | `bg-background text-foreground` | Warm paper canvas, deep ink text, editorial rules |

Do not hard-code primitive background/text colors on a themed page root; use semantic tokens so theme changes actually propagate. Brand accent aliases remain available for deliberate highlights, not body copy or status meaning.

## Implemented integration

- Headquarter root retains the application-level dark preference for Observatory.
- Observatory route roots use the Observatory semantic theme.
- Archive route root uses the Archive semantic theme.
- Tailwind font roles map display/UI to Space Grotesk and technical data to IBM Plex Mono with system fallbacks.
- The global UI stylesheet owns the theme variables; Headquarter imports that stylesheet rather than duplicating tokens.

## Release review matrix

| Check | Status | Evidence / follow-up |
|---|---|---|
| Theme token mappings exist | Implemented | `packages/ui/src/styles/globals.css` |
| Observatory/Archive route roots opt into themes | Implemented | Headquarter route pages |
| Font stacks and fallbacks | Implemented | `packages/ui/tailwind.config.js` |
| Automated SVG safety/dimension tests | Implemented | `packages/assets/tests/logo-svg.test.mjs` |
| Desktop/mobile visual snapshots | Pending browser environment | Capture both themes at 1440px and 390px |
| Keyboard/focus and contrast states | Partial / release gate | Run component-level browser accessibility audit |
| Reduced-motion and zoom/reflow | Pending browser environment | Test prefers-reduced-motion and 200% zoom |

This document records implemented code contracts separately from manual browser validation. Do not mark the visual regression/accessibility release gate complete until screenshots and browser audit results are attached.
