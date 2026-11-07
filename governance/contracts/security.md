# Security Contract

**Owner:** Repository maintainers and each runtime owner  
**Scope:** Dependencies, credentials, CI permissions, tooling, artifacts, installer, deployment.

## Rules
- Secrets MUST live in approved stores or ignored local env files; examples contain placeholders only.
- Workflows MUST use least privilege and pinned toolchains.
- Dependency updates MUST be reviewable and pass lockfile checks.
- Scripts/installers MUST NOT execute unverified remote code.
- Logs/artifacts MUST redact credentials and avoid sensitive application data.
- Production migrations/destructive operations require explicit approval, backup evidence, and recovery plan.
- A passing scanner does not replace dependency review or runtime access-control verification.

## Allowed
GitHub-managed scoped tokens; optional local AI credentials for explicitly invoked tools; bounded read-only reports.

## Forbidden
Committed PATs/secrets; printing environment variables; broad write permissions for audits; disabling checks to obtain green CI.

## Enforcement
CodeQL, Dependabot, repository audit, workflow review, secret scanning, and installer/runtime tests.

## Acceptance evidence
No committed secrets; explicit minimal permissions; successful security workflow runs; approved risky-operation records.

## Exceptions
Maintainer approval with exposure statement, compensating controls, and expiry.
