# MOONWITNESS Design System Specification

**Status:** Approved foundation for product integration  
**Version:** 1.3

## Objectives
- Express the MOONWITNESS master identity consistently.
- Balance cinematic observatory atmosphere with evidence readability.
- Support editorial research, dense operational interfaces, and long-form knowledge.
- Provide dark Observatory and warm Archive themes.
- Meet WCAG 2.2 AA as a design target.
- Keep original assets and provenance in `@riotworks/assets`.

## Brand foundations
- Core Promise: **SEE MORE. KNOW MORE.**
- Brand Manifesto: **WHEN THE MOON RISES, WE SHARE MESSAGES.**
- Typography: **MOONWITNESS Signal** — Signal Display, Signal Text, Signal Instrument.
- Identity-critical wordmark and monogram are outlined vector paths.
- Signal Display 0.1 is bundled locally for headings; Signal Text and Instrument use native system stacks.

## Token layers
- Primitive palette: Void, Observatory, Slate, Moonlight, Lunar Silver, Signal Gold, Eclipse Violet, Signal Red, Deep Ink.
- Semantic colors: success, warning, danger, info, neutral, focus, selected, disabled. Never use brand accents as a substitute for status.
- Typography roles: display-2xl, display-xl, display-lg, heading-xl, heading-lg, heading-md, body-lg, body-md, body-sm, label, overline, mono, metric.
- Spacing uses a 4px base scale; radii remain restrained and measured.

## Themes
**Observatory:** dark canvas, elevated instrument panels, lunar-silver secondary information, gold focus, evidence and provenance close to claims.  
**Archive:** warm paper, Deep Ink text, ruled editorial structure, provenance labels, reading widths.

## Component and interaction rules
Components need typed props, empty/loading/error states, keyboard behavior, accessible names/focus, responsive behavior, and theme support. Provide visible hover/focus/pressed/selected/disabled/loading states, support keyboard navigation, respect reduced motion, and confirm destructive actions.

## Asset rules
Store original SVG sources, font source, and declarations in the asset package. Record provenance, license, dimensions, accessibility, and theme. Meaningful artwork requires alt text; decorative artwork must be hidden from assistive technology. Do not present generated artwork as documentary evidence.

## Quality gates
Check dark/light themes, mobile/desktop, keyboard, focus, contrast, loading/empty/error states, provenance, and responsive zoom before release.
