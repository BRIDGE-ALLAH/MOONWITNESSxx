# ADR 0003 — Isolated OCI Build Engine

**Status:** Proposed for maintainer review; BuildKit is the recommended v1 choice  
**Date:** 2026-11-08  
**Decision scope:** Source checkout, Dockerfile execution, OCI image creation/publishing, build isolation, cache and provenance  
**Related:** [ADR 0002 — Docker Workload and Deployment Ownership](0002-docker-workload-deployment-ownership.md), [PaaS implementation issue #182](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/182), [Build Engine implementation issue #183](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/183)

## 1. Context

ADR 0002 separates source/image construction from Docker workload deployment. ARSY remains the application deployment control plane. The Build Engine produces an immutable OCI image and verifiable receipt; it does not choose a deployment target, authorize production rollout, own deployment history or control running application containers.

The repository currently has no accepted application Build Engine, no isolated build worker, no OCI registry lifecycle for user builds, and no provenance receipt. The first release must build an explicitly authorized immutable Git commit from a Dockerfile without exposing ARSY credentials, the production Docker socket, sibling build data or infrastructure control-plane networks to untrusted build instructions.

## 2. Options evaluated

The options are compared for the actual initial MOONWITNESS requirement: single-job isolated Dockerfile builds, OCI registry output, immutable digest/receipt, bounded resource use and no access to a production Docker daemon.

| Criterion | BuildKit rootless | Buildah rootless | Kaniko upstream / maintained forks |
|---|---|---|---|
| Execution model | Build daemon with OCI worker; rootless mode supported | Daemonless CLI/build process; rootless isolation supported | Executor image/process; no Docker daemon dependency |
| Dockerfile compatibility | Native BuildKit Dockerfile frontend; supports the familiar Dockerfile workflow | Builds Containerfiles and Dockerfiles; supports Dockerfile build context | Dockerfile-focused executor |
| Orchestration/caching | Strong build graph/session API and content-addressed cache; daemon state must be isolated by trust domain | Straightforward per-invocation execution; storage/cache behavior is managed by the calling worker | Layer snapshot/cache model; operational behavior depends on the selected fork and image publisher |
| Isolation caveat | Rootless mode still documents network.host for build steps; isolate the daemon network namespace with RootlessKit and enforce egress outside the build process. Never use the no-process-sandbox shortcut | Rootless isolation is supported; explicitly choose a private/pasta network mode and validate host reachability in the selected runtime | No daemon required, but no-daemon alone is not a complete hostile-code sandbox |
| OCI output | Supports registry/image exporters and immutable digest workflows | OCI image/registry workflow is supported | Pushes images to registries |
| Operational fit | Recommended for a controlled, disposable worker with a narrow BuildKit API boundary | Credible alternative where a per-job CLI process is simpler and BuildKit daemon lifecycle is not justified | Upstream project is archived; maintained forks are separate supply-chain choices requiring independent review |
| v1 decision | **Preferred, subject to the proof gates below** | Retain as fallback if the BuildKit isolation proof cannot be met on the actual host/VM platform | Do not use archived upstream; do not silently substitute a fork |

### Evidence and current project state

- BuildKit documents rootless daemon operation, the network.host limitation, RootlessKit network isolation guidance, and why --oci-worker-no-process-sandbox is discouraged. See the [official BuildKit rootless guide](https://github.com/moby/buildkit/blob/master/docs/rootless.md).
- The BuildKit project published v0.34.2 on 2026-11-03. This is the spike pin; production must verify and pin the exact binary/image digest and release attestations, not follow a mutable latest tag. See [BuildKit releases](https://github.com/moby/buildkit/releases).
- Buildah's official build documentation describes Dockerfile/Containerfile builds, rootless isolation and network options including private/pasta. It remains a credible fallback. See [Buildah build documentation](https://github.com/podman-container-tools/buildah/blob/main/docs/buildah-build.1.md).
- Buildah's project site announced v1.46.0 on 2026-10-21. See [Buildah releases](https://buildah.io/).
- The original GoogleContainerTools/kaniko repository was archived on 2025-06-03. A maintained fork exists, but choosing it would require separately accepting that fork's source, build-image publisher and release-signing supply chain. See [archived upstream](https://github.com/GoogleContainerTools/kaniko) and [osscontainertools/kaniko](https://github.com/osscontainertools/kaniko).

This is a dated technology comparison, not proof that any builder is already installed, configured or safe on MOONWITNESS infrastructure.

## 3. Recommended decision

Use **BuildKit rootless as the v1 builder**, but run a separate, disposable worker environment for each build job. The daemon is not shared between tenants, repositories or unrelated trust domains.

The recommended boundary is:

1. ARSY authorizes the exact repository, immutable commit, build recipe, worker profile and output registry scope.
2. A trusted source-resolution step fetches the authorized commit and produces an immutable, bounded build-context bundle. The Git provider credential is not forwarded to build instructions.
3. A fresh build worker is provisioned for exactly one job. It runs a pinned BuildKit release as an unprivileged OS user with user-namespace mappings and its own disposable workspace and daemon state.
4. BuildKit uses the OCI worker. RootlessKit isolates the daemon network namespace (prefer the documented gVisor TAP/vsock network driver where compatible; otherwise validate and explicitly select a supported isolated driver).
5. The worker is attached to a dedicated egress boundary. Build steps cannot reach ARSY, Headquarter, Docker Engine APIs, ATLAS, AEGIS, PostgreSQL, Redis, private management ranges, link-local addresses or cloud metadata endpoints. Any required package/repository access is routed through an enforceable policy boundary.
6. BuildKit publishes only to an explicitly authorized OCI repository using a short-lived, repository-scoped push credential. The credential is available to the export/publish path only, never mounted into arbitrary Dockerfile RUN steps or copied into the build context.
7. ARSY verifies and persists the resulting image digest, source commit, builder release/digest, recipe/context digest, build timestamps, bounded log reference, SBOM/provenance evidence and terminal status.
8. The worker, writable cache, temporary credentials and transient context are destroyed after receipt persistence or bounded failure cleanup.

A dedicated disposable VM is the preferred first trust boundary. If the selected infrastructure cannot provision a per-job VM, a separate ADR amendment and adversarial proof are required before replacing it with another isolation primitive. Do not infer that a rootless container alone makes untrusted build instructions safe.

## 4. Mandatory security and isolation constraints

### 4.1 Worker isolation

- One untrusted build per disposable worker VM; do not co-schedule unrelated tenants inside one buildkitd process.
- BuildKit runs as a non-root user with user namespaces; the host/hypervisor remains the outer trust boundary.
- No Docker or containerd socket from the application runtime or production host is mounted or forwarded into the worker.
- No privileged mode, security.insecure, device entitlement, host PID/IPC, host network, host bind mount or BuildKit insecure entitlement.
- Do not use --oci-worker-no-process-sandbox. The upstream documentation warns that this weakens process isolation and allows a build exec to signal processes in the daemon container.
- No cross-tenant writable cache. V1 starts with per-job ephemeral cache. Any later remote cache must be partitioned by repository/trust domain, content-addressed, integrity-checked and protected against poisoning.

### 4.2 Network

- Rootless BuildKit's documented worker network mode must not be mistaken for per-instruction network isolation. The complete worker network namespace is isolated from the host and protected by an external firewall/egress proxy.
- Default-deny traffic to RFC1918, loopback outside the worker, link-local, multicast, IPv6 local/private ranges, cloud metadata, host management networks and MOONWITNESS control-plane services.
- No untrusted build step may choose arbitrary proxy settings, route tables, DNS servers, host mappings or host-gateway access.
- V1 starts with an explicit package/repository egress policy and logs the policy version. No “temporarily allow all egress” fallback is acceptable.
- Enforce DNS resolution and destination checks at the egress boundary; protect against DNS rebinding and redirects that resolve to prohibited address space.

#### BuildKit proxy-network limitation

BuildKit v0.34.2 supports `proxyNetwork` for network-enabled Dockerfile exec steps. It routes those requests through a BuildKit-owned proxy and blocks raw-TCP bypass, but it is **not a complete egress allowlist**: it does not cover image-resolver, Git, HTTP-source or other non-exec fetches. The BuildKit proxy also does not currently chain its requests through the daemon's configured upstream `HTTP_PROXY`/`HTTPS_PROXY`; see upstream issue [moby/buildkit#6991](https://github.com/moby/buildkit/issues/6991). Source-policy checks apply to proxy-visible HTTP(S) requests, with conversion currently limited to GET requests.

Therefore production must additionally enforce default-deny egress at the disposable worker VM/network boundary for registry/source fetches and build-step traffic, with an explicit destination allowlist and DNS-rebinding protections. Do not claim `proxyNetwork=true` alone satisfies the allowlist requirement. The CI spike verifies host-loopback isolation and `RUN --network=none`; it does not replace the production VM firewall/NSG acceptance test.

### 4.3 Source and secrets

- Source checkout uses an immutable commit SHA and trusted provider resolution. No branch-only build identity.
- Source credentials are used outside the untrusted build execution and removed before the Dockerfile runs.
- Registry credentials are short-lived and restricted to one repository and push/pull actions required for the job.
- No long-lived ARSY operator token, Docker TLS private key, database password, service token or host credential is injected into the worker.
- V1 does not expose arbitrary user-defined build secrets. A later secret-mount feature requires a separate threat model because any process in a Dockerfile step that receives a secret can exfiltrate it.
- Credentials must not appear in command-line arguments, build logs, image layers, build cache, provenance, persisted operation payloads or support bundles.

### 4.4 Resource, output and recovery limits

Every job must have explicit enforced limits for wall-clock time, CPU, memory, disk, process count, context bytes, output bytes, log bytes and concurrent jobs. The dispatcher must cancel and destroy workers that exceed a limit or lose their lease.

The build receipt records:
- repository identity and immutable commit;
- context and Dockerfile/recipe digests;
- builder name, version and image/binary digest;
- output registry/repository and immutable OCI digest;
- creation time, completion time and terminal outcome;
- provenance and SBOM reference/digest when produced;
- policy version, bounded result/error code and log reference.

A worker restart must never be interpreted as build success. If an outcome is ambiguous, ARSY reconciles the registry digest/receipt before any retry. Image digest and provenance are durable evidence; a tag is only a mutable locator.

## 5. Initial v1 feature boundary

Allowed:
- Git source by authorized provider reference, resolved to an immutable commit before build;
- one documented Dockerfile build mode;
- OCI image output to an explicitly selected registry repository;
- ephemeral per-job worker/BuildKit state;
- bounded logs, cancellation, cleanup, immutable digest and provenance/receipt persistence.

Deferred:
- Docker Compose builds and deployments;
- buildpacks, Nixpacks, Paketo and arbitrary build plugins;
- privileged/insecure Dockerfile entitlements and device builds;
- caller-supplied secrets and build-time secret mounts;
- shared multi-tenant buildkitd and shared writable cache;
- public internet egress without an enforceable policy;
- multi-architecture matrix builds, remote cache federation, build farms and billing/quotas beyond conservative global safety limits.

## 6. Required proof before implementation is enabled

The implementation issue must demonstrate the following on the actual selected worker platform. Documentation or a passing unit test alone does not satisfy this gate.

1. **No control-plane access:** a hostile Dockerfile cannot read ARSY/Headquarter environment, filesystem, credentials, PostgreSQL, Redis or service tokens.
2. **No Docker access:** attempts to locate or connect to host/production Docker/containerd sockets fail; the image builder cannot mutate unrelated host containers or images.
3. **No sibling-job access:** a build cannot inspect, signal, ptrace, mount, read or write another job's process, filesystem, cache or credentials.
4. **Network boundary:** SSRF probes to loopback/host gateway, RFC1918, link-local, IPv6-local, cloud metadata, Docker networks and control-plane endpoints are blocked, including redirects and DNS rebinding.
5. **Process sandbox:** background processes cannot survive their build step or signal BuildKit daemon/worker supervisor processes.
6. **Resource enforcement:** CPU, memory, disk, PID, wall-clock, context and log limits terminate abusive builds and trigger deterministic cleanup.
7. **Credential handling:** registry push succeeds with a short-lived scoped token, while the token is absent from build output, image layers, cache and stored receipts.
8. **Recovery:** forced worker termination during build/push is reconciled and cleaned up without falsely recording success or duplicating deployment side effects.
9. **Artifact integrity:** published OCI digest and provenance can be independently verified and match the exact source commit/context and pinned builder identity.
10. **Repeatability:** disposable CI reproduces the same security tests and cleans all temporary resources.

Any failed proof blocks enabling user-triggered builds. Re-evaluate Buildah as an alternative if BuildKit rootless cannot meet the process/network isolation proof without weakening the host boundary.

## 7. Consequences

Positive:
- Keeps build execution separate from the ARSY deployment control plane and Docker workload adapter.
- Avoids exposing the production Docker socket to untrusted source builds.
- Gives the initial PaaS one immutable image/digest and verifiable build receipt.
- Starts without a shared multi-tenant builder or shared writable cache.

Costs:
- Requires a provisioner for disposable per-job VM workers, a controlled egress boundary, registry credentials and worker cleanup/monitoring.
- Ephemeral workers are more resource-intensive than a shared daemon.
- Cache performance is intentionally limited until a safe trust-domain cache design exists.
- Rootless BuildKit still needs kernel/user-namespace prerequisites and must be tested on the actual deployment kernel.

## 8. Status and implementation authorization

This ADR records the recommended BuildKit architecture but remains **Proposed** until maintainers review the decision and the required isolation proof plan. Issue #183 must not enable a production builder until this ADR is accepted and the adversarial tests in §6 pass.

ADR 0002 remains the parent ownership decision. Any change that introduces a shared privileged daemon, Docker socket access, weaker host/network isolation or a different public build contract requires a superseding ADR.
