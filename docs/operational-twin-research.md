# MOONWITNESS Operational Twin — Research Notes and Product Opportunities

**Status:** research synthesis and design proposal. The ideas below are not claims of global novelty; a comprehensive prior-art and patent search would be needed before making that claim.

## Findings from research and community practice

1. **Self-healing must include a decision not to act.** The 2026 preprint *Safe Remediation as Risk-Constrained Intervention Decision in Microservice Systems* models blast radius, irreversibility, and uncertainty, with a human-in-the-loop gate. Its central lesson is that repair success is not enough; false remediation has a measurable cost.
2. **Cross-platform remediation needs observability and policy boundaries.** The 2026 CROSS paper combines log-driven detection, platform-specific remediation, and telemetry across heterogeneous operating systems. It also acknowledges that operational anomaly evaluation is not the same as adversarial security validation.
3. **AI self-healing still has a validation gap.** The 2026 systematic review of 99 studies highlights the move from monitoring to agentic repair, but stresses uncertainty, privacy, validation, and human oversight.
4. **Provenance is a chain, not a package inventory.** SLSA provenance records where, when, and how artifacts were built, including resolved dependencies. A runtime environment should preserve evidence linking source, lockfile, build inputs, artifact, and deployment.
5. **Developer bootstrap tools should be idempotent and respect tool-version boundaries.** A Reddit discussion about fresh-machine setup highlights architecture detection, repeatable runs, and the downside of installing global tools at versions that differ from the project pin.
6. **Self-hosting operators repeatedly ask for health checks, configurable databases, installer scripts, restore documentation, immutable image references, and deployment tests.** A Reddit self-hosting discussion emphasizes that backup success is not restore proof and recommends validating the actual restored data.
7. **Open-source direction:** `cachix/devenv` demonstrates declarative/reproducible developer environments; recent DevOps trend listings include agentic operations, internal developer platforms, drift discovery, and self-hosted PaaS. These are useful reference points, not dependencies MOONWITNESS must adopt.

## Proposed product: Operational Twin + Change Capsule

The implemented first slice is `pnpm runtime:passport`. It captures a privacy-safe, machine-readable snapshot of the local runtime without persisting secrets.

Next extensions:

### A. Environment Drift Radar
Compare passports from developer machines, CI, staging, and production. Report only meaningful differences: lockfile digest, toolchain, architecture, Compose config digest, missing variables (names only), and service readiness. This turns "works on my machine" into a diffable evidence object.

### B. Change Capsule
Before an install, upgrade, migration, or deployment, create a signed/hashed capsule containing:
- pre-change passport and artifact provenance;
- requested change and exact inputs;
- blast-radius, irreversibility, and uncertainty scores;
- required approvals and preconditions;
- expected health signals and recovery route;
- post-change passport and verification evidence.

The capsule is an audit record, not a rollback guarantee. Data migrations and external side effects require their own recovery strategy.

### C. Resilience Budget Gate
Classify interventions using three bounded dimensions (0–3): blast radius, irreversibility, and uncertainty. Low scores permit deterministic preflight only; medium scores require human approval; high scores are blocked pending explicit review. The first deterministic scoring helper is implemented in `scripts/runtime.mjs`; no automatic remediation is enabled.

### D. Shadow Restore Lab
Periodically restore a backup into a disposable isolated environment, then validate application invariants (row counts, newest business event, relationships, auth, and attachments). Record a restore passport. Never run restore drills against production data or overwrite the source backup.

### E. Dependency Quarantine Replay
When a dependency update is proposed, build the previous and candidate lockfile in isolated workspaces, run the same contract tests and service probes, compare behavior and resource profiles, then attach the evidence to the dependency PR.

### F. Explainable Recovery Graph
Represent service dependencies and recovery actions as a directed graph with preconditions, idempotency, blast radius, reversibility, and proof of success. Agents may propose actions, but only deterministic allowlisted runbooks execute; architecture/data/security/deployment changes require approval.

## Suggested architecture

- **Evidence plane:** runtime passport, SLSA provenance, SBOM, test/health evidence.
- **State plane:** append-only change capsules and drift snapshots.
- **Policy plane:** deterministic rules and risk budget; no model-generated policy.
- **Execution plane:** allowlisted idempotent runbooks with bounded retries and timeouts.
- **Approval plane:** human approval for high-risk actions, with identity and expiry.
- **Recovery plane:** preflight, snapshots, restore drills, canary health, and explicit rollback boundaries.

## Research and implementation references

- Dai et al., *Safe Remediation as Risk-Constrained Intervention Decision in Microservice Systems* (2026): https://www.alphaxiv.org/abs/2607.20005
- Johnphill et al., *Cross: a cloud-native approach to automated remediation and self-healing in cyber-physical systems* (2026): https://doi.org/10.1186/s42400-026-00549-8
- *AI-driven self-healing across the edge–cloud continuum: A systematic literature review* (2026): https://doi.org/10.1016/j.infsof.2026.108232
- Google, *Securing the AI Software Supply Chain* (2024): https://research.google/pubs/securing-the-ai-software-supply-chain/
- SLSA Build Provenance specification: https://slsa.dev/spec/v1.1/provenance
- devenv: https://github.com/cachix/devenv
- SafeDeploy (pre-change validation and rollback research example): https://github.com/ydarwish1/safedeploy
- Reddit, fresh developer-machine setup and global-tool versioning: https://www.reddit.com/r/devops/comments/1qz5itd/i_wrote_a_script_to_automate_setting_up_a_fresh/
- Reddit, self-hosting health, backup/restore, installer, and immutable artifact practices: https://www.reddit.com/r/selfhosted/comments/1tiy4uk/more_selfhosting_best_practices_for_devs/
- DevOps trending project discovery: https://hotrepo.ai/topics/devops

## What is actually implemented now

- Cross-platform launchers over a single Node CLI.
- Frozen-lockfile profile installs, dry-run, offline mode, doctor, repair, update, verify, safe uninstall.
- Environment template is copied only when absent.
- Runtime doctor, Compose preflight, service health report, privacy-safe runtime passport.
- ARSY liveness/readiness probes and graceful Fastify shutdown.
- No automatic migrations, production deployment, rollback, AI repair, or secret management.
