# MOONWITNESS DX Frontier — Phases 27–29

**Research snapshot:** 2026-11-08  
**Branch:** \`feat/moonwitness-dx-phases-27-29\`  
**Principle:** measure objective movement, declare interface dependencies, and surface runtime resources before parallel work. Static checks are advisory, not enforcement.

## Phase 27 — Objective Delta Watchdog
Run: \`pnpm devx objective-watch --input=.moonwitness/objective.json --repeat=3\`.

Observations contain \`failedTests\`, \`missingCriteria\`, \`blockers\`, and optional \`activity\`. The watchdog canonicalizes the unresolved gap and hashes it. Repeated identical gap fingerprints trigger a pause/replan recommendation even if activity text changes; activity is not progress evidence.

Limits: it cannot infer undeclared acceptance criteria, authenticate test results or stop a live agent. Runtime integration and calibrated thresholds remain.

## Phase 28 — Interface Treaty
Run: \`pnpm devx interface-check --plan-file=.moonwitness/treaties.json\`.

Treaties declare owner, provided/consumed interfaces, breaking changes and expiry. The checker catches malformed/expired declarations, duplicate providers and breaking changes intersecting another agent's declared consumption.

Limits: declaration-level only; no TypeScript/OpenAPI/GraphQL/SQL migration parser, commit hook or consumer acknowledgement yet.

## Phase 29 — Runtime Resource Passport
Run: \`pnpm devx resource-check --plan-file=.moonwitness/resources.json\`.

Passports validate agent IDs, resource identifiers and ports, derive per-agent labels for databases/queues/volumes/environment namespaces, and detect shared declared resource identifiers and duplicate ports.

Limits: labels do not provision or isolate resources and ports are not reserved. Docker/Kubernetes/VM adapters must enforce namespaces, inject secrets safely, lease resources and clean up after crashes. Never put secret values in passport files.

## Research
- [Progress Drift: Auditing False Progress in Long-Horizon LLM Agents](https://aclanthology.org/2026.aacl-short.22/) introduces ProgressBench and evidence-linked progress reporting; its evaluation reports claim accuracy rising 80.6%→89.7% and false completion falling 12.7%→6.9%. Phase 27 adapts the evidence-first idea to objective-gap state.
- [Agent-Integrated Software: Interaction Contracts and Continuous Assurance](https://arxiv.org/abs/2609.11381) motivates task bindings, role authority and outcome evidence.
- [Who is in charge? Coordination and governance in agentic software engineering](https://doi.org/10.1016/j.jlamp.2026.101192) frames runtime coordination contracts as a governance primitive.
- [Coordinating Agents on a Shared Git Workspace](https://doi.org/10.4230/LIPIcs.ESEM.2026.18) studies action-space coordination and reports fewer destructive concurrent edits in its evaluated setting.
- [Effective Strategies for Asynchronous Software Engineering Agents](https://arxiv.org/abs/2603.21489) studies centralized delegation, isolated workspaces and executable integration.
- [GitHub sandboxing topic](https://github.locker/topics/sandboxing) shows activity around Daytona, AgentScope, NemoClaw, Sandstorm and Agent Substrate. Google's [Agent Substrate/gVisor CNCF donation](https://opensource.googleblog.com/2026/11/sandboxing-untrusted-ai-agents-at-scale.html) signals growing focus on isolated agent runtimes.
- [GitHub worktrees topic](https://github.com/topics/worktrees) highlights Superpowers, Worktrunk and Agent Orchestrator; integrate with prior art rather than rebuilding worktree UX.
- Reddit field reports: [parallel agents collide on worktrees, DBs and ports](https://www.reddit.com/r/AI_Agents/comments/1v53mns/running_multiple_coding_agents_in_parallel_broke/) and [worktrees still share runtime state](https://www.reddit.com/r/AI_Agents/comments/1ur1lhq/i_solved_parallel_multi_agents_workflows/). Anecdotal only, not prevalence evidence.

## High-upside research hypotheses (not novelty claims)
1. **Objective-gap control plane:** join verified test failures, criterion IDs, issue state and reviewer findings into a causal graph; give each agent the smallest unresolved frontier.
2. **Interface escrow:** stage breaking API/schema changes behind compatibility windows; consumers run old/new contract tests and acknowledge before release.
3. **Resource time-travel:** snapshot DB, queue offsets, filesystem and service config at verified milestones to fork reproducible counterfactual environments.
4. **Causal CI scheduler:** learn defect-to-test detection history, select a fast test path, and retain randomized plus periodic full-suite audits to estimate false negatives.
5. **Proof-carrying merge queue:** require objective delta, treaty diff, resource manifest, replayable test evidence and rollback plan.
6. **Adversarial swarm benchmark:** inject stale interfaces, hidden shared resources and false progress; score recovery time, false-safe rate and damage containment.

No idea is claimed unprecedented worldwide. Prior art exists for sandboxes, worktrees, orchestration, contracts, progress ledgers and trace evaluation. A defensible contribution is the measurable integration of these controls into repository-native merge governance. Perform systematic novelty search and comparative benchmarks before world-first or patent claims.

## Acceptance and metrics
Unit tests cover gap fingerprints, repeated-gap detection, treaty expiry/breaking changes, passport validation and resource collisions. CI smoke-tests all commands; full CI remains mandatory. Track false/missed loop rates, interface-conflict escape rate, runtime-resource collision rate, time-to-replan and verified-PR lead time.
