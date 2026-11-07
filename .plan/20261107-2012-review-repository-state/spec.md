# Review Specification

## Objective
Produce an evidence-based Ultra Review of the RIOTWORKS repository state, reconcile existing WIP and the prior maintenance plan, and hand off an implementation-ready Ultra Plan.

## Inputs (VERIFIED)
- `GOAL.txt` (autonomous execution directive)
- Root `AGENTS.md` + repo `AGENTS.md` engineering rules
- `.plan/20261107-1900-plan-repository-maintenance/` (`plan.md`, `spec.md`, `rule.md`, `design.md`, `report.md` stub) — non-compliant with global `.plan` contract (uses `plan.md` instead of `task.md`)
- Git state: `main`, `origin https://github.com/BRIDGE-ALLAH/MOONWITNESS.git`, modified/untracked files present
- Manifests: root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `apps/*/package.json`, selected `packages/*/package.json`
- CI: `.github/workflows/ci.yml`, `codeql.yml`, `pr-labeler.yml`, `refresh-lockfile.yml`, `weekly-detection.yml`
- Hooks/scripts: `.husky/pre-commit`, `.husky/commit-msg`, `scripts/check-staged.mjs`, `scripts/check-commit-message.mjs`, `scripts/check-lockfile.mjs`, `scripts/repo-audit.mjs`, `scripts/auto-detect.js`

## Requirements
- **REQ-R001:** Identify P0/P1 defects and risky WIP with file/line evidence.
- **REQ-R002:** Reconcile prior `.plan/20261107-1900-plan-repository-maintenance` with actual repo/WIP; mark stale, valid, or blocked items.
- **REQ-R003:** Classify findings by Severity (CRITICAL/HIGH/MEDIUM/LOW/INFO), Confidence (CONFIRMED/HIGH/MEDIUM/LOW), Priority (P0-P3).
- **REQ-R004:** Provide root cause, impact, recommendation, and validation criteria per material finding.
- **REQ-R005:** Produce handoff tasks for Ultra Plan/Executor with dependencies and safe execution order.

## Non-goals
- No code changes in the review phase except creating `.plan` artifacts for this review/plan cycle.
- No `git commit`, `push`, merge, release, deploy, or production actions.
- No dependency install/build/test runs unless cheap and explicitly justified (NOT RUN otherwise).

## Acceptance Criteria
- `task.md`, `rule.md`, `spec.md`, `design.md`, `report.md` exist in the review folder.
- Findings include IDs and evidence paths.
- Final verdict distinguishes PASS/FAIL/BLOCKED/NOT RUN.
