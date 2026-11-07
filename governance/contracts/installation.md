# Installation and Bootstrap Contract

**Owner:** Repository maintainers; runtime setup belongs to target app  
**Scope:** Future `install.sh`, `install.ps1`, shared Node bootstrap, local setup, repair/update/uninstall.

## Rules

- Installer MUST be idempotent, version-aware, observable, and safe to rerun.
- Shell entrypoints SHOULD delegate shared behavior to one Node implementation.
- Detect OS/architecture, Node, pnpm, Git, and selected-profile services.
- Separate preflight, dependency install, environment setup, hooks, validation, and startup.
- Preserve existing user files and secrets; copy `.env.example` only if `.env` is absent.
- Never print secrets or run unverified `curl | bash`.
- Provide `install`, `doctor`, `repair`, `update`, `verify`, and `uninstall`.
- Production migrations, deletion, deployment, DNS/firewall changes, and secret rotation require explicit approval and recovery plan.

## Allowed

Frozen-lockfile installation by default; explicit dependency refresh; profile-scoped optional service checks; dry-run/doctor diagnostics.

## Forbidden

Overwriting local environment files; unreviewed destructive repair; production migration during developer setup; hidden global toolchain changes.

## Enforcement

Node tests, shell/PowerShell smoke tests, idempotency tests, and human approval for production operations.

## Acceptance evidence

Two installs create no unintended diff; doctor is read-only; repair preserves user data; verify fails on missing prerequisites; recovery is tested.

## Exceptions

System owner approval, explicit scope, backup/recovery evidence, and expiry.
