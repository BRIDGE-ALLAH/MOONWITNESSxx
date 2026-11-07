# Governance Engine

The Governance Engine is the deterministic, offline repository-policy checker. It uses Node.js built-ins only and is owned by the repository tooling maintainers. Governance contracts remain the policy authority; this CLI checks a deliberately bounded subset and does not infer approval or runtime safety.

## Commands

### `pnpm governance:check`

Check repository identity, workspace manifests, package dependency direction, entrypoints,
instruction precedence, rule register completeness, and workflow permission declarations.
Exit code `0` means no errors; `1` means errors were found. Warnings are advisory unless
`--strict` is supplied.

### `pnpm governance:doctor`

Report Node, pnpm, and Git availability/version against the pinned toolchain.
Exit code `0` means all prerequisites match; `1` means at least one prerequisite does not.

### `pnpm governance:report`

Emit a machine-readable JSON report including findings and contract-rule coverage counts.
Exit code `0` means no errors; `1` means errors were found.

### `pnpm run check:repo`

Run repository audit, frozen lockfile validation, and Governance Engine checks.
The first failing command's exit code is propagated.

Run `pnpm governance:check --strict` to promote warnings to failures. The engine does not install dependencies, rewrite files, generate artifacts, access the network, or execute project code.

## Scope and limitations

- Workspace package inventory is derived from the canonical `apps/*` and `packages/*` roots.
- Dependency checks cover declared `workspace:` edges and statically recognizable scoped package imports. They are guardrails, not a full TypeScript compiler or semantic AST.
- Entrypoint checks verify that declared local targets exist; they do not prove runtime compatibility.
- Workflow checks flag missing explicit permission blocks, `write-all`, and potentially unsafe `pull_request_target` execution patterns. Human review and GitHub administrator readback remain necessary.
- Contract coverage counts rule IDs with explicit enforcement and state fields. It does not claim that the listed control has passed CI or is effective; maturity remains governed by `governance/enforcement.md`.
- API authorization, data lifecycle, deployment, installer behavior, branch protection, Dependabot security-alert settings, and production controls remain outside this CLI until their dedicated phases add executable evidence.

## Output

Text mode groups findings by severity and includes stable finding codes and paths. JSON mode (`governance:report`) includes:

- `schemaVersion`, repository, generation timestamp, and result.
- Error/warning counts and workspace package count.
- `ruleCoverage.total`, `withEnforcement`, `withState`, and `complete`.
- Sorted findings with `severity`, `code`, `path`, and actionable `message`.

Reports are emitted to stdout only. They are read-only and do not create or update repository files.
