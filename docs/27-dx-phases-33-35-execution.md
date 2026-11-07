# Developer Experience — Phases 33–35

**Status:** implemented on branch \`feat/moonwitness-dx-phases-33-35\`; CI verification pending.
**Scope:** deterministic planning and regression-specification tools. No agent runner, policy enforcement, deployment, or production mutation is added.

## Phase 33 — Adaptive Swarm Topology

\`pnpm devx swarm-plan --input=.moonwitness/swarm.json\`

The planner compares declared write-path overlap, shared mutable resources, and provider/consumer interface coupling. It recommends one of: single-agent, serialized conflicting work, a peer-aware pair, or isolated parallel execution. The default parallelism cap is two, informed by the PASC study; it is a conservative default, not a universal optimum.

**Limitations:** static declarations cannot reveal hidden dependencies. The command does not create worktrees, reserve ports/resources, observe peer commits, or enforce isolation.

## Phase 34 — Autonomy Thermostat

\`pnpm devx autonomy-budget --input=.moonwitness/autonomy.json\`

A deterministic risk score combines a declared risk class with counts of unverified writes, evidence debt, interface drift, and collisions. It maps the score to observe-only, propose-only, write-with-review, or execute-scoped capabilities.

**Safety:** merge, deploy, secret access, permission changes, and destructive production writes are always excluded. The score is a heuristic, not calibrated probability or authorization. A trusted server-side policy boundary must enforce real permissions.

## Phase 35 — Counterfactual Incident Compiler

\`pnpm devx incident-compile --input=.moonwitness/incident.json\`

The compiler accepts a bounded, data-only operation graph, closes a selected operation set over declared dependencies, detects cycles, and emits deterministic replay steps, invariants, fault-injection variants, and a SHA-256 digest. Variants cover duplicate delivery, timeout, partial failure, and dependency reordering when relevant.

**Limitations:** dependency-minimality is relative to the supplied graph and selection; it is not a globally minimal reproducer. It does not execute code, replay live integrations, copy raw logs, or authenticate incident reports.

## Research and design rationale

- **Soei**, Khan & Kumar, arXiv:2610.39468 (29 Oct 2026): proposes acknowledgement-aware traces, evidence ledgers and a verification layer that separates completion claims from proof. Its study of 45 sessions is a small, single-developer corpus; its reported rates are not universal prevalence. https://arxiv.org/abs/2610.39468
- **PASC**, Özaytürk & Buzluca, ESEM 2026, DOI 10.4230/LIPIcs.ESEM.2026.18: reports benefits from peer-aware coordination for two agents on its evaluated SWE-Bench Pro subset and warns that interference rises beyond two agents. Results motivate a bounded default and explicit coupling checks, not a blanket two-agent rule. https://doi.org/10.4230/LIPIcs.ESEM.2026.18
- **Practitioner signal:** a Reddit discussion reports integration failures surviving ordinary CI and motivates sandboxed multi-API failure scenarios. This is anecdotal, not controlled evidence. https://www.reddit.com/r/devsecops/comments/1vzbpln/coding-agents-shifted-the-bottleneck-to/

## Acceptance and validation

- Unit tests cover collision detection, risk monotonicity, forbidden capabilities, dependency closure, cycle rejection, and deterministic digests.
- CI smoke tests exercise all three CLI commands using synthetic fixtures.
- All output is advisory/data-only. Runtime scheduling, trusted identity, signed evidence, sandbox execution, and production policy integration remain separate future work.
