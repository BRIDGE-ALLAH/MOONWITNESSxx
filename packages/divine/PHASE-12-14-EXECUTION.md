# Divine Phases 12–14 execution

- Phase 12 Epistemic Time Machine: bitemporal snapshots separate valid time (validFrom/validTo) from knowledge time (recordedAt), pin a Corpus release, hash snapshots and diff claim-level changes.
- Phase 13 Counterfactual Evidence Surgery: remove evidence graph edges, compare reachability, report affected nodes and bounded exhaustive minimal cut sets (maximum 16 edges). This is structural dependency analysis, not causal inference.
- Phase 14 Evidence Entropy Tomography: calculate Shannon entropy, effective witness-family count and concentration from declared family IDs. Missing family IDs force independenceStatus=unknown. Entropy is not truth probability or source authenticity.
- Phase 11 interoperability completion slice: minimal TEI P5 text export, IIIF Presentation 3 manifest builder requiring real canvas dimensions and image service IDs, plus Semantic Loss Budget gate. TEI explicitly reports omitted layout, hands, apparatus and uncertainty. Not full schema conformance.

## Research reviewed
- Nussbaum-Hoffer et al., EMNLP 2026, LLM Explainability with Counterfactual Chains and Causal Graphs: https://aclanthology.org/2026.emnlp-main.2152/
- Wu et al., AAAI 2026, AgentGraph trace-to-graph robustness testing: https://doi.org/10.1609/aaai.v40i48.42393
- Counterfactual and risk temporal knowledge graph for project risk management, EAAI 2026: https://doi.org/10.1016/j.engappai.2026.114568
- From Agent Traces to Trust survey (2026 preprint): https://arxiv.org/abs/2606.04990
- 47-repository agent knowledge-base survey: https://github.com/irresi/awesome-agentic-knowledge-base
- GitHub knowledge graph trending snapshot Nov 7 2026: https://github.locker/topics/knowledge-graph
- Reddit practitioners discuss temporal tagging, contradictions, entity linking and hybrid retrieval: https://www.reddit.com/r/LocalLLaMA/comments/1r21ojm/weve_built_memory_into_4_different_agent_systems/ and https://www.reddit.com/r/LocalLLaMA/comments/1r8cnwq/analyzed_8_agent_memory_systems_endtoend_heres/

## Acceptance boundaries
No persistent event store, no automatic canonical writes, no causal truth claim, no probability-of-truth score, no provider calls, and no full TEI/IIIF schema validation. Synthetic tests cover deterministic invariants only.

## Additional research hypotheses for later phases
1. **Epistemic checksum:** bind a claim's exact selector, valid-time slice, Corpus release, witness-family map, rights snapshot and method version into one verifiable research capsule. A change in any component invalidates downstream attestations.
2. **Witness genealogy inference:** propose (never silently assert) source-family links from shared rare errors, ordering, omissions and textual variants; require cited comparison spans and scholar review before the family graph changes.
3. **Adversarial citation fuzzer:** mutate Unicode normalization, OCR confusables, RTL punctuation, offsets and quote boundaries; require exact source-span rejection and report false acceptance rates by script/language.
4. **Negative-space atlas:** map which source families, periods, languages and manuscript lineages are absent from a research result, separating genuine absence from unavailable/restricted/not-yet-ingested material.

These are testable novelty hypotheses, not claims of global first invention. Prior-art review and independent evaluation are required.
