# MOONWITNESS DX Frontier — Phases 24–26

**Research snapshot:** 2026-11-08  
**Implementation branch:** \`feat/moonwitness-dx-phases-24-26\`  
**Design rule:** make parallel agent work observable, collision-aware and context-fresh without pretending static checks can prove runtime isolation.

## Why these phases

The previous DX layer diagnosed a developer machine, selected impacted packages and compiled bounded context. The next failure boundary is coordination between long-running agents: what actually happened, where their write sets overlap, and whether the context they started with is still valid.

## Phase 24 — Repository Flight Recorder

**Implemented:** \`appendFlightRecord\`, \`verifyFlightRecorder\`, and CLI commands:

\`\`\`bash
pnpm devx record --input=.moonwitness/task-result.json
pnpm devx flight verify
\`\`\`

- Append-only JSONL records with sequence numbers, UTC timestamp, previous-record hash and SHA-256 digest.
- Canonical object-key ordering makes the digest independent of JSON key order.
- Verification detects malformed lines, sequence gaps, reordered entries and content edits.
- Appends are serialized within one Node process to prevent same-process concurrent calls from racing. Sensitive-looking object keys (API keys, tokens, secrets, passwords, private keys, authorization and cookies) are redacted, and each record is capped at 256 KiB.
- Records are local evidence only. The chain is not signed, remotely anchored, tamper-proof against an attacker who can rewrite the file, nor protected against concurrent writers in separate OS processes. Do not use it as a security attestation.

**Next hardening:** OS-level file locking, redaction/size policy, signed checkpoints (KMS), external append-only anchoring and provider-side receipts.

## Phase 25 — Parallel Workset Collision Forecast

**Implemented:** \`forecastWriteCollisions\`, CLI:

\`\`\`bash
pnpm devx collision --plan-file=.moonwitness/agents.json
\`\`\`

Input:

\`\`\`json
{
  "agents": [
    { "id": "agent-docs", "writePaths": ["docs/"] },
    { "id": "agent-core", "writePaths": ["packages/arsy-core/src"] }
  ]
}
\`\`\`

- Finds identical file/directory write ownership (critical).
- Finds ancestor/descendant path overlaps (high).
- Rejects absolute and parent-traversal paths.
- Emits a machine-readable safe-to-parallelize signal and explicit scope limitations.

This is a preflight heuristic, not a lock manager. It does not detect semantic conflicts, generated outputs, shared databases, ports, environment variables, package caches or runtime service collisions. Separate worktrees and isolated runtime resources remain mandatory for robust parallel execution.

## Phase 26 — Context Freshness Lease

**Implemented:** \`createContextLease\`, \`verifyContextLease\`, CLI:

\`\`\`bash
pnpm devx context-lease --out=.moonwitness/context-lease.json --ttl-ms=3600000
pnpm devx context-verify --lease=.moonwitness/context-lease.json
\`\`\`

- Binds a lease to the deterministic context compiler SHA-256 fingerprint.
- Expires after a bounded TTL.
- Verification fails closed when the context fingerprint changes or the lease expires.
- Lease creation is explicit and refuses to overwrite an existing file.

A lease is a freshness hint, not an authorization credential. It cannot guarantee that untracked secrets, external service state or files outside the compiler allowlist are unchanged.

## Research and field signals

### Papers and standards-adjacent research

1. [Self-Evolving Coding Agents (2026)](https://arxiv.org/abs/2608.03392) surveys evolution driven by executable feedback, repository context and coding trajectories. It also identifies feedback reliability, benchmark overfitting, safety, maintainability and generalization as open problems. **Design response:** preserve verifiable task receipts and do not automatically turn a single success into a permanent skill.
2. [Socratic-SWE: Self-Evolving Coding Agents via Trace-Derived Agent Skills (2026)](https://arxiv.org/abs/2606.07412) uses historical solving traces to generate targeted, execution-validated repair tasks. **Design response:** Flight Recorder creates a possible substrate for later trace-derived test generation, but this PR does not implement self-modifying agents.
3. [Reproducible, Explainable, and Effective Evaluations of Agentic AI for Software Engineering (2026)](https://arxiv.org/abs/2604.01437) recommends publishing thought/action/result trajectories or summarized traces to support reproducibility. **Design response:** retain compact, inspectable execution facts instead of relying on natural-language completion claims.
4. [Systematic Mapping of Agentic Software Engineering (2026)](https://www.mdpi.com/2079-9292/15/21/5121) maps 94 studies and finds a gap between system-level evaluation and attribution to individual design decisions. **Design response:** measure each DX primitive separately with ablations rather than crediting an entire agent stack.
5. [NIST: Epistemic Grounding for Agentic Coding (2026)](https://www.nist.gov/publications/agentic-ai-assisted-coding-offers-unique-opportunity-instill-epistemic-grounding-during) proposes field-scoped hard constraints and convention parameters. **Design response:** future grounding packs should be executable and scoped, not blindly injected into every task.

### GitHub trends (snapshot around Nov 7, 2026)

- [worktrunk](https://github.com/max-sixty/worktrunk), [superpowers](https://github.com/obra/superpowers), [vibe-kanban](https://github.com/BloopAI/vibe-kanban) and [agent-orchestrator](https://github.com/OrchestratorInc/agent-orchestrator) show strong interest in agent worktrees, reusable workflows and orchestration. Trend counts are volatile and not quality signals.
- [claude-mem](https://github.com/thedotmack/claude-mem) and [Graphify](https://github.com/Graphify-Labs/graphify) point to demand for persistent session context and repository knowledge graphs.
- GitHub's 2026 Octoverse reports that over 40% of pull requests were started by agents by September 2026, and that agent-started PRs more often span multiple files. This increases the value of independent review and attributable verification.

### Reddit practitioner reports (qualitative only)

- [Parallel agents collide on shared trees, databases and ports](https://www.reddit.com/r/AI_Agents/comments/1v53mns/running_multiple_coding_agents_in_parallel_broke/) describes worktree isolation as necessary but insufficient; runtime resources also need isolation. It also discusses detecting stalled agents through repeated objective-gap fingerprints rather than file activity.
- [Shared-codebase agent setups](https://www.reddit.com/r/aiagents/comments/1uth7r5/whats_your_setup_for_multiple_coding_agents/) highlights interface drift between agents and proposes declaring interfaces as first-class shared state.
- [Parallel agent runtime collisions](https://www.reddit.com/r/ClaudeCode/comments/1unce1m/i_kept_having_my_parallel_coding_agents_collide/) reports port/database/volume collisions despite separate worktrees.
- These are anecdotal reports and may include self-promotion; use them to generate hypotheses, not to claim prevalence.

## Further frontier hypotheses — do not claim world-first

1. **Objective Delta Watchdog:** fingerprint the remaining failing assertions, missing fields and acceptance criteria at each step. If the objective gap repeats while output keeps changing, classify the agent as looping. Stop only the affected task and preserve its last known-good state.
2. **Interface Treaty / ABI Lease:** agents publish the interfaces they intend to change (exports, API routes, schemas, migrations). A dependent agent must revalidate its interface lease before committing. This targets semantic conflicts that file-path collision checks cannot see.
3. **Runtime Resource Passport:** assign each worktree an explicit namespace for ports, DB/schema, queues, volumes and environment references; reject undeclared shared resources before starting services.
4. **Counterfactual CI Budgeter:** run the smallest selected test set first, compare its findings against periodic full-suite runs, and quantify false negatives before allowing any test reduction to become a merge gate.
5. **Evidence-Carrying Skill Evolution:** promote a recurring repair pattern into a skill only after it passes held-out tasks, negative examples, policy checks and rollback tests. This guards against self-evolution overfitting.

### Novelty and feasibility statement

None of these concepts is asserted to be globally unprecedented. Worktrees, orchestration, memory, sandboxing, trace-based learning and environment isolation all have prior art. The potentially differentiating contribution is the integration of *objective-gap fingerprints + interface leases + runtime resource namespaces + evidence-gated skill promotion* into one repository-native governance loop, with independently measurable failure reduction. A proper novelty search and comparative benchmark are required before publication or patent claims.

## Acceptance and measurement

- Unit tests cover hash-chain tampering, concurrent same-process appends, path traversal, exact/ancestor overlaps, disjoint paths, context drift and expiry.
- CI smoke tests must exercise all new CLI paths.
- Track: merge conflict rate, runtime collision rate, repeated-gap loop rate, stale-context task rate, false-safe collision rate, evidence verification failures and median time to a verified PR.
- Keep full CI as the merge gate. The collision forecast and context lease are advisory/freshness controls, not substitutes for isolation or test execution.
