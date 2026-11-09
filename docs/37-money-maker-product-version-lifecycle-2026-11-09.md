# Money Maker product version and lifecycle workflow

**Date:** 2026-11-09  
**Repository:** `BRIDGE-ALLAH/MOONWITNESS`  
**Scope:** Issue #266 — Headquarter operator product controls

## Ownership and source of truth

ARSY remains the only product-domain and persistence authority. Headquarter reads and mutates products through its authenticated Money Maker BFF; it does not connect to PostgreSQL directly.

The implementation reuses the existing ARSY contracts:

- `GET /api/v1/products` lists owner-scoped products.
- `GET /api/v1/products/:id` returns the current `ProductRecord`.
- `GET /api/v1/products/:id/versions` returns immutable version history.
- `POST /api/v1/products/:id/versions` creates the next version using `expectedVersion`.
- `PATCH /api/v1/products/:id/lifecycle` performs a domain-validated compare-and-swap transition.

Headquarter exposes those operations below `/api/money-maker/products/...` through the existing finite route/method allowlist and authenticated ARSY proxy. Reads use `cache: 'no-store'`. No new API, table, migration, ORM or persistence path is introduced.

## Operator experience

The Products panel now exposes an accessible detail disclosure for each persisted product:

- Current lifecycle and immutable version identifiers.
- Current brief and acceptance criteria.
- Full version history, including version ID, creator and timestamp.
- A form to submit a new JSON brief and newline-separated acceptance criteria.
- Lifecycle actions derived only from the current server-provided `allowedNextLifecycleStates`.

A version submission sends the version number loaded from ARSY as `expectedVersion`. A successful response reloads the current ProductRecord and history. A `409` response is not reported as success: Headquarter reloads authoritative state and asks the operator to review the new current version before trying again.

Lifecycle mutations use the same server-owned transition list. The UI does not offer arbitrary lifecycle values. `ready` is derived from inspection outcomes, and `listed` requires a verified publication receipt; neither can be manually selected. `retired` is terminal.

## Domain transition contract

| Current state | Operator-approved next states |
| --- | --- |
| `brief` | `production`, `retired` |
| `production` | `review`, `retired` |
| `review` | `production`, `retired` |
| `ready` | `retired` only |
| `listed` | `retired` only |
| `retired` | None |

These rules are implemented and enforced in ARSY, not duplicated as a frontend policy.

## Verification design

The Headquarter unit contract test checks that the editor consumes the full product/version contract, uses `expectedVersion`, handles `409`, displays the derived-state constraints, and relies on the existing BFF allowlist.

The dedicated Money Maker PostgreSQL browser workflow adds a product-lifecycle journey using only its disposable CI PostgreSQL database and real Headquarter → BFF → ARSY requests. It verifies:

1. An operator can read product version 1 and its history.
2. A competing version 2 update succeeds after the page has loaded version 1.
3. Submitting the stale version 1 draft returns a visible conflict and refreshes the UI to version 2.
4. A fresh version 3 can be saved and remains in immutable history.
5. An attempt to set the derived `ready` state is rejected by ARSY with `409 INVALID_LIFECYCLE_TRANSITION`.
6. A valid `production → review` transition is saved, survives browser reload, and matches PostgreSQL state.
7. The accepted version and lifecycle changes are present in the durable commerce audit trail.

The CI fixture is synthetic and isolated. It does not publish to a marketplace, transfer funds, or mutate production data.

## Implementation status

The implementation and its unit/browser acceptance changes are committed on the Issue #266 feature branch. The checks for that branch must be judged by the exact PR head. Until those Actions runs pass, this document describes the intended acceptance and submitted code, not a verified pass result.

No production deployment, production migration, stable release, marketplace publication, or payment execution is part of this change.
