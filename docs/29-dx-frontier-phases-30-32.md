# MOONWITNESS DX Frontier — Phases 30–32

**Snapshot:** 2026-11-08  
**Branch:** \`feat/moonwitness-dx-phases-30-32\`  
**Design:** convert static coordination hints into evidence-aware release gates, without pretending local JSON is a trusted CI attestation.

## Phase 30 — Objective-Gap Control Plane
Command: \`pnpm devx objective-plane --input=.moonwitness/objectives.json\`.

An objective has acceptance criteria with stable IDs and optional owners. Observations are timestamped and state passed/failed/unknown. A criterion is satisfied only when its latest observation is explicitly verified and carries an evidence ID. The output reports completed/open objectives, gap fingerprints and next actions grouped by owner.

Limit: evidence IDs and the verified flag are supplied assertions until CI/reviewer signatures are authenticated. It does not schedule or terminate agents.

## Phase 31 — Interface Escrow
Command: \`pnpm devx interface-escrow --input=.moonwitness/escrow.json\`.

A breaking contract declares an interface set, version and expiry. The escrow computes a SHA-256 fingerprint over the change and declared provider/consumer treaties. Every affected consumer must acknowledge that exact fingerprint before the escrow is merge-ready.

Limit: this is a declaration contract, not an automatic TypeScript/OpenAPI/GraphQL/SQL schema diff. Consumer identity is not authenticated by the local CLI.

## Phase 32 — Proof-Carrying Merge Queue
Command: \`pnpm devx merge-proof --input=.moonwitness/merge-evidence.json\`.

The packet recomputes objective status, validates the interface escrow, forecasts declared resource collisions, requires four quality-gate assertions, evidence hashes and a verified rollback plan, then hashes the packet.

Limit: supplied CI status/run IDs are not authenticated against GitHub, and the digest is not a signature. This command does not merge PRs or bypass GitHub review/branch protection. A future adapter must query checks for the exact commit, validate actor identity and sign/persist the receipt.

## Research synthesis and new hypotheses
- The 2026 systematic mapping study of 94 Agentic Software Engineering papers reports that only 19.8% of evaluation records attribute evidence to an individual design decision, while 52.3% evaluate complete systems. This motivates per-gate ablations and evidence-to-decision lineage rather than merely adding more agent roles.
- PASC's 2026 ESEM shared-workspace study reports gains from peer-aware action-space coordination, while observing rising interference beyond two agents. This suggests **bounded swarm topology**: adapt team size to collision density and interface coupling rather than maximizing parallelism.
- Soei (arXiv:2610.39468, submitted 29 Oct 2026) proposes acknowledgement-aware traces, hash-chained ledgers, W3C PROV alignment and explicit separation of completion claims from proof. This overlaps strongly with our evidence packet direction; treat as prior art, not novelty.
- RCP (published 28 Aug 2026) uses SQL-backed orchestration state and a verify-before-summarize loop, another relevant prior-art signal for a persisted control plane.
- Reddit reports corroborate practical pain around shared runtime state and false progress; anecdotal reports are not controlled evidence.
- GitHub ecosystem trend: agent orchestration and proactive coding agents are growing; compare with existing orchestrators and sandboxes before implementing custom scheduling.

### Frontier hypotheses to benchmark (not world-first claims)
1. **Adaptive swarm topology:** use interface graph centrality, resource overlap and objective coupling to cap parallel agent count and choose peer-aware vs isolated execution.
2. **Evidence debt market:** every unverified claim creates measurable evidence debt with owner, expiry and downstream dependency cost; release priority is driven by debt reduction.
3. **Causal rollback selection:** select rollback/compensation based on observed dependency graph and reversible effect classes, not merely git revert.
4. **Contract migration canary:** replay consumer fixtures against old/new schemas, then graduate escrow acknowledgements into machine-generated compatibility proofs.
5. **Proof-carrying CI economics:** optimize fast test selection under a measured false-negative budget with randomized full-suite audits and per-test historical defect yield.

No claim is made that these ideas are globally unprecedented. Differentiation requires a systematic patent/paper/code prior-art review and public reproducible benchmarks.

## Acceptance metrics
- Objective false-complete rate; evidence coverage per criterion; time-to-close gap.
- Interface escrow false-block and missed-consumer rates.
- Merge packet false-ready rate; percentage of packets bound to authenticated commit checks.
- Agent throughput versus destructive collision rate as swarm size increases.
- Rollback recovery time and side-effect containment.


## Updated frontier scan — 2026-11-08

### Papers reviewed in this pass
- [Soei: Structured Observability of Evidence and Intent for Multi-Agent AI Software Engineering](https://arxiv.org/abs/2610.39468) (29 Oct 2026). Its 45-session prototype reports 23.4% of code-editing episodes had no independent check after the last edit and 57.8% of agent-marked-complete to-dos lacked proof in between. It proposes acknowledgement-aware traces, a hash-chained ledger, W3C PROV-aligned lineage and separation of completion claims from proof. **Design consequence:** prioritize evidence gates and independent verification; the sample is limited and its estimates are not universal prevalence.
- [Coordinating Agents on a Shared Git Workspace (PASC)](https://doi.org/10.4230/LIPIcs.ESEM.2026.18) (ESEM 2026). On the evaluated SWE-Bench Pro Python subset, peer-aware two-agent coordination reduced destructive concurrent edits by about 47% and cost per resolved task by about 20% versus the silent two-agent baseline; preliminary observations show interference grows beyond two agents. **Design consequence:** make swarm size adaptive to coupling and collision density; two agents are not a universal optimum.
- [A Domain-Agnostic Agentic Architecture for Structured Extraction of Engineering Knowledge (RCP)](https://doi.org/10.1080/08839514.2026.2712892) (28 Aug 2026). A SQL-backed orchestration state and verify-before-summarize loop reduced hallucinations in two industrial case studies. **Design consequence:** persist intermediate validation state and expose unmet evidence as explicit failures.
- [Design Problems, Decisions, and Evidence in Agentic Software Engineering: A Systematic Mapping Study](https://doi.org/10.3390/electronics15215121) (2026). Across 94 included studies and 1,018 design decisions, only 19.8% of evaluation records attributed evidence to an individual decision while 52.3% evaluated complete systems. **Design consequence:** benchmark each MOONWITNESS gate with ablations; don't infer a component's value from whole-system success.

### GitHub trending / ecosystem snapshot
The Nov 7, 2026 snapshots show fast growth in verification, skills, persistent memory and orchestration:
- [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill): +2,548 stars in the daily snapshot; emphasizes multi-phase audits with independently verified machine-readable findings.
- [google/skills](https://github.com/google/skills): +534 daily stars; skills are becoming portable operational interfaces.
- [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem): +8,726 weekly stars; persistent cross-session context is in high demand.
- [Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios): +6,018 weekly stars; a large agent/skill studio pattern.
- [stablyai/orca](https://github.com/stablyai/orca), [deeplethe/sandstorm](https://github.com/deeplethe/sandstorm), [paperclipai/paperclip](https://github.com/paperclipai/paperclip), and [deepseek-ai/dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype) show demand for agent fleet orchestration, cheap sandbox lifecycle, and proactive repository agents.
- Popularity is not proof of reliability, security or license compatibility. Benchmark and audit dependencies before adopting them.

### Reddit practitioner evidence (anecdotal)
- [Verification is now the bottleneck](https://www.reddit.com/r/devsecops/comments/1vzbpln/coding_agents_shifted_the_bottleneck_to/): a practitioner describes integration bugs that survive ordinary CI and adds failure-scenario sandbox runs before release.
- [Multi-agent output is hard to verify](https://www.reddit.com/r/AI_Agents/comments/1tx24s8/i_keep_abandoning_multiagent_setups_because_i/): a practitioner reports that many PRs and green CI still do not establish that real user flows work.
These are field reports, not controlled studies. They reinforce testing real workflows, not just compilation and unit checks.

### Additional high-risk/high-upside hypotheses
1. **Autonomy Thermostat:** each agent receives a bounded capability/risk budget. Unexplained writes, evidence debt, interface drift and collision density reduce its permitted autonomy; independently verified objective progress restores it. This turns trust from a static role label into a measured, reversible control.
2. **Counterfactual Incident Compiler:** convert each operator-approved incident into a minimized replay capsule, fault-injection variants and regression tests; replay only in isolated fixtures, never live integrations.
3. **Causal Credit Ledger:** attribute agent contribution by verified objective delta and downstream regression outcomes, not commits, lines changed, tokens or self-reported completion.
4. **Adaptive Swarm Topology:** choose serial, peer-aware two-agent, or isolated multi-agent execution from interface coupling, resource overlap and historical interference. Add agents only when measured marginal value exceeds collision and coordination cost.
5. **Epistemic Quorum:** high-impact beliefs require independent evidence origins plus an independent verifier; multiple agents repeating the same source do not count as corroboration.
6. **Evidence-Debt Interest:** unverified claims acquire dependency-weighted cost and expiry; a claim used by many downstream decisions becomes more urgent to verify or quarantine.

These are research hypotheses, not claims of global novelty. The literature and trending repositories already cover adjacent ideas such as agent observability, persistent memory, skills, orchestration, sandboxing and peer coordination. The differentiated work must be demonstrated through reproducible benchmarks, decision-level ablations and a systematic prior-art review.
