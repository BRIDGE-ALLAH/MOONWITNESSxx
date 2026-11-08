# Phase 14–16 Research Notes

**Reviewed:** 2026-11-08. This is a focused design scan, not an exhaustive systematic review and not proof of global novelty.

## Research signals

- **Auditable Agents** (arXiv:2604.05485): frames action recoverability, lifecycle coverage, policy checkability, responsibility attribution, and evidence integrity as complementary auditability dimensions. This motivates connecting belief changes to evidence loss and downstream effects rather than relying on generic logs. https://arxiv.org/abs/2604.05485
- **Cryptographically verifiable authorization for autonomous AI agents** (Frontiers in Computer Science, 2026): proposes request-bound authorization evidence and identifies principal, request, policy, and execution-context binding as distinct problems. The current Sentinel Fabric deliberately does not claim to solve cryptographic authorization. https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2026.1966725/full
- **LATTICE: a governance-first architecture for authorized autonomous AI operations** (Frontiers in AI, 2026): separates planning, governance, and execution and reports its own benchmark results under stated assumptions. This supports keeping these engines outside the action executor and treating results as review inputs. https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2026.1800407/full
- **Runtime Governance for Agentic AI: Action-Boundary Control with Trusted Provenance and Fail-Closed Execution** (arXiv:2608.16891): argues for mediation at action boundaries rather than relying on prompt-level policy. Sentinel Fabric is pre-execution analysis only, not that enforcement boundary. https://arxiv.org/abs/2608.16891
- **Compliance-as-Code for AI-Driven Identity Systems** (IEEE Access, DOI 10.1109/ACCESS.2026.3665991): demonstrates clause-to-control traceability and machine-readable evidence gaps; this informs expiry budgets and explicit invalid states. https://doi.org/10.1109/ACCESS.2026.3665991

## Open-source ecosystem scan

- **Justin0504/Aegis**: pre-execution policy checking, signed decision receipts, hash-chained audit traces, and reproducible evaluations. Useful comparator for the future ARSY action gateway; avoid rebuilding a generic wrapper before defining ARSY's contracts. https://github.com/Justin0504/Aegis
- **calboreanu/LATTICE**: published governance engine associated with the LATTICE architecture. Inspect its license, threat model, and exact trust assumptions before considering reuse. https://github.com/calboreanu/LATTICE
- **awesome-auditable-ai**: curated index of audit, enforcement, and recovery tools; useful for ongoing ecosystem discovery rather than a runtime dependency. https://github.com/yzhao062/awesome-auditable-ai

## Community signals (Reddit; anecdotal, not empirical evidence)

- r/LocalLLaMA discussions report that observability is common while compliance-grade auditability, enforceable financial controls, and structural human oversight remain gaps. https://www.reddit.com/r/LocalLLaMA/comments/1rw8h40/observations_from_analyzing_ai_agent_and_workflow/
- r/ollama practitioners describe fragmented cost attribution, silent data leakage, and missing replayable audit trails as operational pain points. https://www.reddit.com/r/ollama/comments/1qg9pek/d_validate_production_genai_challenges_seeking/
- r/LocalLLaMA memory discussion highlights preserving source IDs/timestamps and distinguishing "not stored" from "not retrieved"; this supports retaining raw provenance rather than allowing summaries to erase source context. https://www.reddit.com/r/LocalLLaMA/comments/1vgbi5m/
- r/LangChain discussions emphasize that tool execution often needs a pre-execution risk boundary, not only post-hoc logs. https://www.reddit.com/r/LangChain/comments/1t1ks0h/how_are_you_handling-risk-before-execution-in/

## Novelty hypothesis and experiments

The candidate differentiator is a **temporal evidence-to-impact fabric**: belief drift → evidence expiry → causal blast radius → replay capsule → human review. This composition may be useful, but individual ingredients and related governance systems already exist. Do not claim "never built before" without a prior-art search and comparative benchmark.

Proposed falsifiable experiments:
1. Measure drift precision/recall against human-labelled belief revisions.
2. Measure expiry warning lead-time and false-alert rate across evidence classes.
3. Compare blast-radius ranking with incident postmortem impact maps; report top-k recall and rank correlation.
4. Test replay consistency after evidence updates and schema migrations.
5. Run adversarial tests for missing provenance, timestamp skew, graph cycles, duplicated IDs, and stale source references.
6. Measure reviewer time-to-understand versus a conventional event log.

## Further high-risk/high-reward ideas (not implemented)
- **Evidence Half-Life Market:** learn per-source expiry distributions from verified outcomes; never change legal validity dates, only recommend review cadence.
- **Causal Quarantine Switch:** quarantine a decision branch when a root evidence item is revoked; ARSY must enforce the switch server-side.
- **Proof-Carrying Change Proposal:** package exact diff, authority, policy version, evidence refs, replay digest, and rollback plan before any consequential write.
- **Epistemic Firewall for Delegated Agents:** propagate source trust labels and capability scopes across agent-to-agent handoffs; reject authority escalation.
