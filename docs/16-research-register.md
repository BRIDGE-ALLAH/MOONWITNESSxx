
## 7. MOONWITNESS WITNESS FABRIC research (2026-11-08)

### Research papers and implications
- **Auditable Agents** (Nian et al., 2026): https://arxiv.org/abs/2604.05485  
  Frames auditability around action recoverability, lifecycle coverage, policy checkability, responsibility attribution, and evidence integrity. It reports pre-execution mediation plus tamper-evident records with 8.3 ms median overhead in its evaluated setup. Design implication: every external side effect should have a policy decision and evidence receipt before/after execution.
- **Responsible Agentic AI Requires Explicit Provenance** (Hu et al., 2026): https://arxiv.org/abs/2605.17169  
  Argues provenance must span the agent lifecycle to make responsibility traceable and interventionable. Design implication: capture actor, tool, inputs/outputs references, policy checks, and causal links—not only chat transcripts.
- **PROV-AGENT** (Souza et al., 2025): https://arxiv.org/abs/2508.02866  
  Extends W3C PROV ideas to agent prompts, responses, decisions, and workflow context. Design implication: model activities, entities, agents, and derivation relationships explicitly.
- **APEX-MEM** (ACL 2026): https://aclanthology.org/2026.acl-long.749/  
  Uses temporally grounded entity-centric graph memory and append-only history with retrieval-time conflict resolution. Design implication: retain conflicting versions and resolve them at query time instead of overwriting history.
- **TKG-Thinker** (EMNLP 2026): https://aclanthology.org/2026.emnlp-main.152/  
  Studies dynamic temporal KG reasoning with autonomous planning and adaptive retrieval. Design implication: attach valid-time and observed-time to facts and require temporal constraints in retrieval.
- **SAR** (AAAI 2026): https://ojs.aaai.org/index.php/AAAI/article/view/40369  
  Aligns natural-language questions with structured entities, relations, and temporal constraints, then verifies answers. Design implication: structured query constraints and a final verification stage should be explicit.

### Community signals (anecdotal, not benchmarks)
- Reddit discussion on graph-memory engineering lessons: https://www.reddit.com/r/AI_Agents/comments/1ts3nq2/i_spent_a_year_building_agent_memory_on_knowledge/  
  Practitioner highlights ontology overreach, framework lock-in, and need for immutable observations and multi-hop traversal. Treat as one experience report, not universal evidence.
- GitHub trend snapshots: https://github.com/topics/agentic-ai and https://github.com/topics/agent-orchestration  
  Current ecosystem interest clusters around long-horizon coding agents, agent memory, durable execution, orchestration, and accountability. Star counts are volatile; use project adoption as a signal, not proof of technical superiority.

### Research synthesis and proposed differentiator
The individual ingredients are established research directions. MOONWITNESS should differentiate through a single operator-facing **Evidence-to-Decision Replay**: one query reconstructs what was observed, which claims were formed, how confidence changed, which policies were checked, who/what acted, and what downstream decision followed. The novelty claim must remain a hypothesis until a prior-art review and measurable evaluation are complete.


## 8. WITNESS FABRIC follow-up research (2026-11-08)

### Papers and prior art
- **Beyond Entity Correlations: Disentangling Event Causal Puzzles in Temporal Knowledge Graphs** (ICLR 2026): https://proceedings.iclr.cc/paper_files/paper/2026/hash/cafcbf5d00a961a05bd5875c17ef0fe7-Abstract-Conference.html — HEDRA explicitly uses counterfactual detection and causal disentanglement. This is prior art for the Counterfactual Observatory; our implementation is deliberately a simpler deterministic evidence-removal sensitivity tool.
- **EZ-check: Explainable zero-shot knowledge extraction and fact checking using knowledge graphs** (Information Sciences, 25 June 2026): https://doi.org/10.1016/j.ins.2026.123293 — supports graph-grounded claim verification as a relevant research direction.
- **FreeGuard: Claim level graph reasoning for training free LLM hallucination mitigation** (2026): https://link.springer.com/article/10.1007/s10791-026-10667-z — includes atomic claim graphs, bidirectional evidence verification and counterfactual evidence-chain governance; direct prior art to account for.
- **Process-aware programming assessment through temporal knowledge graph reasoning and LLM verification** (4 June 2026): https://doi.org/10.1007/s44163-026-01423-9 — temporal process graphs and verification.

### Community observations (anecdotal)
- Reddit memory architecture discussions report static context injection, no temporal decay, missing provenance, silent contradictions, and indexing latency: https://www.reddit.com/r/AI_Agents/comments/1t5hkdq/we_asked_ai_agents_what_was_broken_about_their/
- Practitioners describe hybrid episodic + semantic memory and the risk of superseded facts returning from vector search: https://www.reddit.com/r/AI_Agents/comments/1wx6lib/i_tested_3_different_memory_architectures_for/
- State-integrity discussions recommend invalidating derived claims when their source state is superseded: https://www.reddit.com/r/AI_Agents/comments/1whlop5/i_dont_think_ai_agents_have_a_memory_problem_i/

### GitHub ecosystem scan
- Agentic knowledge-base survey of 47 repositories: https://github.com/irresi/awesome-agentic-knowledge-base — observed patterns include append-only history, temporal KG (Graphiti), multi-tier memory (Hindsight/MemOS), local-first/no-DB designs and MCP. Survey is secondary and should be independently verified before strategic decisions.
- Agent-memory trend snapshot: https://github.locker/topics/agent-memory — use star velocity only as a weak adoption signal.
- Knowledge-graph trend snapshot: https://github.locker/topics/knowledge-graph — Graphify, Understand-Anything, Hindsight and auto-ontology are useful competitors/prior-art references.

### New product hypothesis: Evidence Flight Recorder
Package an independently verifiable incident bundle: anchored event prefix + claim-genome branch + policy decision + counterfactual sensitivity report + drift alerts. Cross-vendor portability and cryptographically signed provenance may differentiate it, but this is a hypothesis, not a world-first claim. Requires signed checkpoint implementation, interoperability study, adversarial benchmark and legal prior-art review.
