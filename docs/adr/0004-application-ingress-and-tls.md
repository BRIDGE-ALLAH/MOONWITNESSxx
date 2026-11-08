# ADR 0004 — Application Ingress, Custom Domains and TLS Lifecycle

**Status:** Proposed — maintainer decision required  
**Proposal date:** 2026-11-08  
**Decision authority:** Architecture maintainers  
**Scope:** First self-hosted application ingress, domain ownership, routing, public exposure, ACME certificates and TLS key custody  
**Related:** [ADR 0002 — Docker Workload and Deployment Ownership](./0002-docker-workload-deployment-ownership.md), [Platform Capability Ownership Map](../33-platform-capability-ownership-and-dependency-map.md), Issues [#73](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/73), [#184](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/184), [#187](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/187)

> This is a decision proposal for maintainer review. It does not authorize public ingress, DNS mutation, certificate issuance, a production Compose change or deployment. The existing development Compose stack remains loopback-bound and production remains NO-GO.

## 1. Context and current truth

The current mainline has ARSY as the deployment control-plane authority and a separate Docker Workload Adapter. It does not yet provide a production application ingress, custom-domain lifecycle, automated certificate lifecycle, or a verified public exposure workflow. The current Compose file publishes the development applications on loopback; it is not a production ingress design.

Application deployment and public ingress are separate capabilities:

- ARSY owns authenticated intent, identity, authorization, approval, canonical desired state, audit and reconciliation.
- The Docker Workload Adapter owns the narrow, authorized Docker workload mutations defined by ADR 0002.
- The ingress adapter owns provider-specific routing/configuration execution only.
- The ingress data plane terminates public connections and forwards requests to explicitly authorized private upstreams.
- ATLAS owns DNS configuration in its domain. It is not a second application router or deployment authority.
- HEADQUARTER is an operator UI/BFF and must not receive TLS private keys or provider administration credentials.

Without an explicit boundary, a Docker label provider, an ingress dashboard, ARSY routes, ATLAS DNS state and Headquarter UI could independently become competing sources of routing truth. This proposal selects one provider and establishes the control-plane contract before implementation.

## 2. Proposed decision

### 2.1 Select Caddy for the first single-host ingress provider

Use **Caddy 2** as the initial TLS-terminating HTTP reverse-proxy data plane, operated by one narrowly scoped ingress adapter.

The initial release is a single active Caddy instance per public ingress endpoint. It is not a multi-node edge cluster, CDN, WAF replacement, Kubernetes ingress controller or full public multi-tenant hosting service.

Reasons for this selection:

1. Caddy provides automatic HTTPS certificate acquisition and renewal for explicitly configured qualifying hostnames, and automatically redirects HTTP to HTTPS.
2. Caddy provides a configuration administration API with a Unix-domain-socket option. The admin API must not listen on a TCP interface.
3. Caddy's `POST /load` replaces the running configuration with graceful, zero-downtime reload behavior and retains the previous working configuration if the new configuration fails.
4. Caddy persists its latest configuration and supports resuming it after restart. This is a recovery aid only; ARSY remains the canonical source of desired route state.
5. The first release can use explicit, pre-verified host routes. It does not need a Docker metadata provider or on-demand TLS.

Official references:

- [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [Caddy Admin API](https://caddyserver.com/docs/api)
- [Caddy Caddyfile admin option and Unix socket](https://caddyserver.com/docs/caddyfile/options)
- [Caddy network-address and Unix-socket permissions](https://caddyserver.com/docs/conventions)

Pin an explicitly tested Caddy image digest/version in the later implementation; do not use an unpinned `latest` image in production.

### 2.2 One source of truth and strict component ownership

| Concern | Sole owner | Data or authority |
|---|---|---|
| Domain claim, ownership proof, approved hostname and route intent | ARSY | Durable canonical records, actor, approval, status and audit |
| Deployment identity and allowed upstream | ARSY | Existing deployment/operation records and authorized target receipt |
| DNS record configuration | ATLAS | DNS-specific desired/observed records and provider receipt, only after ARSY authorizes the request |
| Provider config translation and application | Ingress Adapter | Typed route contract, provider generation ID and applied-config fingerprint |
| TLS termination, ACME account/client operation, certificate/private-key storage and renewal | Caddy | Provider-owned persistent certificate storage |
| Docker network membership and workload endpoints | ARSY through the existing Docker Workload Adapter | Explicit deployment-scoped network and workload receipts |
| Operator presentation | HEADQUARTER | Same-origin authenticated BFF calls to ARSY |

ARSY is authoritative for desired domain/route state. Caddy configuration, certificates and runtime observations are provider state, not a second business database. The ingress adapter must report a typed application receipt and provider generation/fingerprint to ARSY. It must not make authorization or policy decisions.

The ingress adapter must not have a direct database credential, registry credential, general Docker socket, host shell, or authority to create arbitrary workloads. It receives bounded, authenticated commands from ARSY and uses only the Caddy admin Unix socket for provider configuration.

### 2.3 Private upstream topology

Use one dedicated Caddy gateway, with public listeners on TCP 80 and 443 only. Do not attach Caddy to a shared network containing every application.

Each deployed application gets its own user-defined private bridge network. The application's services and the approved Caddy gateway endpoint may join that deployment's network; unrelated applications do not. The Docker Workload Adapter performs and audits the exact gateway-network attachment as an explicit, deployment-scoped operation. The ingress adapter itself receives no Docker socket and cannot change network membership.

The gateway may consequently be connected to several deployment-scoped private networks. This is an intentional trust boundary: compromise of the shared ingress process could reach the upstreams attached to it. The first release is therefore appropriate only for a single trusted operator/host security domain. Workloads belonging to mutually untrusted tenants or different trust zones require separate gateway instances/hosts before they can be hosted together.

Requirements:

- Application containers have no public host-port publication.
- No default/shared application network is used as a tenant boundary.
- Each upstream is selected from an ARSY-authorized deployment receipt and exact service/port contract; callers cannot submit an arbitrary URL, IP address, hostname, port or Caddy JSON.
- The generated Caddy route uses exact normalized host matching and a private upstream reachable only through the corresponding deployment network.
- Unrelated workloads and host services are not implicitly added to an application's network.
- The public edge exposes only the configured listener ports. HTTP/3 over UDP 443 is deferred until firewall, monitoring and CI coverage exist.

Docker documents that containers on the same user-defined bridge can communicate with each other, while containers on different user-defined bridges are isolated by default. Network membership must therefore be deployment-scoped, not a single shared "all apps" bridge: [Docker bridge network isolation](https://docs.docker.com/engine/network/drivers/bridge/).

### 2.4 Domain ownership and route lifecycle

The initial release supports exact fully qualified domain names only. Wildcards, IP-literal certificates, arbitrary path routers and automatic tenant subdomain allocation are deferred.

Before any route is sent to Caddy:

1. ARSY canonicalizes and validates the hostname: lowercase IDNA A-label form, valid DNS labels and total length, no URL scheme/path/port/userinfo, no trailing dot in stored canonical form, no wildcard, and no internal/reserved suffix.
2. ARSY issues a cryptographically random, single-use, time-bounded ownership challenge. The claimant publishes the expected TXT value under a dedicated verification name such as `_mw-verify.<domain>`. ARSY verifies the public authoritative answer; a mere A/AAAA record pointing to this host is not proof of ownership.
3. ARSY verifies that the public A/AAAA records resolve only to the approved ingress address set. A mismatch, private/special-use address, unresolved name or unexpected address fails closed. IPv6 must be checked as well as IPv4; an incorrect AAAA record can send ACME validation to the wrong host.
4. The route is bound to an existing authorized deployment identity and exact upstream receipt. Domain ownership alone never grants deployment or upstream authority.
5. Only then can ARSY authorize route activation and request provider reconciliation.

For the first release, users may make DNS records manually and ARSY only verifies them. Where DNS automation is enabled later, ARSY delegates the DNS mutation to ATLAS using a scoped, domain-specific request and consumes ATLAS's receipt. ARSY does not implement a second DNS provider client, and the ingress process never receives broad DNS API credentials.

The canonical lifecycle should distinguish at least:

- `pending_ownership`
- `pending_dns`
- `pending_upstream`
- `provisioning_tls`
- `active`
- `degraded`
- `suspended`
- `removing`
- `removed`
- `failed`

These are proposed domain/API states, not existing database enum values. The implementing issue must define legal transitions and migrations rather than writing undocumented strings into current schema.

### 2.5 TLS and certificate lifecycle

Use Caddy's managed ACME integration for explicitly configured domains.

**Initial challenge policy**

- Require publicly reachable TCP 80 and 443 on the selected ingress endpoint.
- Use HTTP-01 and TLS-ALPN-01 only for the first release, with the actual challenge reachability verified before an issuance request.
- Configure ACME staging for CI and disposable validation. Production ACME issuance is only enabled in a separate, approved staging-to-production rollout.
- Do not enable on-demand TLS in the first release. Domain approval and route publication happen before the hostname is placed into Caddy's configuration.
- Do not issue wildcard certificates in the first release.
- DNS-01/wildcard issuance may be added only after ATLAS has a scoped challenge-delegation contract and a credential-custody design that does not give Caddy general DNS write privileges.

Let's Encrypt's HTTP-01 challenge is validated on port 80 and cannot issue wildcard certificates. DNS-01 uses a TXT record and can issue wildcard certificates, but keeping broad DNS API credentials on the web server increases compromise impact. TLS-ALPN-01 uses port 443 and is intended for TLS-terminating proxies. See [Let's Encrypt challenge types](https://letsencrypt.org/docs/challenge-types/) and [integration guidance](https://letsencrypt.org/docs/integration-guide/).

**Private-key custody**

- Caddy is the only component that reads or writes managed certificate private keys and ACME account material.
- Keep the Caddy data directory on persistent storage with restrictive owner/group permissions. Protect backups with encryption and access controls.
- Do not mount the Caddy certificate store into ARSY, ATLAS, AEGIS, HEADQUARTER, application workloads or the ingress adapter.
- Do not return certificate private keys, ACME account keys or raw provider storage in APIs, events, logs, support bundles or browser responses.
- Caddy's admin socket grants powerful routing/configuration control. Mount it only into the ingress adapter with a dedicated Unix group and restrictive socket mode; it is not a general operator API.
- The admin API must bind to a permissioned Unix socket, for example `unix//run/caddy-admin/admin.sock|0660`, not a TCP port. Only the Caddy process and the ingress-adapter service account/group may access the socket. No public or general-purpose service-network access is allowed.

Caddy explicitly warns that the admin endpoint can control the server and recommends process isolation or a permissioned Unix socket when untrusted code runs on the host. The API documents its Unix-socket option and its graceful `POST /load` behavior: [Admin API security and reload semantics](https://caddyserver.com/docs/api), [Unix socket configuration](https://caddyserver.com/docs/caddyfile/options).

**Renewal, revocation and expiry**

- Caddy owns normal ACME renewal; the control plane observes certificate health/expiry and surfaces renewal failure.
- Existing unexpired certificates continue serving during a temporary ACME outage. New domains remain pending until a valid certificate is obtained.
- Route removal first removes public routing. Certificate revocation is a separate audited security operation; a routine application removal must not revoke a certificate still shared by another approved route.
- If a private key is suspected compromised, immediately withdraw the affected route, invoke the issuer's revocation procedure, rotate/reissue, preserve audit evidence and verify that the replacement is active before reopening traffic.
- Do not silently fall back to plaintext HTTP when a certificate is unavailable or expired. HTTP may serve ACME challenge material and redirect to HTTPS; it must not serve authenticated application content.
- Rate-limit issuance attempts by hostname/account, persist attempt outcomes and honor ACME `Retry-After`. Repeatedly deleting certificate storage or reinstalling the gateway must not cause unbounded re-issuance.

Let's Encrypt publishes certificate issuance and authorization-failure limits and recommends staging for testing: [Let's Encrypt rate limits](https://letsencrypt.org/docs/rate-limits/).

### 2.6 Config generation, reload and rollback

ARSY stores the canonical desired route. The ingress adapter compiles that route into a constrained Caddy JSON configuration; it does not accept arbitrary Caddy JSON or module directives from callers.

For each change:

1. Authenticate and authorize the ARSY request, validate its schema and deployment receipt, and enforce an idempotency/generation key.
2. Generate a complete candidate configuration deterministically from the current desired route set.
3. Validate required fields and provider constraints before touching the live provider.
4. Submit the complete candidate using Caddy's admin API over the permissioned Unix socket.
5. Record the resulting provider generation/fingerprint and bounded receipt only after Caddy confirms the new configuration is loaded.
6. If the reload fails, retain the prior live configuration and mark the desired operation failed/degraded for retry or operator action. Never claim the new route is active.
7. After restart, Caddy may resume its last successfully saved configuration for availability; the adapter must then reconcile it against ARSY's durable desired state. Caddy's saved config is not the canonical source of truth.

The Caddy admin API documents that `POST /load` waits for reload completion, applies changes without downtime, and rolls back to the prior configuration if the new one fails. The implementation must test these behaviors on the pinned image rather than relying solely on documentation.

### 2.7 HTTP handling and safe defaults

The first release must define and test:

- Exact hostname matching with no catch-all route to an application.
- SNI/Host mismatch rejection and a non-informative default 404.
- Explicit upstream service/port mapping sourced from ARSY deployment records; never accept a user-supplied upstream URL.
- Removal/overwrite of client-supplied forwarding headers. Caddy writes canonical forwarding metadata; applications trust it only from the gateway's private network/known proxy boundary.
- Bounded request body size, header size, header-read timeout, idle timeout, upstream dial timeout and total request timeout.
- Explicit rate limits for login/auth-sensitive routes and abuse controls for public ingress.
- WebSocket upgrade support only as an explicitly tested route capability; HTTP/3 is deferred.
- No direct application host port, public database port, admin endpoint or Docker API exposure.
- TLS minimum policy and security headers as versioned defaults, with controlled per-product exceptions.
- Health/readiness checks to distinguish an active proxy from an active application. A Caddy process being alive is not proof that an upstream is healthy.

## 3. Initial release boundary

The first implementation after this ADR is accepted is a **single-host, single-gateway, exact-hostname ingress**:

- One Caddy instance with ports 80/TCP and 443/TCP.
- One ingress adapter as the only writer to Caddy's admin Unix socket.
- ARSY-backed domain claim, ownership verification, route approval and desired state.
- ATLAS DNS mutation remains optional and separate; manual DNS setup is supported initially.
- Per-deployment private application networks; only the approved gateway is connected to each network by the ARSY Docker Workload Adapter.
- ACME HTTP-01/TLS-ALPN-01; staging for CI; no wildcard/on-demand TLS.
- Persistent certificate data, encrypted backups, renewal monitoring and tested recovery.
- No production exposure until the implementation has disposable-engine CI, staging ACME validation, independent security review, backup/restore rehearsal and explicit operator approval.

Not included: high availability/multi-node Caddy, wildcard tenant certificates, DNS-01 API credentials in the ingress process, arbitrary TCP/UDP forwarding, user-supplied Caddy modules/config, a public routing API, direct container port exposure, public Docker socket, or a provider dashboard.

## 4. Alternatives considered

| Option | Benefits | Costs / risks | Decision |
|---|---|---|---|
| **Caddy 2** | Automatic HTTPS; explicit config API; permissioned Unix admin socket; graceful full-config reload with rollback; relatively small operational surface | Requires a tightly controlled adapter and an explicit network-attachment design; shared gateway is a trust boundary | **Proposed for first release** |
| **Traefik 3 — File provider only** | Dynamic routers/services/middlewares from YAML/TOML; built-in ACME; no Docker provider required | File-provider reload depends on filesystem notifications and mounted-volume behavior; ACME JSON must be mode 0600 and cannot be shared by multiple Traefik instances | Credible alternative; not selected for this first release |
| **Nginx/OpenResty plus ACME client** | Mature reverse proxy, extensive routing controls and broad operational familiarity | Certificate issuer/renewal, config generator, validation, reload orchestration and rollback are separate components to own and test | Rejected for the first release due to extra lifecycle components |
| **Envoy with xDS/SDS control plane** | Rich dynamic routing, traffic policy, observability and certificate-distribution contracts | Requires a substantial xDS/SDS management plane and greater operational complexity than this single-host first release needs | Deferred until measured scale/traffic policy justifies it |

Traefik's File provider supports dynamic routing from structured files, but its documentation notes filesystem-notification caveats for mounted/bound directories. Traefik's Docker provider requires Docker API access and explicitly warns about the host impact if that access is unrestricted. Its ACME storage file requires mode 0600 and cannot be shared across multiple instances for concurrency reasons: [File provider](https://doc.traefik.io/traefik/reference/routing-configuration/dynamic-configuration-methods/), [Docker provider security](https://doc.traefik.io/traefik/v3.8/reference/install-configuration/providers/docker/), [ACME storage](https://doc.traefik.io/traefik/v3.8/reference/install-configuration/tls/certificate-resolvers/acme/).

Docker's network documentation also warns that a shared user-defined bridge permits communication between connected containers. The selected design therefore uses deployment-scoped networks rather than treating a single shared bridge as tenant isolation: [Docker bridge networks](https://docs.docker.com/engine/network/drivers/bridge/).

## 5. Risks and unresolved proof requirements

| Risk | Required mitigation / evidence |
|---|---|
| Shared Caddy compromise reaches every connected upstream | Single trusted host only for v1; isolate untrusted tenants into separate gateway trust zones before hosting them together; no Docker socket; minimize modules and OS capabilities |
| Domain takeover or arbitrary certificate issuance | TXT ownership proof before route configuration; no on-demand TLS or wildcards; issuance rate limits and audit |
| Bad generated config causes outage | Deterministic full config, schema validation, staged candidate and Caddy rollback; fault-injection test |
| DNS/IPv6 mismatch | Verify A and AAAA against approved addresses; test both address families and ACME reachability |
| Caddy state diverges from ARSY | ARSY is source of truth; persisted desired state, generation IDs, startup reconciliation and drift alerts |
| ACME outage or rate limit | Staging validation, honor retry hints, preserve existing valid cert, monitor renewal windows; no plaintext fallback |
| Certificate store loss or disclosure | Persistent restricted storage, encrypted backups, restore test, least privilege and separate key custody |
| Gateway-network attachment is overbroad | Exact deployment-scoped Docker Workload Adapter operation, ownership labels and integration tests proving no unrelated network attachment |
| Admin socket becomes remotely reachable | Unix socket only, dedicated group/mode, no TCP admin listener, filesystem permission test |
| Proxy-to-upstream SSRF or host-service access | Upstream references only from authenticated deployment receipts; never accept arbitrary upstream URLs/addresses |

Before enabling public traffic, an isolated CI/staging proof must demonstrate:

1. Caddy's pinned image accepts only the intended config contract.
2. The admin API is reachable only via the permissioned Unix socket; TCP access is absent.
3. A valid configuration loads, a malformed configuration fails, and the previous working config continues serving.
4. A gateway can reach only approved deployment networks/upstreams; one application cannot reach another application's network.
5. Public HTTP is redirected to HTTPS, ACME staging issuance works for a controlled test domain, and renewal/restart recovers the stored certificate.
6. Invalid/unverified domains never appear in Caddy configuration and do not trigger certificate orders.
7. Route removal withdraws public access without deleting persistent application data.
8. Caddy restart and adapter restart reconcile provider state with ARSY's desired route set.
9. Logs and receipts contain no private key, ACME account key, DNS API token or other secret.
10. Backup/restore and certificate-compromise revocation procedures are exercised in a disposable environment.

## 6. Consequences

Positive:

- One explicit ingress provider and one provider-execution adapter.
- ARSY remains the canonical identity, approval and desired-state authority.
- ATLAS can own DNS automation without becoming an application reverse proxy.
- Headquarter remains free of TLS private keys and provider administration credentials.
- The existing read-only Docker Connector and current development Compose behavior remain unchanged.
- Certificate issuance, routing and network attachment have independent, testable contracts.

Costs:

- A new ingress-adapter lifecycle and provider contract must be implemented.
- The Docker Workload Adapter needs an explicit, authorized gateway-network attachment operation.
- Caddy's certificate store becomes security-critical state requiring persistence, backups and recovery drills.
- Shared Caddy is a privileged trust boundary; stronger multi-tenant isolation will require gateway sharding or stronger network enforcement.
- The first release is deliberately single-host and is not high availability.

## 7. Implementation authorization and dependency order

This proposal, if accepted by maintainers, authorizes only the bounded first-release architecture described above. It does not authorize production deployment or public traffic.

Recommended follow-on order:

1. Accept this ADR and record maintainer rationale.
2. Define the ARSY domain-claim, ownership-verification, route-intent, approval, desired-state and provider-receipt contracts.
3. Add the ingress adapter and Caddy Unix-socket config/reconciliation path with disposable Caddy CI.
4. Extend the ARSY Docker Workload Adapter with the exact deployment-scoped gateway-network attachment operation and tests.
5. Integrate route intent with the deployment API (#184) and expose operator workflows through Headquarter only after the API stabilizes.
6. Add ATLAS DNS delegation when its scoped DNS contract and provider credential custody are ready.
7. Complete staging ACME, network isolation, backup/restore, renewal, revocation and independent security acceptance before production exposure.

Any change of provider, key custody, Docker mutation ownership or control-plane authority requires a superseding reviewed ADR.

## 8. Decision record

**Maintainer decision:** Pending  
**Selected proposal:** Caddy 2 behind a narrow ARSY-authorized ingress adapter  
**Implementation status:** Not started; this PR proposes architecture only  
**Production status:** Not enabled; no DNS records, certificates, public ports or production services were changed
