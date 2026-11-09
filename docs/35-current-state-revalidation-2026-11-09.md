# Current-State Revalidation — 2026-11-09

**Repository:** BRIDGE-ALLAH/MOONWITNESS  
**Branch:** main  
**Verified HEAD:** \`61116894d23ea2682b4ca8ba0ae3e3fb19cb4cf4\`  
**Snapshot time:** 2026-11-09 10:30 UTC (17:30 WIB)  
**Purpose:** Replace the stale snapshot below with current merge, CI and dependency evidence. This is a source-backed code-state report; it is not a production-readiness claim.

## 1. Repository and workspace

Repository metadata confirms the default branch is \`main\`. The pnpm workspace uses Node.js \`>=22\`; ARSY is the canonical Fastify/API authority, Headquarter is the operator-facing Next.js surface, ATLAS owns its DNS/observability control-plane boundaries, AEGIS provides a separately bounded network runtime, and COCKPIT is the Tauri 2/Rust desktop application.

Workspace existence and a successful build do not establish that every named product has a production service, deployed endpoint, credentials, operator runbook or data plane.

## 2. Exact-main CI evidence

The verified main HEAD is \`61116894d23ea2682b4ca8ba0ae3e3fb19cb4cf4\`, the squash merge of Aftershock PR #274 after payout PR #273.

Exact-HEAD workflows were created on 2026-11-09:
- Repository CI: [run 42601217464](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42601217464)
- ATLAS CI: [run 42601217516](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42601217516)
- CodeQL: [run 42601217530](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42601217530)
- Money Maker PostgreSQL Browser E2E: [run 42601217466](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42601217466)
- ARSY PostgreSQL Integration: [run 42601217453](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42601217453)

At snapshot capture the ARSY PostgreSQL integration run was successful; Repository CI, ATLAS, CodeQL and browser E2E were still running. Re-fetch workflow state before using this snapshot as current green-main proof. PR exact-head evidence is listed with the corresponding delivered capability below.

CI success does not prove production deployment, live service health, external provider accuracy, manual accessibility or production data correctness.

## 3. Release and version state

- Root package version remains \`1.2.0\`.
- GitHub Release \`v1.2.0\` is a pre-release; it is not the stable production release.
- Stable release and production promotion remain separate maintainer decisions gated by the operational evidence in Section 7.

## 4. Delivered mainline product capabilities

The following capabilities are present on main through merged PRs:

- **Money Maker commerce backend** — opportunity, product, asset, channel, listing, financial-event, payout and FX persistence/workflow foundations were consolidated through #256 and subsequent PRs. Main includes source evidence, idempotency, ownership boundaries and server-side policies; these are not automatic marketplace integrations.
- **Product version and lifecycle controls** — #268 added persisted immutable versions, optimistic concurrency and server-authoritative lifecycle transitions, with PostgreSQL and browser acceptance. Stale PR #267 was closed as superseded by #268.
- **MIZAN / payout ledger time semantics** — #273 distinguishes source event \`occurredAt\` from database \`recordedAt\`, stores both in payout history, orders the operator audit timeline by recorded time, and uses source occurrence time for paid/reversal ledger events. It adds PostgreSQL coverage for paid → disputed → reversed and failed → disputed → failed, including the rule that a failed payout creates no cash-movement event.
- **AFTERSHOCK metric contracts** — #274 enforces UTC half-open \`[from,to)\` cohort windows and applies the exclusive outcome cutoff to linked-product promotion, listing publication, verified first sale and audited retirement. Responses include numerator/denominator definitions, freshness and unavailable-source disclosure. The PostgreSQL fixture proves future publication/sale events do not leak into a closed reporting window. Exposure-to-opportunity and support-burden metrics remain unavailable without real source workflows.
- **Skin Engine** — #257/#259/#262 provide the typed foundation, route-aware integration and token parity.
- **Deployment intent/read API** — #227 is merged and registers authenticated, owner-scoped deployment create/list/read routes. Its transaction records operation, authorization evidence and outbox state atomically. The worker remains disabled; this is an API slice, not an end-to-end deployer.
- **Rootless BuildKit proof** — #243 adds a bounded disposable-VM proof using pinned BuildKit/RootlessKit versions and adversarial checks. It does not supply a production VM provider, credential broker, egress controls, cross-tenant cache isolation, registry push/signing or ARSY Build Engine adapter.
- **Production container delivery workflow** — #272 builds non-root ARSY, Headquarter and AEGIS image candidates and adds scan/SBOM/provenance/attestation gates. It is not a production deployment or evidence that images have been published to a production registry.

The independent Headquarter MIZAN operator surface is under review in [PR #275](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/275). It adds evidence-backed financial event capture/reconciliation, manual payout registration/status transition and exact rational FX capture, plus real PostgreSQL/browser E2E. It is not part of main until merged.

## 5. Remaining constraints and dependencies

### Money Maker / MIZAN — Issues #121 and #100

Main now has persisted multi-currency financial events, payout lifecycle, exact rational FX conversion provenance and source-separated totals. #273 strengthens payout chronology. PR #275 adds the operator UI and browser workflow.

Still not implemented: official provider adapters/webhooks, automated external statement ingestion, provider synchronization, production provider credentials and automated cash transfer. Manual evidence review remains the supported mode. Do not infer revenue or payout from a pending record or combine currency amounts without a sourced conversion.

### AFTERSHOCK — Issue #122

The merged metric contract covers only events with real persisted source records. There is no trusted impression/exposure feed or persisted support-case workflow, so exposure conversion and support burden must remain unavailable. Learning recommendations remain advisory and require human authorization for lifecycle actions.

### Deployment platform — Issues #182–#187

- **#182 / ADR 0003:** rootless BuildKit adversarial proof #243 is merged, but ADR 0003 remains proposed. Missing production boundaries include default-deny egress and DNS-rebinding controls, short-lived secret/registry credential broker, real tenant/cache isolation at worker boundary, registry push and image-signing/independent receipt verification, and operational worker provisioning/recovery.
- **#183:** production isolated source-to-OCI Build Engine implementation remains blocked by the unaccepted ADR and missing production provider/credential/evidence boundaries.
- **#184:** merged #227 provides the owner-scoped intent/read API and transactional authorization/outbox record. No deployment-specific handler, bounded worker entrypoint, Build Engine invocation, Docker adapter receipt, crash recovery/reconciliation or end-to-end deployment PostgreSQL/Docker acceptance exists.
- **#185:** health reconciliation and audited rollback remain blocked until #184 produces a verifiable deployment lifecycle.
- **#186:** Headquarter deployment BFF/operator UI remains blocked until #184/#185 expose stable state and health/rollback contracts.
- **#187 / ADR 0004:** ingress/domain/TLS remains a proposal; Caddy 2 is a candidate, not an accepted provider. No public route, DNS mutation, certificate issuance, private-key store or production ingress is enabled.

The read-only Docker Connector remains separate from the internal workload mutation adapter. Do not expose Docker sockets or credentials to the browser, ATLAS or AEGIS.

## 6. Current PR / issue hygiene

- #273 and #274 are merged to main.
- #275 is the active MIZAN Headquarter operator PR, now based directly on main with a four-file UI/test diff. Its exact-head CI must pass before merge.
- #267 is closed unmerged as superseded by #268.
- #182, #183, #184, #185, #186 and #187 remain open with the dependency limits above; a merged proof or API proposal does not close a parent issue.

Other long-lived PRs must be independently revalidated by current head SHA, base SHA, mergeability, review state and exact-head checks. Do not merge stale stacked ORM/design/deployment branches based on historic green runs.

## 7. Production decision

**PRODUCTION RELEASE: NO-GO.**

There is still no verified production target, accepted ingress/TLS implementation, managed secret injection/rotation, persistent asset/object storage and restore drill, production monitoring/alerting, rollback authority, or verified production URL and smoke-test evidence. The container-delivery workflow is not an automatic release.

Do not deploy the development Compose stack as production or promote \`v1.2.0\` to stable solely because code CI passes. No production credentials, live infrastructure or production database should be mutated by these implementation PRs.

## 8. Verification boundary

This snapshot uses current GitHub repository files, issue/PR states, merge commits and exact-head GitHub Actions records. Local package installation, local lint/typecheck/build, manual browser/accessibility verification and production smoke tests were not run in this GitHub-only execution. CI results are cited as CI results, not represented as local execution.

No production deployment, DNS change, certificate issuance, registry publication, stable release or production database mutation was performed.
