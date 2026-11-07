# 29 — AEGIS: MOONWITNESS Network Infrastructure Blueprint

**Status:** Phase 1 foundation approved for implementation  
**Owner:** `apps/aegis`  
**Runtime:** Go  
**Product family:** MOONWITNESS Infrastructure  
**Issue:** [#151](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/151)

## 1. Product narrative

MOONWITNESS observes, verifies, connects, understands, and shares with care. AEGIS extends that promise into the infrastructure that carries those connections.

**AEGIS is the network infrastructure runtime of MOONWITNESS.** It is designed to make connectivity and network operations controlled, inspectable, and accountable: a dependable execution layer for approved infrastructure changes, not an autonomous authority that decides what should happen.

Its product promise is:

> Secure connections. Controlled infrastructure. Observable operations.

AEGIS is named for the protective-shield idea. This is a product metaphor for the MOONWITNESS protection responsibility; it does not imply absolute security, invulnerability, or spiritual authority.

## 2. Why it exists

MOONWITNESS needs a coherent way to connect and operate infrastructure across cloud servers, gateways, routers, and private networks without scattering vendor-specific commands through unrelated applications.

AEGIS provides one bounded place for network-specific execution and adapters. It should reduce operational fragmentation while preserving evidence, least privilege, reversibility, and human accountability.

The system begins with a small, honest runtime. It must not claim to provide VPN, SD-WAN, zero-trust access, router management, or firewall automation until those capabilities have real implementations and integration tests.

## 3. Position in the ecosystem

| Component | Authority and responsibility |
|---|---|
| Headquarter | Human-facing operations and approvals; calls ARSY only |
| ARSY | Sole backend/control-plane authority: identity, tenant context, policy decisions, orchestration, audit, and AEGIS command authorization |
| AEGIS | Network execution runtime: infrastructure adapters, connectivity lifecycle, desired/observed network state, execution receipts |
| Existing observation/security components | Retain their current monitoring, authentication, RADIUS, and security-observation responsibilities |
| Network providers/devices | External systems controlled only through explicit, tested adapters |

**No competing control plane:** AEGIS does not own users, sessions, tenants, billing, global policy, approval workflow, or the canonical audit ledger. It must not create a second identity system or expose an operator-facing public API.

The intended flow is:

```text
Human operator
     |
Headquarter
     |
     v
    ARSY  <---- identity, policy, approval, orchestration, audit
     |
     | authenticated, scoped command (future phase)
     v
   AEGIS  ----> network adapters ----> approved infrastructure
     |
     +------ execution result / evidence ------> ARSY
```

Phase 1 does not implement the ARSY-AEGIS command protocol. Only health endpoints are exposed.

## 4. Responsibility and non-goals

### AEGIS owns

- Network-provider adapter boundaries and their lifecycle.
- Normalized network inventory and connectivity state projections.
- Execution of explicitly authorized network operations.
- Provider-specific error normalization and operation receipts.
- Safe reconciliation primitives: plan, validate, apply, verify, report.
- Operational health of the AEGIS process and its own adapters.

### AEGIS does not own

- Authentication, authorization policy, tenant membership, or human approval.
- Global workflow orchestration, audit authority, or business records.
- A replacement for ARSY, Headquarter, or existing RADIUS/monitoring components.
- A bespoke VPN protocol or a forked WireGuard implementation.
- Arbitrary SSH/shell execution exposed over HTTP.
- Unreviewed firewall, routing, DNS, NAT, or host-network changes.
- A production deployment topology in this initial phase.

## 5. Architectural principles

1. **ARSY-authorized execution:** AEGIS accepts future operational commands only from authenticated ARSY service identity, with explicit scope and expiry.
2. **Least privilege:** Separate read-only discovery from mutation. Grant only the OS capabilities and provider permissions an adapter needs.
3. **Plan before apply:** Every meaningful change has a deterministic plan, validation, approval reference, apply result, and post-change verification.
4. **Evidence over assertion:** Preserve provider response, normalized result, timestamps, correlation IDs, actor/approval references, and before/after state where available.
5. **Idempotency and concurrency control:** Mutations use idempotency keys, resource locks, version/precondition checks, and bounded retries.
6. **Human accountability:** Destructive, broad-impact, or externally visible actions require explicit approval through ARSY.
7. **Provider neutrality:** Domain contracts must not leak Netmaker, RouterOS, WireGuard, or cloud-provider types.
8. **Fail closed:** Missing authorization, stale plans, unknown provider state, or failed verification must not silently become success.
9. **No false readiness:** Process readiness is distinct from adapter, tunnel, router, and end-to-end connectivity health.

## 6. Target architecture

The Go application should evolve as a modular monolith before any service decomposition:

- **Transport:** private HTTP API, request validation, correlation IDs, health.
- **Application:** command handlers, use cases, authorization context verification, idempotency.
- **Domain:** network resources, connectivity intents, policies, operation plans and receipts.
- **Ports:** provider-neutral interfaces for inventory, connectivity, routing, firewall, and device management.
- **Adapters:** separately tested integrations for selected network engines and device vendors.
- **Runtime:** configuration, structured logging, metrics, lifecycle, bounded workers and shutdown.

No package may call a provider directly from an HTTP handler. No adapter may bypass the application policy boundary. No provider SDK type may leak through the domain API.

## 7. Provider strategy

Do not build a VPN engine from scratch. Evaluate mature, maintained providers behind adapters.

- **WireGuard:** candidate tunnel technology, not a complete management/control plane by itself.
- **Netmaker:** candidate network orchestration/control plane for WireGuard-based mesh use cases; verify current API, licensing, deployment model, and feature fit before adoption.
- **MikroTik RouterOS:** candidate device adapter through its supported API; begin read-only and require explicit approval for mutations.
- **Linux networking:** candidate host adapter for routes and firewall primitives, isolated behind narrow interfaces and least-privilege execution.

These are candidates, not dependencies of Phase 1. The first provider is selected only after a spike compares operational fit, API stability, license obligations, upgrade path, failure behavior, and testability. Avoid implementing overlapping control planes.

## 8. Security and trust model

- Bind the local development server to the Compose network; publish only to loopback for local debugging.
- Production transport must use a private network and authenticated service-to-service identity, with TLS or a verified workload identity mechanism.
- Authorization decisions remain in ARSY. AEGIS validates the signed/scoped command envelope and rejects expired, replayed, or out-of-scope requests.
- Provider credentials are injected at runtime through a secret manager; never committed, baked into images, returned by APIs, or logged.
- Separate read-only and mutating credentials where supported.
- Never run the container privileged by default, mount the Docker socket, or share the host network namespace.
- Do not expose raw shell, arbitrary scripts, generic proxying, or arbitrary provider API passthrough.
- Audit records are returned to ARSY with correlation and approval references; ARSY remains the canonical audit owner.
- Threat-model SSRF, credential exfiltration, replay, confused deputy, tenant/resource crossover, command injection, unsafe retries, and partial provider failure before enabling mutations.

## 9. Delivery roadmap

| Phase | Outcome | Exit evidence |
|---|---|---|
| 1 — Runtime foundation | Go app, configuration, health, graceful shutdown, tests, Docker, Compose, docs | Reproducible build/test; Compose config and container health verified |
| 2 — Control contract | ARSY service identity, signed/scoped command envelope, correlation, idempotency, audit receipt | Contract tests, replay/expiry/tenant-isolation tests, security review |
| 3 — Inventory and read-only adapters | Network/gateway/device inventory and observed state | Provider contract suite, fixtures, live sandbox verification |
| 4 — Connectivity orchestration | Approved connectivity intent and lifecycle through selected engine | Plan/apply/verify, rollback, failure-injection and multi-node tests |
| 5 — Router and policy adapters | RouterOS/Linux routes/firewall with explicit operation allowlists | Read-only baseline, dry-run, approval, rollback and device-lab tests |
| 6 — Operations hardening | Metrics, alerting, capacity, backup/recovery, upgrades and production deployment | SLOs, security assessment, restore and production smoke evidence |

No phase is complete by documentation alone. A capability is implemented only when source, tests, operational evidence, and truthful status are present.

## 10. Phase 1 implementation contract

The initial application exposes only:

- `GET /health/live`: process liveness.
- `GET /health/ready`: process initialization/readiness.

It does not yet connect to ARSY, databases, Netmaker, WireGuard, MikroTik, Linux networking, or any router/VPS API. The readiness response is process-level only.

Local Compose publishes `127.0.0.1:3102` and connects the container to the existing `moonwitness` bridge network. It is a development convenience, not a production network policy.

## 11. Acceptance and release gates

- Go unit tests and static checks pass.
- Docker image builds as a non-root user.
- Compose configuration validates and the container healthcheck succeeds.
- No privileged mode, host network, Docker socket, credentials, or arbitrary command endpoint.
- Root and app README accurately state capabilities and limitations.
- ARSY remains the sole backend/control-plane authority.
- Production release remains blocked until service authentication, network policy, secrets, TLS, monitoring, rollback, and live verification are designed and tested.
