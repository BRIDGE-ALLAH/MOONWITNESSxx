# ADR 0002 — Docker Workload and Deployment Ownership

**Status:** Proposed for maintainer review; not an implementation authorization  
**Date:** 2026-11-08  
**Decision scope:** Docker application workloads, image builds, deployment lifecycle, and their relationship to ARSY, ATLAS, AEGIS, and HEADQUARTER  
**Related:** [ADR 0001 — ATLAS PostgreSQL Storage](./0001-atlas-postgresql-storage.md), [Docker Connector](../29-docker-connector.md), [Platform Capability Ownership Map](../33-platform-capability-ownership-and-dependency-map.md), [Universe & Product Architecture Registry](../32-universe-and-product-architecture-registry.md)

## 1. Context

MOONWITNESS has a working, authenticated, owner-scoped Docker Engine connector in ARSY and HEADQUARTER. Its current scope is deliberately read-only: register a local or verified remote Engine, inspect Engine information, list containers, and read a bounded log tail.

The repository does not yet have a complete application PaaS or a verified production deployment lifecycle. There is no accepted mainline implementation for Git-based builds, image publication, application deployment, deployment history, rollback, ingress/TLS lifecycle, or continuous workload recovery.

The platform identities have separate responsibilities:

- ARSY is the application control-plane authority for identity, authorization, policy, approval, orchestration, API contracts, and canonical audit.
- ATLAS manages infrastructure inventory/configuration/reconciliation for its DNS, RADIUS, and observability domains.
- AEGIS is intended to execute narrowly scoped network-infrastructure operations behind authenticated internal contracts.
- HEADQUARTER is the operator-facing interface and must not access Docker credentials or sockets directly.
- Docker Engine and other infrastructure engines remain the execution/data-plane systems.

Without an explicit decision, Docker deployment work could be implemented independently in ARSY, ATLAS, AEGIS, a generic worker, and Headquarter. That would create duplicate authorities, credentials, state machines, and side effects.

## 2. Decision proposed

### 2.1 One application deployment control plane

ARSY remains the sole control-plane authority for application deployment intent and lifecycle state.

ARSY owns:
- authenticated request intake and caller identity;
- authorization, policy evaluation, approval and scope enforcement;
- canonical desired deployment state and deployment identity;
- durable job coordination, idempotency, retry/cancellation policy and execution audit;
- versioned internal contracts and result reconciliation;
- deployment history, observed state, terminal outcome and rollback authorization.

No other component may independently accept user deployment intent or become a second source of canonical deployment state.

### 2.2 One Docker workload execution boundary

The existing Docker Connector remains a separate **read-only inspection capability**. It must not silently grow mutating operations inside its current read-only API surface.

For the first application-PaaS implementation, introduce a distinct, narrowly scoped **Docker Workload Adapter** behind an ARSY-owned interface. The adapter is the only component authorized to perform Docker workload mutations for that deployment path.

The initial implementation may live inside the ARSY application process as an isolated module with a narrow interface. It must not be a second HTTP control plane, and it must not expose an arbitrary Docker API proxy.

The adapter owns only provider translation and execution mechanics, such as:
- resolve the selected, authorized Docker host;
- pull or create an image/container from an approved deployment request;
- apply declared container, network, volume and resource settings;
- start, stop, replace or remove only resources bound to an authorized deployment;
- return bounded, typed execution receipts and observed runtime state.

It does **not** own user identity, policy, approval, canonical deployment history, business lifecycle, secret authorization, or general job semantics.

A future extraction into a separate Docker executor service or per-host agent requires a new reviewed ADR. Do not create a separate service merely to move code into another process.

### 2.3 One Build Engine boundary

Image construction is a separate capability from container execution.

A future Build Engine owns:
- Git source checkout from an explicitly authorized repository/branch/commit;
- Dockerfile and explicitly supported buildpack/Compose build modes;
- isolated build context and filesystem/network policy;
- build cache, build logs and build provenance;
- image tagging and publication to an explicitly configured registry;
- a verifiable image digest and build receipt.

