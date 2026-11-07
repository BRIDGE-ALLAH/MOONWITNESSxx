# Repository Code Quality Audit Rules

## General Rules

1. **Never override the pnpm lockfile** without running `pnpm run lockfile:refresh` and reviewing the diff. The lockfile is the authoritative dependency source.

2. **Always use workspace-relative paths** (`@riotworks/*`) for inter-package imports. Never use relative paths or npm package names for internal packages.

3. **Keep the HEAD on main** branch. Do not force-push or rewrite shared history. Create feature branches with `feat-*`, `fix-*`, or `chore-*` prefixes.

4. **One canonical owner per capability**. Do not create a second owner for an existing capability. If multiple packages implement similar functionality, retire the duplicate.

5. **Pre-commit hooks must be local, deterministic, and fast**. No network calls, AI services, version bumps, or changelog mutations.

6. **Commit messages must follow Conventional Commits**: `type(scope): imperative summary` with max 72 characters.

7. **Never add placeholder scripts** that return success without checking anything. Every script must have a real implementation and test target.

8. **Package scripts must be deterministic and fail-fast**. If a command can swallow failures, it must not be the default CI gate.

9. **Documentation is the source of truth**. docs/ is canonical; the GitHub Wiki is a mirror only when explicitly published through a verified workflow.

10. **Release versioning and changelog generation happen only at release time**, not on every commit. Use Changesets or equivalent release-time tooling.

## Critical Rules from Audit

11. **AUD-001**: Headquarter package must correctly describe its runtime. Do not mix Fastify and Next.js manifests without explicit architecture decision.

12. **AUD-002**: ARSY Core must have a real source entrypoint (`src/index.ts`). Do not let packages depend on empty manifests.

13. **AUD-003**: apps/arsy must NOT depend on @riotworks/ui. Remove any UI from the backend dependency graph.

14. **AUD-004**: apps/arsy is the canonical ARSY HTTP backend. services/arsy is a duplicate that must be retired after extracting unique useful behavior.

15. **AUD-005**: services/* must NOT be added to pnpm workspace globs. Keep it out; resolve/retire rather than silently activating a second app topology.

16. **AUD-010**: Pre-commit must never call paid/external AI or mutate release versions.

17. **AUD-011**: Pre-commit must not suppress lint/type errors with `|| true`. Required checks must fail the commit; optional checks must be explicit and separately reported.

18. **AUD-014**: Weekly workflow must have valid YAML syntax, correct directory references, and generate reports before publishing.

19. **AUD-021**: Audit every manifest main, exports, and script against actual tracked files. Package scripts must point to real source/config.

20. **AUD-024**: turbo.json must have a test task and align every root/package script with real package capabilities.
