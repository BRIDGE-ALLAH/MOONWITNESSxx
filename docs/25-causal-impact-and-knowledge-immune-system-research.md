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


## Additional research and design correction (2026-11-08)

### Newly reviewed papers

- [When Does Execution Provenance Help Agent Memory Retrieval?](https://arxiv.org/abs/2609.25913): source-aligned provenance units improved complete evidence retrieval under a fixed token budget; graph propagation helped most when support spans multiple events. **Implementation consequence:** preserve exact source spans and typed provenance edges; do not add graph traversal to every query indiscriminately.
- [Agent Memory Is a Surface for Endogenous Authorization Laundering](https://arxiv.org/abs/2609.01836): stale or fabricated permission memories can cause downstream unauthorized actions. **Implementation consequence:** memory is evidence, never authority; authorization must be re-evaluated against current trusted policy and signed approval records.
- [Replay Is a Family of Assertions: Fork-Safety in Event-Sourced Agent Runtimes](https://arxiv.org/abs/2611.06924): projection replay, strict execution replay, and counterfactual continuation have different guarantees. **Implementation consequence:** label replay modes explicitly; a projection replay must never be described as full environment replay.
- [Remembering More, Risking More](https://arxiv.org/abs/2605.17830): memory-induced risk can increase with accumulated exposure and may be detectable before generation. **Implementation consequence:** evaluate memory safety longitudinally and gate on the retrieved evidence set, not only the final answer.

### Additional community review

- [Reddit: memory poisoning experiment](https://www.reddit.com/r/AI_Agents/comments/1wtbtna/i_tried_to_poison_an_ai_agents_memory_it_worked/): practitioner-reported 216/216 poisoned updates in one test; anecdotal and not independently validated. Treat this as a red-team scenario, not a general failure rate.
- [Reddit: memory architecture for long-running agents](https://www.reddit.com/r/AI_Agents/comments/1wx6lib/i_tested_3_different_memory_architectures_for/): supports separating episodic decision history from semantic retrieval; highlights source poisoning through untrusted external lookups.
- [Reddit: provenance across tool handoffs](https://www.reddit.com/r/LangChain/comments/1val0bn/tool_output_needs_provenance_when_one_agent_hands/): downstream agents need source type, observation time, actor/permission context, and read/inferred/approved distinction.
- [Reddit: immutable evidence envelopes](https://www.reddit.com/r/LangChain/comments/1vcu5qf/i_got_tired_of_agents_remembering_by_stuffing/): points out that a pointer to mutable external data is insufficient for historical replay; store the resolved snapshot or explicitly record why it was not captured.

### New implementation slice in this branch

- Phase 16: conservative impact propagation across declared dependencies and experimentally validated causal edges. Temporal co-occurrence edges are explicitly excluded from causal propagation.
- Phase 17: vector-based trust assessment, independent-origin corroboration, and a source contamination index that enumerates dependent claims/decisions.
- Phase 14: PostgreSQL append adapter serializes each aggregate with a transaction advisory lock and checks the expected previous hash to prevent cross-process stream forks. The migration remains a System Mode/deployment responsibility.
- Native Node test fixtures cover evidence idempotency/hash chaining, impact propagation, evidence quarantine, corroboration diversity, and contamination lookup. These tests are wired into CI but have not yet executed in this authoring environment.

### Further differentiated experiments (hypotheses, not novelty claims)

1. **Evidence Capture Contract:** every decision records whether its inputs were snapshotted, hash-only, pointer-only, capture-failed, or legacy-unknown. This makes “not reproducible” an explicit state rather than an auditor's guess.
2. **Authority Firewall:** memory may propose an authorization change but cannot grant it. Only a separately signed approval event from a principal with current authority can change effective permissions.
3. **Causal Contamination Quarantine:** a compromised source freezes only dependent claims and pending decisions, not the whole knowledge base; the blast radius is computed over provenance edges and reviewed before recovery.
4. **Replay Semantics Manifest:** every replay artifact declares projection-only, strict internal replay, or counterfactual simulation, plus which external oracles were served from recorded fixtures.
5. **No-Op Confidence Gate:** if predicted impact is high but edge provenance is weak, the engine recommends no-op or human review instead of inventing a precise risk estimate.

These ideas are differentiated integration hypotheses. A prior-art and patent search is still required before claiming novelty.


## Research dossier 3 — Runtime Contracts, Execution Attestation & Continuous Safety (2026-11-08)

### Phase 18 — Provenance-bound capability delegation

**Research basis**
- [Beyond Guardrails: Runtime Enforcement for Secure AI Agents](https://doi.org/10.62762/JRSC.2026.526903) reviews 58 studies and identifies action-boundary enforcement as the dominant placement, while durable authorization, multi-agent delegation and recovery from partial effects remain open problems.
- [SoK: Security Vulnerabilities in Agentic AI Systems](https://research.google/pubs/sok-security-vulnerabilities-in-agentic-ai-systems/) surveys 71 papers and production CVEs; its key structural concern is untrusted content acquiring authority and delegation laundering across agents.
- [Runtime Policy Enforcement for MCP-Based LLM Agents](https://www.mdpi.com/2079-9292/15/13/2829) evaluates a tool-boundary policy enforcement point with cross-step information-flow labels and a hash-chained audit log.
- [Towards Verifiably Safe Tool Use for LLM Agents](https://doi.org/10.1145/3786582.3786839) combines hazard analysis, capability-enhanced MCP and enforceable data-flow/tool-sequence specifications.

**Implementation hypothesis:** capabilities should be attenuable and purpose-bound across delegation. The root user grant is the ceiling; each sub-agent receives a narrower child grant. The policy decision must bind to normalized arguments and a one-time nonce to reduce TOCTOU and confused-deputy risks.

### Phase 19 — Proof-carrying execution

**Research basis**
- [Agent Safety Should Be a Runtime Contract](https://arxiv.org/abs/2608.11274) argues for preventive and evidential safety: block dangerous actions and require verifiable proof that intended actions actually occurred.
- [Proof of Execution: Runtime Verification for Governed AI Agent Actions](https://arxiv.org/abs/2607.05397) formalizes contract, causal event stream and replay context as a runtime-checkable execution proof.
- [Auditable LLM Autonomy for Operational Decision-Making](https://doi.org/10.32604/cmc.2026.082270) separates evidence, decision traces and outcomes into independently auditable planes.

**Implementation hypothesis:** an execution attestation should be issued only after an independent verifier checks authorization, actor/tenant consistency, approval timing, effect receipts and terminal outcomes. A trace hash alone is not a signature or proof that the external world actually changed as recorded.

### Phase 20 — Continuous agent safety lab

**Research basis**
- [TraceProbe: An Execution-Based Benchmark for Diagnosing Safety Failures in LLM Agents](https://aclanthology.org/2026.emnlp-main.1233/) provides 155 executable scenarios, trace-level diagnosis and replay-oriented localization; it reports unsafe intermediate actions even when final outcomes appear safe.
- [Formal Runtime Verification for Tool-Using LLM Agents](https://doi.org/10.1145/3847353.3847499) studies temporal-logic monitors on recorded traces and highlights the trade-off between attack detection and benign false positives.
- [The Balkanization of Execution-Security Research for AI Coding Agents](https://arxiv.org/abs/2607.05743) surveys execution isolation, access control, TOCTOU, MCP, identity delegation and provenance as fragmented but connected security concerns.

**Implementation hypothesis:** each policy update should be tested against a fixed, versioned corpus plus generated mutations of known traces. Report false-block and escape rates; never optimize one metric in isolation.

### Ecosystem and practitioner signals

- [FailproofAI](https://github.com/FailproofAI/failproofai) is a fast-growing TypeScript enforcement/observability project with hooks across agent harnesses. Its custom license includes Commons Clause restrictions; do not embed it or copy code without license review. Use it as a functional benchmark only.
- [GitHub agent-observability topic](https://github.com/topics/agent-observability) shows a crowded observability category. MOONWITNESS should differentiate through enforceable capability lineage and independently verifiable execution evidence rather than another trace dashboard.
- Practitioner discussions in [r/AI_Agents](https://www.reddit.com/r/AI_Agents/) and [r/LangChain](https://www.reddit.com/r/LangChain/) repeatedly surface prompt-injection through tool outputs, memory poisoning, identity handoff and replay gaps. These are useful threat hypotheses, not peer-reviewed measurements; include them in red-team fixtures and verify independently.

### Differentiated experiments (not novelty claims)

1. **Delegation Attenuation Proof:** generate a machine-checkable proof that every child capability is a strict subset of its parent, including purpose, tenant, resource and expiry.
2. **Effect Receipt Quorum:** for high-impact operations, require both the policy gateway receipt and provider-observed effect receipt before issuing a completion attestation.
3. **Causal Policy Mutation:** mutate a policy or provenance edge, then use trace dependency to identify the smallest historical scenario set that should fail. This prioritizes regression coverage by causal blast radius.
4. **Authority-Budget Ledger:** every agent delegation spends from a finite action/resource/time budget; delegation cannot mint new authority. Revoke downstream grants when the root grant expires or is revoked.
5. **Negative-Space Audit:** periodically sample operations that *did not* execute—denied calls, abandoned plans, missing receipts—to detect silent bypasses and gaps in telemetry.

These are integration hypotheses. A formal novelty/patent search and implementation benchmarking remain necessary.