It does not own deployment authorization, target selection policy, runtime lifecycle, user sessions, or canonical deployment history.

The Build Engine must not execute untrusted repository build scripts with ARSY's Docker socket or control-plane secrets. Build isolation, credential scope, outbound network policy and cleanup are release-blocking design requirements.

### 2.4 Boundaries with ATLAS and AEGIS

- ATLAS does not manage application containers, Docker sockets, Compose application deployment, image builds or workload rollback. Its observability role is engine configuration/inventory/operations for the adopted metrics and log systems, not replacement of those storage/query engines.
- AEGIS does not become a generic Docker executor or application deployment manager. Its scope remains network infrastructure execution (for example, a later authenticated WireGuard/RouterOS/firewall operation) behind a bounded command contract.
- ARSY may coordinate an approved deployment that needs DNS or network changes, but those effects must go through the owning service: ATLAS for DNS/observability configuration and AEGIS for its approved network execution. Neither receives ARSY's general authority.
- External engines remain responsible for their own protocol/runtime behavior.

### 2.5 HEADQUARTER boundary

HEADQUARTER:
- displays deployment intent, status, evidence, build/deploy logs and health state returned by ARSY;
- submits user actions through session-protected same-origin routes and versioned ARSY contracts;
- displays explicit loading, empty, failed, blocked, stale, partial and recovering states;
- never holds Docker socket access, remote Docker TLS private keys, registry credentials or direct database credentials;
- never duplicates deployment state transitions or approval rules in frontend code.

## 3. Target interaction flow

The proposed flow is:

1. An authenticated operator submits a deployment intent in HEADQUARTER.
2. HEADQUARTER forwards the request through its server-side BFF to ARSY.
3. ARSY validates the contract, caller, workspace/target scope, policy and approval requirement.
4. ARSY persists the intent and an idempotent execution record before dispatch.
5. The Build Engine, when needed, builds and publishes an immutable image digest in an isolated environment.
6. The Docker Workload Adapter applies the deployment to the selected authorized host.
7. ARSY verifies observed container state and configured health checks, then records a deployment receipt.
8. If verification fails, ARSY follows the configured failure policy: preserve the prior healthy release, stop promotion, and execute only an explicitly authorized rollback/compensation.
9. HEADQUARTER reads the resulting canonical state and its evidence from ARSY.

The control plane is not in the application's request/data path. A restart of ARSY, HEADQUARTER, or a build worker must not silently destroy running workloads or lose committed deployment records. Recovery must be based on durable state and observed infrastructure state.

## 4. Security and safety constraints

1. **Docker socket:** a local Docker socket is host-root-equivalent. Its use requires an explicit trusted-host opt-in, dedicated least-privilege deployment boundary, network isolation, and audit. Never mount it into HEADQUARTER or an untrusted build container.
2. **Remote Docker:** preserve the current HTTPS/mTLS, exact-host allowlist, certificate validation, DNS/address validation and no-arbitrary-proxy rules. Mutating operations require a separate authorization review and bounded operation allowlist.
3. **Build isolation:** source code and build instructions are untrusted input. Build credentials must be short-lived and limited to the required registry/repository. Do not pass ARSY operator tokens or general infrastructure secrets into a build.
4. **Secrets:** secrets are references resolved by an authorized server-side secret provider. Never write plaintext values into deployment metadata, image layers, logs, build output, environment snapshots or audit diffs.
5. **Durability:** persist job intent, idempotency, target, immutable source/image identity, state transitions and execution receipts. Queue delivery is not business truth.
6. **Idempotency:** repeat requests must not create duplicate deployments or duplicate destructive effects. Use stable operation keys and reconcile ambiguous provider outcomes before retrying.
7. **Persistent data:** deployment replacement must not delete named persistent volumes, databases or user data by default. Destructive storage actions require explicit scope, approval, backup evidence and recovery plan.
8. **Rollback:** rollback is a new audited deployment operation referencing the previous immutable release. It is not an assumed reversal of external side effects.
9. **Authorization:** operator login or a shared service token is not a complete multi-user RBAC system. Production deployment requires server-enforced roles/scopes, approval and trusted actor provenance.
10. **Observability:** a Docker health flag or process liveness alone is not application readiness. Record source, timestamp, target and freshness for observed status.
11. **Failure containment:** control-plane or worker failure must not be interpreted as workload success. Interrupted executions need a resumable/reconcilable state.
12. **Recovery:** backup/restore and rollback must be tested against a disposable environment before production promotion.

