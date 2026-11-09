# Headquarter route-aware skin runtime

**Date:** 2026-11-09  
**Repository:** `BRIDGE-ALLAH/MOONWITNESS`

## Runtime contract

The Headquarter AppShell resolves a skin from the current route and applies it to the complete shell through the shared `SkinRoot` component.

| Route family | Skin | Default mode |
|---|---|---|
| `/sidra-archive` and descendants | Archive | Light |
| All other Headquarter routes | Observatory | Dark |
| Signal | Internal specimen only | Dark |

Skin identity and appearance mode are separate. Observatory and Archive both support light and dark modes. Signal remains dark-only until it has a real destination.

The current AppShell uses the route's default mode as the initial and route-change preference while retaining the explicit theme toggle. Do not interpret the route default as a persisted per-user preference.

## Token ownership

The route-level `SkinRoot` is the single source of experience tokens. Pages must not reapply legacy `.theme-archive` or `.theme-observatory` classes to nested elements: child-level custom properties can override the inherited route tokens and make the global appearance switch inconsistent.

The Sidra Archive page therefore inherits its skin from the AppShell. The route test guards against reintroducing the nested legacy class.

## Verification

- Route contract tests cover Archive base/nested routes and Observatory fallback routes.
- Shared UI tests cover the semantic token contract for supported skin/mode pairs.
- Headquarter shell tests verify route-aware `SkinRoot` integration and the existing theme toggle.
- The archive page test ensures no nested legacy theme class overrides the route-level token owner.

## Remaining acceptance gates

Static tests and CI do not prove rendered visual quality. Browser visual comparison, measured contrast, responsive review, keyboard interaction, screen-reader review, and owner acceptance remain open. No production deployment or release is implied.
