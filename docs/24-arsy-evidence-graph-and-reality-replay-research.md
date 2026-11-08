# MOONWITNESS Research Dossier — ARSY Evidence Graph & Reality Replay

**Date:** 2026-11-08  
**Repository:** BRIDGE-ALLAH/MOONWITNESS  
**Purpose:** Research-backed product/architecture hypotheses for two proposed phases.  
**Status:** Discovery and design proposal; no claim that either system is implemented or globally novel.

## Executive thesis

MOONWITNESS should compete on **accountable intelligence**, not merely another agent framework or memory store. ARSY should be able to show what it knew, why it acted, what changed, and whether a proposed action remains safe under current evidence and policy.

The two proposed layers are complementary:

1. **Living Evidence Graph (LEG):** a temporal, provenance-aware model of evidence, claims, beliefs, decisions and outcomes.
2. **Reality Replay & Counterfactual Safety Engine (RRCSE):** a replay capsule and sandbox that reconstructs a prior decision context, tests alternatives, contains side effects, and compares predicted with observed outcomes.

These are research hypotheses and a differentiated integration proposal. Existing work overlaps materially; “first in the world” is not established.

## Prior-art and ecosystem scan

### Research papers

| Work | Relevant contribution | Implication for MOONWITNESS |
|---|---|---|
| [From Agent Traces to Trust: Evidence Tracing and Execution Provenance in LLM Agents](https://arxiv.org/abs/2606.04990) | Survey/framework for tracing evidence, tool outputs, memory, actions and final answers; identifies unified trace schemas, semantic provenance and privacy-aware audit as open challenges. | Build a typed evidence-to-decision lineage and measure process-level accountability, not only final answer accuracy. |
| [Agent Zero Memory: Provenance-Aware Long-Term Memory for LLM Agents](https://arxiv.org/abs/2608.29606) | Combines episodic events, entity-event graph and curated documentary memory; uses provenance and citation-locked retrieval. | Multi-view memory and source-locked citations are prior art; differentiate through policy-aware decision snapshots and action safety. |
| [PROJECTMEM: A Local-First, Event-Sourced Memory and Judgment Layer for AI Coding Agents](https://arxiv.org/abs/2606.12329) | Append-only event log, deterministic projections and pre-action warnings against repeating failed changes. | Event-sourced governance and pre-action gates already exist as concepts; extend toward replay capsules and side-effect containment. |
| [S2CAgent (ASE 2026)](https://conf.researchr.org/details/ase-2026/ase-2026-research-track/217/S2CAgent-A-Self-Learning-Agent-Knowledge-Graph-Framework-for-Software-Supply-Chain-A) | Self-learning knowledge graph for software supply-chain reasoning with structured evidence and multi-hop analysis. | Apply provenance graph patterns to dependency, module, policy and deployment risk inside MOONWITNESS. |

### GitHub / open-source signals

- [awesome-ai-agent-papers](https://github.com/VoltAgent/awesome-ai-agent-papers): active 2026 index covering memory, agent tooling, evaluation, observability and security.
- [awesome-agent-infrastructure](https://github.com/backblaze-labs/awesome-agent-infrastructure): ecosystem map for agent runtimes, memory, MCP, sandboxes, observability and evaluation.
- [Hindsight](https://github.com/vectorize-io/hindsight), [Graphiti](https://github.com/getzep/graphiti), [Mem0](https://github.com/mem0ai/mem0), and [PROJECTMEM](https://github.com/riponcm/projectmem): relevant memory/context prior art; evaluate licenses and benchmark methodology before adopting.
- A recent autumn 2026 ecosystem survey reports fast growth in agent harnesses and memory/context infrastructure, including Hindsight, claude-mem, OpenViking, Mem0 and Graphiti. Treat stars as attention, not production adoption: [Loams open-source infrastructure trends](https://www.loams.dev/blog/open-source-infra-trends-autumn-2026).

### Community signal (Reddit)

- [r/AI_Agents: memory architectures for long-running agents](https://www.reddit.com/r/AI_Agents/comments/1wx6lib/i_tested_3_different_memory_architectures_for/): practitioners describe hybrid episodic logs plus vector retrieval, and emphasize versioned beliefs, source provenance, conflict handling and keeping superseded knowledge historically inspectable.
- [r/LangChain: memory observability](https://www.reddit.com/r/LangChain/comments/1u0g04g/if_youre_building_longrunning_ai_agents_do_you/): community discussion proposes hash-chained memory writes, Git-like rollback, confidence decay, conflict detection and deletion semantics.
- Reddit is qualitative practitioner input, not peer-reviewed validation; validate claims with prototypes and controlled benchmarks.

## Product concept A — Living Evidence Graph

### Core model

- **Observation:** immutable captured input with source identity, timestamp, content hash and access policy.
- **Evidence:** a normalized source fragment or tool result, always linked to its raw observation.
- **Claim:** a proposition extracted from evidence; claims are not automatically facts.
- **Belief:** a time-versioned system position supported or contested by claims.
- **Decision:** a choice with alternatives, constraints, evidence snapshot, policy version and rationale.
- **Action / Outcome:** the operation attempted and its observed effects.
- **Relations:** supports, contradicts, derived_from, supersedes, depends_on, caused_by and observed_as.

### Technical direction

Use append-only typed events as the audit backbone; store graph projections for traversal; retain lexical/vector indexes only as retrieval accelerators, never as authoritative evidence. Model both valid-time and recorded-time. Add a claim promotion gate, contradiction detection, provenance-locked answer generation and privacy-aware deletion/tombstones. Use content hashes for integrity, not as proof that a source itself is truthful.

### Potential differentiator

The useful research gap is not “agent memory” alone. It is the join between **evidence lineage → evolving belief → policy decision → authorized action → measured outcome**, queryable at any historical point and enforceable before the next action.

## Product concept B — Reality Replay & Counterfactual Safety Engine

### Core model

A Replay Capsule binds the registry/policy fingerprint, actor scope, input/evidence snapshot, tool versions, execution trace and controlled dependency state. Replay executes internal logic against mocks/snapshots and explicitly blocks live side effects. Counterfactual branches vary one or more declared assumptions or action parameters and compare outcomes against a baseline.

### Technical direction

1. Record typed events and causal IDs across ARSY services and tool calls.
2. Define replay-safe adapters and side-effect classes (pure, idempotent, compensatable, irreversible).
3. Snapshot policy and registry versions; do not replay against current policy silently.
4. Execute in an isolated sandbox with outbound network disabled by default.
5. Compare invariants, predicted outcomes and actual outcomes.
6. Gate real actions using evidence freshness, authorization, reversibility and blast radius.
7. Route destructive or high-impact actions to human approval.

### Potential differentiator

Most tracing explains what happened; most simulation tests a model or workflow. MOONWITNESS can investigate a practical bridge: **reconstruct the exact evidence/policy context of an agent decision, explore safe counterfactuals, then enforce the same safety constraints on the real action**.

## Suggested evaluation plan

| Metric | Test |
|---|---|
| Provenance completeness | Fraction of promoted claims with resolvable source spans and immutable source references |
| Historical reconstruction | Can the system answer what it knew at event N without leaking later information? |
| Conflict handling | Contradictory, stale and corrected evidence fixtures |
| Replay fidelity | Deterministic internal path under fixed dependencies; document nondeterministic boundaries |
| Side-effect containment | Verify replay cannot invoke live writes, sends, payments or destructive operations |
| Decision calibration | Compare confidence/risk estimates with observed outcomes |
| Safety effectiveness | Unsafe-action escape rate and false-block rate |
| Recovery | Crash/timeout/duplicate/partial failure replay and compensation behavior |

## Recommended implementation sequence

1. Add schema and event contracts to ARSY core only after the missing core foundation is made real.
2. Prototype LEG as a bounded module with SQLite event log + PostgreSQL projections if the existing DB split is retained; keep the source of truth explicit.
3. Add replay capsule capture for one reversible workflow.
4. Add sandbox and side-effect deny-by-default.
5. Run adversarial fixtures and publish reproducible benchmark results.
6. Expand only after the first workflow proves value.

## Risks and guardrails

- Graphs and vector search can amplify poisoned sources: preserve source quality and trust separately from retrieval success.
- Hash chains prove tamper evidence, not correctness or authenticity of the original source.
- “Deterministic replay” is limited by nondeterministic models, clocks, network responses and external services; snapshot or mock those boundaries and report residual nondeterminism.
- Never store secrets in traces or evidence snapshots; redact before persistence.
- Retention and deletion policies override audit convenience; cryptographic continuity must not become a reason to retain prohibited personal data.
- Avoid adding a new database or graph engine before proving the first vertical slice; begin with typed event log and derived indexes.
- Do not claim global novelty until a systematic prior-art, patent and implementation review is completed.

## Source links

- https://arxiv.org/abs/2606.04990
- https://arxiv.org/abs/2608.29606
- https://arxiv.org/abs/2606.12329
- https://conf.researchr.org/details/ase-2026/ase-2026-research-track/217/S2CAgent-A-Self-Learning-Agent-Knowledge-Graph-Framework-for-Software-Supply-Chain-A
- https://github.com/VoltAgent/awesome-ai-agent-papers
- https://github.com/backblaze-labs/awesome-agent-infrastructure
- https://www.loams.dev/blog/open-source-infra-trends-autumn-2026
- https://www.reddit.com/r/AI_Agents/comments/1wx6lib/i_tested_3_different_memory_architectures_for/
- https://www.reddit.com/r/LangChain/comments/1u0g04g/if_youre_building_longrunning_ai_agents_do_you/
