# MOONWITNESS Research Dossier 2 — Causal Impact & Knowledge Defense

**Research snapshot:** 2026-11-08  
**Scope:** Phase 14–17 design validation and implementation priorities.  
**Status:** Literature/ecosystem scan, hypotheses and implementation plan. No claim of global firstness.

## Executive finding

The market is rapidly converging on persistent agent memory, code knowledge graphs, and agent observability. Rebuilding those categories from scratch would not differentiate MOONWITNESS. The stronger thesis is to connect four things into one verifiable control loop:

**Evidence → Belief → Decision → Action → Outcome → Causal impact → Evidence-quality feedback.**

The first Phase 14/15 code slice is deliberately framework-neutral and small. It must grow behind interfaces and measured acceptance criteria rather than prematurely adopting a graph database, vector store, or sandbox vendor.

## Phase 14/15: what prior art says

### Papers and technical work

1. [Agent Zero Memory — Provenance-Aware Long-Term Memory for LLM Agents](https://arxiv.org/abs/2608.29606), 2026-08-30. Proposes parallel episodic, entity-event graph and curated documentary memory with source pointers and citation-locked retrieval. **Takeaway:** multiple memory views and provenance are established prior art; MOONWITNESS must differentiate at the policy/action/outcome boundary.
2. [PROJECTMEM — A Local-First, Event-Sourced Memory and Judgment Layer](https://arxiv.org/abs/2606.12329), 2026-06-10. Append-only event log, deterministic projections and a pre-action warning gate. **Takeaway:** event sourcing and memory-as-governance are known; focus on cross-system decision lineage and replay safety.
3. [ESAA — Event Sourcing for Autonomous Agents](https://arxiv.org/abs/2602.23193), 2026-02-26. Separates agent intentions from deterministic state mutation, with append-only logs, verification and replay. **Takeaway:** preserve the boundary between probabilistic planning and deterministic execution.
4. [Localizing Emergent Failures in Agentic AI via Counterfactual Replay](https://arxiv.org/abs/2608.29228), 2026-09-06. Uses dependency-graph-constrained counterfactual replay to identify minimal repair families. **Takeaway:** replay should be graph-sliced and bounded, not brute-force all possible trajectories.
5. [Beyond the Diff: Addressing Agentic Entropy](https://arxiv.org/abs/2604.16323), 2026-03-03. Proposes process-oriented explainability and causal-graph views to expose drift between agent actions and architectural intent. **Takeaway:** MOONWITNESS should measure intent drift, not just code diffs.

## Current GitHub ecosystem / trending signals

Snapshot sources crawled Nov 6–8, 2026; star counts and rankings are mutable and are not quality or security evidence.

- [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify): code/docs/schema graph built with deterministic AST parsing and explainable edges; trend trackers report roughly 143k stars in early November. **Adopt as benchmark/inspiration:** parse repository artifacts deterministically; don't duplicate a code graph that already exists.
- [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem): persistent cross-session agent memory; trend tracker reports 113k+ stars and strong weekly growth. **Signal:** memory persistence is becoming commodity infrastructure.
- [FailproofAI/failproofai](https://github.com/FailproofAI/failproofai): agent observability and tool-call enforcement. **Signal:** policy enforcement belongs at the execution boundary, not just in dashboards.
- [Entelligence-AI/agentplay](https://github.com/Entelligence-AI/agentplay): session replay visualization. **Signal:** replay UX is valuable; MOONWITNESS should add evidence/policy snapshots and side-effect isolation.
- [OpenShell](https://github.com/NVIDIA/OpenShell) and [Anthropic sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime): runtime isolation direction. **Signal:** prefer hardened OS/container sandboxing to inventing a custom isolation boundary.

Reference indexes: [2026 AI Agent Papers](https://github.com/VoltAgent/awesome-ai-agent-papers), [Agent Trace & Evidence Attribution](https://github.com/aaronlyt/awesome-agent-trace-and-evidence-attribution), [GitHub agent-observability topic](https://github.com/topics/agent-observability).

## Reddit practitioner signal (qualitative, not peer-reviewed)

- [Memory architectures for long-running agents](https://www.reddit.com/r/AI_Agents/comments/1wx6lib/i_tested_3_different_memory_architectures_for/): practitioner reports hybrid episodic logs plus semantic retrieval preserved prior decisions better than raw history or vector retrieval alone; also warns unreliable external retrieval can poison memory.
- [Memory poisoning experiment](https://www.reddit.com/r/AI_Agents/comments/1wtbtna/i_tried_to_poison_an_ai_agents_memory_it_worked/): a practitioner describes contradictory or forged memory writes overwriting verified facts. Treat the reported test as an anecdote, not a validated benchmark; the threat model is still worth reproducing independently.
- [Belief versioning and contradictions](https://www.reddit.com/r/AI_Agents/comments/1vlxbyk/i_built_a_memory_layer_for_ai_agents_that_tracks/): discussion highlights explicit belief states, contradiction visibility, provenance, and scoped cross-agent sharing.

## Phase 16 — Causal Blast-Radius Mesh & Change Digital Twin

### Hypothesis

A proposed change should be evaluated against a causal/dependency mesh built from real system traces and declared architecture. It should estimate which data, tenants, policies, tools and workflows may be affected, then compare action branches against a no-op baseline.

### Proposed architecture

- ImpactNode: model, field, policy, agent, tool, connector, tenant, workflow, deployment.
- ImpactEdge: declared_dependency, observed_sequence, causal_hypothesis, experimentally_validated_cause.
- ChangeCapsule: proposed diff, evidence snapshot, registry fingerprint, policy version and affected scopes.
- ScenarioRunner: isolated fixture-based execution with bounded branch count and explicit no-op branch.
- ImpactReport: affected entities, predicted severity, uncertainty, missing telemetry, rollback/compensation options.
- CalibrationLoop: compare forecast to observed post-change outcomes; update edge confidence only with evidence.

### Novelty hypothesis

Not “a digital twin” in general. The potentially differentiated contribution is a **provenance-backed causal change forecast that binds each predicted impact to observed trace evidence and a reproducible policy snapshot**, including an explicit recommendation to do nothing when uncertainty is too high.

### Evaluation

Use historical changes as holdout cases. Measure affected-component precision/recall, tenant-scope accuracy, severity calibration, missed-impact rate, false alarms, and usefulness of the no-op recommendation. Compare against dependency-only static analysis and trace-only observability.

## Phase 17 — Knowledge Immune System & Adversarial Provenance Defense

### Hypothesis

Treat evidence ingestion as a security boundary. Separate source authenticity, source reputation, corroboration independence, semantic relevance, freshness and claim confidence. Quarantine suspicious evidence before it can influence high-impact decisions.

### Proposed architecture

- SourceIdentity: canonical source, signing key/domain identity where available, acquisition channel and provenance.
- EvidenceQualityVector: authenticity, freshness, independence, context completeness, conflict score, and policy eligibility (not one opaque trust score).
- ContaminationGraph: evidence-to-claim-to-belief-to-decision dependency paths.
- Quarantine: reversible evidence state, reason codes, operator review and expiry.
- BeliefCircuitBreaker: freezes promotion or high-impact action when a policy threshold is breached.
- AdversarialCorpus: prompt injection in retrieved documents, spoofed citations, source impersonation, stale replay, coordinated repetition, context-stripped quotations, and forged correction attempts.

### Novelty hypothesis

The differentiated product layer is a **causal contamination map**: if an upstream source is later proven compromised, ARSY can enumerate and invalidate every dependent belief and decision, then gate any still-pending action. This is more useful than a generic spam score or trust badge.

### Evaluation

Measure detection precision/recall, time-to-quarantine, downstream contamination depth, false quarantine, independent-source diversity, rollback completeness, and unsafe action prevention. Use blinded red-team fixtures and report failure cases.

## Implementation sequence and safety

1. Keep Phase 14 event ledger behind EvidenceStore; do not call the in-memory adapter production-ready.
2. Add durable PostgreSQL adapter with transactional append and optimistic stream versioning before concurrent production writes.
3. Introduce explicit source/claim/decision schemas, valid-time and recorded-time, tenant isolation, and deletion/retention semantics.
4. Keep Phase 15 replay pure by default; external calls are fixtures, never real side effects.
5. Integrate a hardened sandbox runtime instead of claiming the TypeScript guard itself is a sandbox.
6. Add Phase 16/17 only after the event and trace schema stabilizes.
7. Re-run prior-art and license review before selecting dependencies; do not copy AGPL/vendor-licensed components into a proprietary distribution without legal review.

## Implementation limitations in current branch

The initial code slice contains:
- an in-memory append-only ledger with per-aggregate hash chain, verification, and recorded-time query;
- replay capsule metadata and trace ordering;
- a deny-by-default proposal gate and pure-only replay guard.

Not implemented yet:
- durable storage, transactional concurrency, evidence graph projections, source authenticity/signatures, claim contradiction engine, actual replay runner, OS-level sandbox, external fixture adapters, CI tests, benchmark corpus, UI, and operator workflows.

The in-memory hash chain detects modifications within the stored event stream; it does not prove that a source is authentic or that a claim is true. A hash chain is not a substitute for signatures, access controls, backups, or independent verification.
