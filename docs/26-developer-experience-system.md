# MOONWITNESS Developer Experience System — Phases 21–23

**Research snapshot:** 2026-11-08  
**Implementation branch:** `feat/moonwitness-dx-phases-21-23`  
**Principle:** executable truth over longer onboarding documents. Every DX command must be deterministic, local-first, read-only by default, and useful to both humans and coding agents.

## Executive diagnosis

Repository inspection found concrete friction:
- Root `package.json` was named `riotworks` while the repository audit contract expects `moonwitness`.
- `format:check` recursively invoked itself and referenced a missing `format` script.
- `dev:all`, `lint:all`, and `typecheck:all` used shell backgrounding, which can hide failures and is not portable.
- There was no single local command that checked toolchain, workspace, lockfile presence, and package script readiness.
- Developers and agents had no deterministic changed-package plan or bounded machine-readable repository context.

## Phase 21 — Developer Environment Doctor

**Status:** Initial implementation in `scripts/devx/lib.mjs` and `scripts/devx/cli.mjs`; environment installation, lockfile regeneration and external service provisioning are intentionally not automatic.

### Design
- `pnpm devx doctor` checks Node 22+, exact pinned pnpm, workspace globs, lockfile presence, safe env template, dependency installation and package scripts.
- `--json` provides machine-readable findings with stable IDs, status, remediation and summary counts.
- The doctor never installs packages, changes files, reads .env secrets or runs migrations.
- Warnings are distinguished from hard failures; missing optional local dependencies are not treated as broken code.

### Acceptance
- New contributor can diagnose a machine in one command.
- Each finding has a deterministic reason and safe next step.
- CI and local output use the same check implementation.

## Phase 22 — Change-Aware Workspace Task Graph

**Status:** Initial package impact planner in `scripts/devx/lib.mjs`; richer graph ordering and actual execution remain future work.

### Design
- `pnpm devx plan --base=main` collects committed, staged, unstaged and untracked paths.
- It maps changed paths to owning workspace packages.
- It computes reverse workspace-dependency closure so a changed library also identifies its direct consumers.
- It emits only package scripts that actually exist (test, test:governance, type-check, build).
- The planner is advisory; it does not execute checks or replace Turbo's cache/scheduling semantics.

### Acceptance
- Every suggested command maps to a real script in the target manifest.
- Unknown root-level config changes conservatively fan out to all packages.
- The output is JSON-capable for CI/agent integration and reviewable before execution.

## Phase 23 — Agent Context Compiler

**Status:** Initial deterministic context compiler in `scripts/devx/lib.mjs`; context diff, retrieval ranking and tool-specific adapters remain future work.

### Design
- `pnpm devx context` compiles allowlisted repository instructions, architecture governance, workspace map and package scripts.
- `--json` emits schema-versioned output and a SHA-256 fingerprint.
- `--max-chars` bounds context size; truncation is explicit and fingerprint remains tied to complete source context.
- Only allowlisted text files are read. Environment files, credentials, build output and arbitrary workspace content are excluded.
- Sensitive-looking key/value lines are redacted as defense in depth.

### Acceptance
- Same repository inputs produce the same fingerprint and output.
- Secret files are never opened by the compiler.
- A coding agent can identify package ownership and valid commands without loading the entire monorepo.

## Research and prior-art review

