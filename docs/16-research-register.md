
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
