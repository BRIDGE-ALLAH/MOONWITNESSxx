# Codex Super Autonomous v4.0

A lean, modular repository-engineering setup for Codex.

## Contents

- `GOAL.txt` — paste into the Codex Goal field for a full autonomous work cycle.
- `AGENTS.md` — concise, always-on repository rules.
- `.agents/skills/` — five on-demand workflows:
  - `repo-maintenance`: audit, Issue reconciliation and safe cleanup.
  - `debug-quality`: root-cause debugging, testing and CI.
  - `pr-delivery`: PR lifecycle, review, merge and Issue reconciliation.
  - `release-management`: SemVer, compare range, changelog, tags and GitHub Releases.
  - `docs-wiki`: minimal Markdown and GitHub Wiki maintenance.

## Install

Copy `AGENTS.md` into the repository root. Copy the `.agents/` directory into the repository root without overwriting existing content. Keep or merge any existing `AGENTS.md` instructions; do not blindly replace project-specific commands or safety rules.

Paste the contents of `GOAL.txt` into the Codex Goal field. Start/restart the Codex session so the instruction chain and skills are discovered.

Codex project skills are stored in `.agents/skills/<skill-name>/SKILL.md`. Skills use progressive disclosure: metadata is available for routing, and the full skill is loaded only when selected.

## Design rules

- Goal is the mission and dispatcher, not a duplicate of every procedure.
- `AGENTS.md` contains only durable project-wide rules.
- Skills own detailed repeatable workflows and load only when relevant.
- GitHub Issues own backlog; Codex owns active execution progress.
- `.plan/` is optional and only for useful cross-session plans.
- README/docs/Wiki/CHANGELOG have distinct responsibilities.

## Safety

This pack does not grant access or override Codex sandbox, approval, GitHub permissions, branch protection, or repository policies. Production-destructive actions, deployment, external registry publishing and permission changes remain approval-gated.
