# Research notes — Divine Phases 9–11 (2026-11-08)

## Findings reviewed
- TRACE: Governing Memory Validity in Evolving Multi-Agent Systems (arXiv:2609.33517, 2026). Useful concept: memory re-entry is an eligibility decision, not merely retrieval. Applied as release-bound candidate input and human gate; reported benchmark figures are author-reported, not independently reproduced.
- From Agent Traces to Trust: Evidence Tracing and Execution Provenance in LLM Agents (arXiv:2606.04990, 2026). Supports a unified trace schema linking source spans, tools, memory, claims and actions.
- Hindsight, ACL 2026 Demo (ACL Anthology 2026.acl-demo.27): separation of world facts, experience, observations and opinions; temporal recall. Do not duplicate it wholesale; retain Divine's source/claim/review boundaries.
- APEX-MEM, ACL 2026 (ACL Anthology 2026.acl-long.749): append-only temporal graph memory and query-time conflict resolution.
- AgentGraph, AAAI 2026 Demo (DOI 10.1609/aaai.v40i48.42393): trace-to-graph analysis and perturbation testing.
- TRACE: Tamper-Resistant Accountability and Cryptographic Evidence for Multi-Agent AI Systems (IEEE BigDataSecurity 2026, DOI 10.1109/BigDataSecurity69476.2026.00021): provenance commitments and temporal reconstruction. Digest chain in this slice is not equivalent to its full cryptographic protocol.

## GitHub ecosystem signals
- irersi/awesome-agentic-knowledge-base surveys 47 open-source agent knowledge systems and reports common use of Postgres/pgvector, MCP, and multiple memory patterns; it also highlights no-DB and file-first alternatives. Use it as a living survey, not a neutral benchmark.
- getzep/graphiti demonstrates bi-temporal entity edges.
- vectorize-io/hindsight separates world/experience/observation/opinion networks.
- NVIDIA/auto-ontology is a provenance-backed ontology layer surfaced in recent GitHub trend roundups.
- xiaoqi-7/Agent-Tracing-Survey tracks evidence tracing and execution provenance.

## Reddit/community signals
- r/AI_Agents, “I ran 8 AI agent memory systems through 2176 tasks…” (Aug 2026): the poster reports a curated Markdown wiki outperformed evaluated products on their benchmark; anecdotal/benchmark-specific, but a useful reminder to preserve inspectable human-readable artifacts.
- r/AI_Agents, “I tested 12 AI memory systems across 1,800 tasks…” (Sep 2026): reports Cognee and a Markdown wiki tied; benchmark design and judge quality remain caveats.

## New high-risk/high-upside ideas
1. Epistemic Time Machine: answer “what could this research release legitimately know on date T?” by pinning source release, rights, ontology, methods, evidence and decisions.
2. Counterfactual Witness Mutation Lab: mutate one source/edge/selector and quantify which conclusions change; pair with metamorphic invariants.
3. Evidence Entropy Budget: decompose uncertainty into missing source, dependent witnesses, stale evidence, ambiguous selector and unresolved contradiction. Never present as truth probability.
4. Adversarial Citation Firewall: source-span verification plus untrusted-content isolation; never rely on regex alone for prompt-injection security.
5. Rights-aware compute routing: before retrieval/export/model inference, route to content, metadata-only, or deny paths based on source-specific rights and purpose.
6. Proof-carrying research release: each release bundles source lineage, method versions, rights decisions, review events and reproducibility digest; signatures only after key management exists.

## Novelty discipline
No claim that these ideas are globally unprecedented. The defensible research contribution is a measurable end-to-end composition with clear invariants, release replay, rights gates and human accountability. Conduct a formal prior-art search and benchmark before any “first in the world” claim.
