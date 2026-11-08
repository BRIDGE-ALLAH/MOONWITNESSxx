# ARSY DECK — Reference Feature

## Ownership
ARSY DECK owns the workspace-pulse read model and its presentation. The App Router page is composition only; domain types, source selection, and feature UI live here. Shared primitives come from `@riotworks/ui`.

## Current source status
The current ARSY server exposes only its root status response and a database health route. It does not yet expose a workspace-pulse, metrics, activity, opportunity, agent, or marketplace capability contract. Therefore this feature currently uses the explicit `demo-data.ts` fixture through `repository.ts`. The view prominently labels every section as illustrative and not connected.

## Required backend contract before live mode
Coordinate with the ARSY owner to publish a versioned workspace-pulse read contract, including:
- workspace scope and server-enforced authorization;
- metric definitions, units, currency, timezone, and time window;
- opportunity summary and confidence provenance;
- agent/job lifecycle semantics (not a generic online flag);
- channel account verification and capability status;
- event/audit references and source timestamps;
- partial-data and service-degradation behavior.

Do not guess endpoint paths, response shapes, permission names, or status semantics in Headquarter. Once the contract is approved, add a live repository implementation behind the existing feature repository boundary and contract tests.

## Lifecycle and safety
- Demo disclosure is always visible while the fixture repository is active.
- No write/action controls are shown because no approved action contract exists.
- Sample statuses are not health checks, connected-account claims, approvals, or production evidence.
- Server-side ARSY authorization remains authoritative; route/menu visibility is not security enforcement.

## Reference pattern
`app/arsy-deck/page.tsx` → `features/arsy-deck/repository.ts` → `features/arsy-deck/types.ts` / `demo-data.ts` → `arsy-deck-view.tsx`.
