# Divine Phases 6–8 — Research & design record

**Reviewed:** 2026-11-08  
**Status:** implementation proposal grounded in public literature and repository review; not a novelty or production-readiness claim.

## Design thesis

The differentiator worth testing is a single, reproducible evidence-to-reasoning pipeline that keeps canonical witness identity, scoped inference, retrieval ranking, and audit manifests separate. The novelty hypothesis is the composition and measurable guarantees—not a claim that graph provenance, defeasible logic, or research manifests are individually new.

## Research signals reviewed

- [From Agent Traces to Trust: A Survey of Evidence Tracing and Execution Provenance in LLM Agents](https://github.com/aaronlyt/awesome-agent-trace-and-evidence-attribution): trace-level provenance, attribution and failure diagnosis are active research concerns.
- [Aegis runtime governance paper](https://arxiv.org/abs/2608.16891): argues that action enforcement belongs at a trusted runtime boundary; its sandbox findings should not be generalized into universal safety guarantees.
- [GH-AWTrace](https://arxiv.org/abs/2611.06866): execution logs can expose tool denials, provider failures and delegation, while logs remain partial observations.
- [Agentic Governance Ribbon](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6803162): lifecycle and risk-tier governance is a useful organizational frame.
- [TRiSM for Agentic AI](https://doi.org/10.1016/j.aiopen.2026.02.006): highlights trust, risk, security and coordination evaluation gaps.
- [Transparency in Agentic AI](https://engrxiv.org/preprint/view/6451): proposes outcome artifacts that bundle lifecycle evidence; preprint claims need independent evaluation.
- [Autumn 2026 open-source infrastructure survey](https://www.loams.dev/blog/open-source-infra-trends-autumn-2026): agent memory/provenance infrastructure is gaining attention; repository popularity is not proof of correctness or license compatibility.

## GitHub / open-source signals

- [provenance-logic/provenance](https://github.com/provenance-logic/provenance): governance, lineage and trust classification.
- [awesome-agent-trace-and-evidence-attribution](https://github.com/aaronlyt/awesome-agent-trace-and-evidence-attribution): curated map of trace/evidence attribution tools and papers.
- [VoltAgent/awesome-ai-agent-papers](https://github.com/VoltAgent/awesome-ai-agent-papers): 2026 agent paper index; discovery index, not primary evidence.

## Reddit field notes

- [Memory observability discussion](https://www.reddit.com/r/LangChain/comments/1u0g04g/if_youre_building_longrunning_ai_agents_do_you/): community discussion calls out inability to answer what an agent knew at a given step; treat as anecdotal signal.
- [Agent memory architectures](https://www.reddit.com/r/AI_Agents/comments/1wx6lib/i_tested_3_different_memory_architectures_for/): poster reports structured episodic log plus retrieval worked better for their multi-day task; not a controlled benchmark.
- [Memory suppression and identity](https://www.reddit.com/r/AI_Agents/comments/1uxwp0i/after_a_year_building_agent_memory_im_convinced/): anecdotal concern that stale facts and unresolved identity across messages are more important than embedding similarity alone.

## Implemented slices

1. **Witness Graph:** typed evidence relations, provenance required per edge, bounded path traversal, deterministic serialization, and explicit non-identity classification.
2. **Method-bound Reasoning:** deterministic rule evaluation, scoped premises, explicit defeaters, premise/evidence trace, and conflict preservation.
3. **Research Reproducibility:** exact/citation/structural channels rank before lexical/semantic channels, semantic method disclosure, SHA-256 input digest, and manifest verification.

## Unusual research directions to validate next

- **Counterfactual Witness Mutation Lab:** generate synthetic witness-family perturbations (missing leaf, swapped lineage, altered passage selector) and measure whether reasoning changes only where expected.
- **Epistemic Time-Travel:** reconstruct what a research session could legitimately conclude using only the corpus release, ontology version and evidence visible at that timestamp.
- **Evidence Entropy Budget:** quantify unresolved independent witness families and missing provenance without converting the metric into a truth score.
- **Adversarial Citation Firewall:** treat every retrieved passage as untrusted input, verify citation selectors against source manifests, and prevent embedded instructions from affecting extraction workflows.

These are hypotheses and prototype directions, not assertions of world-first invention. Before adding vector DB, graph DB, RDF store or AI provider, benchmark against the current TypeScript modules and verify source rights.

## Evaluation plan

Track path provenance completeness, dangling-edge rate, deterministic replay pass rate, citation precision, retrieval precision/recall by channel, scope violation rate, contradiction retention, abstention precision/recall, reviewer disagreement and time-to-reconstruct. Publish denominators and dataset rights; use synthetic or rights-cleared fixtures only.
