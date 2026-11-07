# GitHub Governance Contract

**Owner:** Repository maintainers  
**Scope:** Branches, PRs, Actions, repository rulesets, review lifecycle.

## Rules
- `main` is canonical and MUST be protected against unreviewed changes once rulesets are applied.
- Short-lived branches SHOULD use `feat/*`, `fix/*`, `chore/*`, `docs/*`, or `refactor/*`.
- PRs target `main` unless a documented integration branch is active and protected.
- PRs state problem, ownership/boundaries, acceptance criteria, validation evidence, security/data impact, and recovery/migration.
- Required checks MUST match stable real check names.
- Actions MUST declare least-privilege permissions; read-only jobs use `contents: read`.
- CI push filters MUST match actual slash-based branch prefixes.
- No workflow may bypass review, suppress failed gates, or deploy after failed validation.

## Allowed
Squash merge after checks/review; manual approved lockfile refresh and release workflows; read-only scheduled audits.

## Forbidden
Routine force-push; auto-merging unreviewed architecture/security/data/dependency changes; broad write token defaults; assuming workflow existence means protection exists.

## Enforcement
CI, PR templates, and GitHub rulesets/branch protection (administrator action).

## Acceptance evidence
Real PR check names, active main ruleset, and workflow trigger/permission review.

## Exceptions
Repository administrator approval with branch, reason, compensating control, and expiry.
