# Money Maker product controls

Headquarter's Products panel reads owner-scoped product records from ARSY and exposes the existing product domain operations; it does not maintain a separate product state.

## Immutable versions

- The current brief, version ID and acceptance criteria are displayed from the persisted product record.
- Operators create a new snapshot by submitting a JSON brief and acceptance criteria.
- The request includes the currently loaded `expectedVersion`. ARSY creates the next version under its row-lock/compare-and-swap boundary and retains prior versions.
- A stale write returns HTTP 409. Headquarter refreshes the product and explains that the operator must review the new current version before retrying.
- Version history is loaded from `GET /api/v1/products/:id/versions`.

## Lifecycle

- Headquarter renders only `allowedNextLifecycleStates` returned by ARSY.
- ARSY remains authoritative and validates every transition; the UI does not duplicate the transition matrix.
- `ready` is derived from inspections and `listed` is derived from a verified publication receipt. Neither is manually selectable.
- A lifecycle conflict returns HTTP 409 and causes Headquarter to refresh the current record.

## Verification

The dedicated Money Maker PostgreSQL browser workflow seeds a synthetic product only in its disposable CI database. Chromium exercises a concurrent stale-version conflict, a successful next version, a valid lifecycle transition, a rejected derived-state transition, a full page reload, and direct PostgreSQL/audit assertions. It does not publish to a marketplace or execute payments.