### Papers
1. [How Coding Agents Fail Their Users: 20,574 real-world sessions](https://aclanthology.org/2026.emnlp-main.1011/) identifies seven forms of developer-agent misalignment, including repository reading, intent interpretation, constraint following, implementation/execution and progress reporting. 91.49% of visible resolutions required explicit user correction. **DX implication:** show concrete evidence and command output; never claim checks ran when they did not.
2. [A Few Pages of Markdown: Committed AI Configuration and Lower Quality Cost after Coding-Agent Adoption](https://hehao98.github.io/publication/2026-ai-config) introduces RAMP across 441 repositories. Configuration maturity is cumulative, but many artifacts are committed once and never updated. **DX implication:** context needs freshness fingerprints and executable checks, not a growing instruction dump.
3. [Do Context Files Help Coding Agents? A Two-Agent Ablation Study](https://aclanthology.org/2026.realm-1.5/) reports no measurable correctness improvement from context injection in its 17-task/288-run study (within its stated equivalence bounds). **DX implication:** context is navigation, not a substitute for good tooling, implementation skill or verification.
4. [Change2Task](https://arxiv.org/abs/2607.28591) converts historical repository changes into executable tasks and reports 79.6% verified construction success over 1,130 eligible changes. **DX implication:** evolve the task planner toward executable, replayable PR-derived tasks.
5. [ResearchEnvBench](https://ijcai.org/proceedings/2026/48) finds environment synthesis failures dominated by incomplete dependency resolution and brittle version coupling. **DX implication:** diagnose environment drift before asking a developer or agent to code.

### GitHub ecosystem / trends
- [claude-mem](https://github.com/thedotmack/claude-mem) led the Nov 7 weekly snapshot with +8,726 stars: persistent cross-session context is in demand.
- [worktrunk](https://github.com/max-sixty/worktrunk) gained +2,184 stars in that weekly snapshot: parallel agent worktrees are becoming a mainstream workflow.
- [t3code](https://github.com/pingdotgg/t3code) gained +16,782 stars in the same weekly snapshot: integrated agent workspaces are attracting attention.
- [mattpocock/skills](https://github.com/mattpocock/skills) and [ECC](https://github.com/affaan-m/everything-claude-code) appear in the developer-tools trend lists: reusable executable skills and guardrails are more actionable than static prompt sprawl.
- Trend snapshots are volatile popularity signals, not evidence of quality, security or license compatibility. Check each repository's current license before adopting code.

### Reddit practitioner signals
- [New developer onboarding pain points](https://www.reddit.com/r/ExperiencedDevs/comments/1bxuqtr) repeatedly cites outdated setup docs, undocumented dependencies and access steps. A commenter reports moving setup from weeks to roughly an hour with devcontainers; this is anecdotal, not a controlled result.
- [Local coding agents need supervision](https://www.reddit.com/r/LocalLLaMA/comments/1u6mmuu/local_coding_agents_are_good_now_but_only_if_you/) describes agents touching unrelated files and producing plausible but broken changes. **DX implication:** changed-file impact plans and verifiable command output should be default.
- [Complex development environments](https://www.reddit.com/r/ExperiencedDevs/comments/1fbb678) reports multi-repo setup taking half a day to four days depending on developer experience. **DX implication:** expose dependency and service prerequisites in one diagnostic report.

## Differentiated experiments — hypotheses, not novelty claims

1. **Repository Flight Recorder:** each local task records repository fingerprint, exact command, toolchain versions, changed paths, exit code and bounded test evidence. A later agent can resume from facts rather than prose.
2. **Executable Onboarding Contract:** every onboarding instruction must map to a doctor check, a runnable command or an explicit human access prerequisite. Stale instructions become detectable.
3. **Context Freshness Lease:** generated agent context carries a fingerprint and expiry; when package manifests, AGENTS rules or CI change, the agent must regenerate context before continuing.
4. **Change-to-Test Provenance:** each impacted package task is linked to the changed file and dependency edge that caused it to be selected.
5. **Parallel Worktree Collision Forecast:** before parallel agents start, inspect ownership paths and dependency overlap, then flag likely write collisions before edits begin.

These concepts may overlap with existing products or research. Validate novelty through prior-art review and measured comparisons before public claims.

## Rollout order
1. Use the Doctor to repair toolchain and workspace prerequisites.
2. Use the change planner to select the smallest honest verification set; keep full CI as the merge gate.
3. Give agents the compiled context and fingerprint, then record task outcomes in the proposed Flight Recorder.
4. Measure time-to-first-successful-PR, setup failure rate, unnecessary test minutes, context tokens, correction rate and unrelated-file edit rate.