## 5. API and contract ownership

The following names describe **future contract boundaries**, not routes currently implemented:

| Contract surface | Owner | Purpose |
|---|---|---|
| Deployment intent and query API | ARSY | Validate, authorize, persist and expose deployment lifecycle |
| Build request and build receipt | Build Engine, invoked by ARSY | Isolated build, image digest and provenance |
| Docker workload port/adapter | ARSY platform boundary | Narrow Docker provider operations and observed runtime state |
| Approval/policy decision | ARSY with ZILL policy capability | Evaluate authorization and risk before effects |
| DNS/observability configuration | ATLAS | Own its infrastructure configuration domains |
| Network operation command/receipt | AEGIS | Execute only explicitly delegated network operations |
| Operator UI/BFF routes | HEADQUARTER | Session-protected UI transport to ARSY |

Do not add public routes, database tables, job names, or methods under these proposed names until their owning contracts, persistence and authorization are reviewed.

## 6. Alternatives considered

### A. Let ATLAS own all Docker and application deployment

**Rejected.** It conflicts with ATLAS's DNS/RADIUS/observability control-plane scope, makes ATLAS a second application orchestrator, and grants it unrelated workload authority.

### B. Let AEGIS own all Docker deployment

**Rejected.** AEGIS is a bounded infrastructure executor, not the identity, approval, policy or canonical deployment-state authority. General application deployment would broaden its security scope beyond its charter.

### C. Let HEADQUARTER call Docker directly

**Rejected.** It would expose infrastructure credentials and bypass the server-side authorization, policy and audit boundary.

### D. Add unrestricted Docker mutation methods to the existing read-only connector

**Rejected as an implicit change.** Inspection and destructive execution have different threat models and acceptance criteria. A future implementation may reuse validated connection primitives internally, but must preserve separate read-only and mutation contracts, authorization and audit.

### E. Create a separate Docker executor service immediately

**Deferred.** It may become justified for host isolation, independent scaling, remote-agent lifecycle or a stronger privilege boundary. It adds a new service identity, protocol, secret distribution and failure mode. Start with a well-defined ARSY-owned port and isolate execution behind it; extract only after evidence demonstrates the need.

## 7. Consequences

Positive:
- One authoritative deployment lifecycle and one place to enforce authorization/approval.
- One Docker workload mutation boundary rather than multiple competing Docker clients.
- Build execution can be hardened independently from runtime deployment.
- ATLAS and AEGIS keep their existing domain boundaries.
- HEADQUARTER remains an operator experience rather than an infrastructure authority.
- The architecture permits a future executor service without requiring it now.

Costs and constraints:
- ARSY needs explicit internal ports and durable orchestration state.
- The Build Engine needs an isolated execution environment and registry credential lifecycle.
- Mutating Docker operations require a separate threat model and test suite; read-only connector checks are not sufficient.
- Production readiness will require durable recovery, RBAC/approval, observability, backups, rollback, target-specific tests and operational ownership.

## 8. Implementation is not yet authorized by this proposal

This ADR is proposed for review. Until it is accepted:
- keep the current Docker Connector read-only;
- do not add start/stop/restart/remove/exec/Compose routes;
- do not grant Docker access to ATLAS or AEGIS;
- do not create a second deployment service or queue implementation;
- do not claim Coolify parity or production readiness.

After acceptance, create a small dependency-ordered issue set against the current mainline and existing issues. Each issue must name one owning component, exact allowed paths/interfaces, explicit non-goals, dependencies, and executable acceptance criteria.
