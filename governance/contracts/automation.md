# Automation Contract

**Owner:** Repository maintainers; each workflow has one operational owner  
**Scope:** Local scripts, Git hooks, GitHub Actions, scheduled detection, issue/PR automation.

## Rules

- Every automation MUST have one owner, trigger, responsibility, and side-effect boundary.
- Read-only is the default. Writes require explicit intent, least privilege, idempotency, deduplication, observable results, and retry behavior.
- Scheduled detection reports findings; it MUST NOT flood Issues.
- Hooks MUST be local, fast, deterministic, and independent of network/credentials.
- Required validation MUST fail closed when it cannot execute.
- Commits MUST NOT mutate versions, changelogs, production data, or architecture state.
- AI assistance is opt-in and never required by CI/hooks.

## Allowed

Read-only reports; safe mechanical PR proposals after validation; manual approval for dependency, release, migration, and deployment changes.

## Forbidden

Unbounded issue creation; broad write tokens for read-only checks; silent weaker fallbacks; treating reports as proof of resolution/deployment.

## Enforcement

Workflow permissions/concurrency, automation tests, repository audit, and human approval for high-risk writes.

## Acceptance evidence

Each workflow has owner/trigger/permission/output; repeated runs are idempotent; failures and retries are observable.

## Exceptions

Automation owner and maintainer approve scope, expiry, and rollback.
