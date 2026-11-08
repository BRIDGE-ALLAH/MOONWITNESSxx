# Headquarter route-aware skin runtime

**Date:** 2026-11-09  
**Repository:** `BRIDGE-ALLAH/MOONWITNESS`  
**Foundation:** PR #257 — typed MOONWITNESS Skin Engine

## Runtime contract

Headquarter now resolves the experience skin from the current route and applies it to the complete application shell through `@riotworks/ui` `SkinRoot`.

| Route family | Skin | Default mode |
|---|---|---|
| `/sidra-archive` and descendants | Archive | Light |
| All other Headquarter routes | Observatory | Dark |
| Signal | Internal specimen only | Dark |

The route resolver deliberately keeps Signal off operational routes until a real public/editorial destination exists.

## Appearance mode

Observatory and Archive support both dark and light modes. The active mode comes from `next-themes` after hydration; before the browser preference is available, the route's documented default is used. The ThemeProvider defaults to `system`, and the existing theme button continues to call `setTheme` for an explicit user override.

Skin identity and appearance mode are independent: switching dark/light must not turn Archive into Observatory or vice versa. Signal remains dark-only in the registry.

## Verification

- Route mapping tests cover Archive base/nested routes and Observatory fallback routes.
- Shared UI contract tests cover the complete semantic token set for every supported skin/mode pair.
- Headquarter shell contract test verifies SkinRoot integration and retains the real theme toggle.
- GitHub Actions exact-head checks are the acceptance gate for code quality and build.

## Remaining acceptance gates

This implementation does not claim rendered browser review. Real-browser visual comparison, contrast measurement, responsive checks, keyboard interaction, screen-reader review, and visual regression remain open. The skin foundation and static contract tests do not substitute for those checks.
