## Problem and intended outcome

<!-- What problem does this change solve? Link the issue or decision record. -->

## Ownership and boundaries

- Owning app/package:
- Contract or architecture boundary affected:
- Cross-package/API impact:

## Acceptance criteria

- [ ] Observable acceptance criteria are stated.
- [ ] No unrelated scope is included.

## Validation evidence

- [ ] Relevant tests added/updated.
- [ ] `pnpm run check:repo`
- [ ] `pnpm run format:check`
- [ ] `pnpm test`
- [ ] Relevant package type-check/build completed.
- [ ] CI results linked; skipped checks are explicitly identified.

## Security, data, and privacy

- [ ] Permissions and trust boundaries reviewed.
- [ ] No secrets or sensitive data added to source, logs, fixtures, or artifacts.
- [ ] Data retention, provenance, and audit behavior considered.
- [ ] External side effects are idempotent or receipt-protected.

## Migration and recovery

- [ ] Migration/deployment impact described, or marked not applicable.
- [ ] Rollback/forward-fix and recovery path documented for risky changes.
- [ ] No production migration, destructive action, or deployment is hidden in setup scripts.

## Governance

- [ ] Canonical contract/docs updated where required.
- [ ] Exceptions name approver, reason, scope, compensating control, and expiry.
- [ ] Human/administrator gates are not represented as automated passes.

## Reviewer notes

<!-- Call out trade-offs, known gaps, and decisions needed. -->
