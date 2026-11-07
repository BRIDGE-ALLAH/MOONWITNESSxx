# Identity Contract

**Owner:** Repository maintainers  
**Scope:** Root/workspace manifests, GitHub references, environment examples, automation metadata.

## Rules

- Canonical repository MUST be `BRIDGE-ALLAH/MOONWITNESS`.
- Root package MUST be `moonwitness`.
- RIOTWORKS is a product division, not repository identity.
- Internal RIOTWORKS packages MAY use `@riotworks/*`.
- Automation MUST prefer GitHub Actions repository context; local scripts may use explicit environment configuration.
- Repository rename and package namespace change are separate decisions.

## Allowed

Root name `moonwitness`; workspace scope `@riotworks/*`; explicit local owner/repository environment variables.

## Forbidden

Root package identity `riotworks`; building GitHub API paths from package scope; mass-renaming packages to match root name.

## Enforcement

Repository audit validates root identity, toolchain pin, required commands, and workspace package names. Human review controls repository identity changes.

## Acceptance evidence

`pnpm run check:repo` passes; package names remain unique.

## Exceptions

Repository maintainers approve a scoped exception with reason, migration plan, and expiry.
