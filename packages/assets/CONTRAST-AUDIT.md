# MOONWITNESS Contrast Audit — v1

**Scope:** brand palette and semantic UI pairs used by the light Archive/editorial and dark Observatory themes.  
**Method:** WCAG 2.2 relative luminance calculation; normal text target 4.5:1, large text target 3:1, non-text UI boundaries/focus target 3:1.  
**Status:** initial palette audit; validate rendered component states before release.

## Approved semantic pairings

| Theme | Foreground | Background | Approx. contrast | Result |
|---|---|---|---:|---|
| Archive | Deep Ink `#171923` | Moonlight `#F4F1E8` | 15.50:1 | Pass |
| Archive | Muted text `#555966` | Moonlight `#F4F1E8` | >6:1 | Pass |
| Archive | Darkened violet `#5D4B91` | Moonlight `#F4F1E8` | >6:1 | Pass |
| Archive | Dark gold `#6F5723` | Moonlight `#F4F1E8` | >6:1 | Pass |
| Observatory | Moonlight `#F4F1E8` | Void `#090A0F` | 17.51:1 | Pass |
| Observatory | Lunar Silver `#AEB6C6` | Void `#090A0F` | 9.71:1 | Pass |
| Observatory | Signal Gold `#E8BD62` | Void `#090A0F` | 11.19:1 | Pass |
| Observatory | Moonlight `#F4F1E8` | Observatory `#121521` | 16.10:1 | Pass |

## Known unsafe combinations

- Original Signal Gold on Moonlight is decorative only; do not use for normal text (approximately 1.56:1).
- Original Eclipse Violet on Moonlight is below normal-text AA (approximately 4.47:1); Archive semantic accent is darkened.
- Original Signal Red on Observatory is borderline below normal-text AA (approximately 4.44:1); use it for icons/status fills with a separately compliant text color, not small text.
- Lunar Silver on Moonlight is not a text color (approximately 1.8:1).
- Never assume a palette color is accessible on every surface. Use semantic tokens and test actual component states.

## Implementation

- `packages/ui/src/styles/globals.css` maps semantic roles for default Archive, `.theme-archive`, `.dark`, and `.theme-observatory`.
- Focus ring colors are darkened for light surfaces and gold for dark surfaces.
- Color must not be the only signal for status, error, selection, or focus.

## Remaining validation

- Run browser-based contrast checks against computed styles for every shipped component and state.
- Include hover, focus-visible, disabled, placeholder, selected, destructive, chart, and overlay states.
- Capture visual regression screenshots in both themes at desktop and mobile breakpoints.
