# ADR 0003 — Isolated OCI Build Engine

**Status:** Proposed — maintainer decision and adversarial proof required  
**Date:** 2026-11-08  
**Decision owner:** ARSY architecture / Build Engine boundary  
**Related:** [ADR 0002 — Docker Workload and Deployment Ownership](./0002-docker-workload-deployment-ownership.md), [Issue #182](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/182), [Issue #183](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/183), [Issue #184](https://github.com/BRIDGE-ALLAH/MOONWITNESS/issues/184)

> This is a decision proposal, not an accepted production architecture. No builder is enabled by this ADR. The proof and maintainer review in #182 are mandatory before #183 implementation.

## 1. Decision context

ARSY is the only application deployment control plane. It authenticates the operator, authorizes the repository/target/action, records durable operations and dispatches work. The Docker Workload Adapter applies an already-built immutable OCI image to an authorized target. Image construction is a separate trust domain because a Dockerfile can execute arbitrary commands and must be treated as untrusted code.

The first supported build contract is deliberately narrow:

- One Git repository from an explicit allowlist.
- One immutable full commit SHA; branch names are discovery input only and are resolved before the build.
- One Dockerfile path inside the checked-out repository.
- One target platform per build initially; multi-platform manifests are deferred.
- One configured OCI registry/repository namespace with short-lived, repository-scoped push credentials.
- Output is an immutable `sha256:` OCI digest plus a signed or independently verifiable provenance receipt.
- No Compose build, buildpacks, arbitrary build plugins, privileged build flags, host mounts, Docker socket, or interactive shell.

A successful build does not authorize deployment. ARSY separately authorizes the deployment operation and target.

## 2. Options evaluated

| Criterion | Rootless BuildKit on shared host | Rootless Buildah on shared host | Ephemeral microVM with BuildKit |
|---|---|---|---|
| Docker daemon/socket required | No | No | No |
| Rootless execution available | Yes | Yes | Builder runs unprivileged inside guest |
| Host-kernel attack boundary | Shared host kernel | Shared host kernel | VM boundary plus guest kernel |
| Network isolation | Requires explicit network namespace/egress controls; BuildKit rootless docs describe network mode as host in its daemon namespace | Rootless isolation reuses host network/UTS namespaces in documented mode | Guest network is routed through a deny-by-default egress gateway |
| Resource limits | Host cgroups and process controls; daemon/job separation required | Host cgroups and process controls | VM vCPU/RAM/disk plus guest limits |
| Per-build filesystem isolation | Requires carefully separated worker state and cleanup | Requires isolated storage roots and cleanup | Disposable VM and scratch disk destroyed after each build |
| Operational cost | Lowest | Low | Highest; requires KVM-capable hosts and VM lifecycle |
| Fit for untrusted multi-project Dockerfiles | Insufficient as the sole isolation boundary | Insufficient as the sole isolation boundary | Preferred boundary, subject to tested host capability |

### Evidence and limitations

- BuildKit supports rootless execution, but its rootless documentation notes network mode is always `network.host`; it recommends isolating the daemon network namespace with RootlessKit and slirp4netns. Rootless alone is therefore not an egress policy or a hostile-tenant boundary. See [BuildKit rootless mode](https://github.com/moby/buildkit/blob/master/docs/rootless.md).
- Buildah documents rootless isolation, but the rootless mode reuses the host network and UTS namespaces while creating private IPC, PID, mount and user namespaces. See [Buildah build isolation](https://github.com/containers/buildah/blob/main/docs/buildah-build.1.md).
- BuildKit is a mature Dockerfile/OCI build engine and can run without a Docker daemon; the isolation boundary must be supplied by the execution environment, not inferred from the builder's rootless flag. See [GitLab's BuildKit build guidance](https://docs.gitlab.com/ci/docker/using_buildkit/) and [Docker BuildKit configuration](https://docs.docker.com/build/buildkit/toml-configuration/).

## 3. Proposed decision

Use **one disposable Firecracker microVM per build, running rootless BuildKit inside the guest**. Do not run untrusted Dockerfile instructions in the ARSY process, on the shared host namespace, in the deployment worker, or through the host Docker socket.

This choice is conditional on a reproducible proof that the actual supported runner has KVM and that the VM lifecycle can be operated safely. If the target host cannot provide the required isolation, building is unavailable; do not silently fall back to shared-host BuildKit or Buildah. A separately reviewed alternative isolation provider would require a new decision.

### Trust boundaries

1. **ARSY control plane:** validates authenticated principal, repository allowlist, commit, Dockerfile path, target registry, resource profile and policy. It creates a durable build operation and scoped credential references. ARSY does not execute build commands.
2. **Build coordinator:** accepts only an authorized build request and launches one disposable VM. It receives an operation-scoped opaque reference, not ARSY's database credentials, operator token, Docker credentials or deployment target secrets.
3. **Guest builder:** receives only the checked-out source snapshot, declared build inputs and narrowly scoped registry push credential. It has no host filesystem mount, Docker socket, ARSY network route, sibling-job access or general cloud metadata access.
4. **Egress gateway:** permits only the required source and registry endpoints plus explicitly declared package/base-image mirrors. Default deny; no arbitrary inbound connectivity. DNS is policy-controlled and rebinding-resistant.
5. **Artifact registry:** accepts push only to the assigned repository namespace using an expiring token. It returns an immutable digest.
6. **ARSY:** verifies the receipt and digest, stores bounded build provenance against the operation, then independently authorizes any deployment.

## 4. Isolation and execution requirements

These are acceptance requirements, not claims that the prototype already enforces them.

- Create a fresh VM and scratch disk for every build. Never reuse a guest across projects or tenants.
- Require KVM hardware virtualization; pin and verify the guest kernel, Firecracker version, guest image and BuildKit version.
- No host Docker socket, container runtime socket, host PID/network/IPC namespace, host path mount, device passthrough, or privileged guest workload.
- Disable guest metadata endpoints and host-loopback access. The guest has no route to ARSY, PostgreSQL, Redis, Docker Engine, control-plane admin endpoints or the host management network.
- Apply VM-level CPU, memory, disk I/O, disk capacity and wall-clock limits; apply guest PID, process, log and build-step limits. Initial proposed ceiling: 2 vCPU, 4 GiB RAM, 20 GiB scratch disk, 256 PIDs, 20-minute wall clock and 10 MiB retained logs. These defaults must be validated against real builds before acceptance and remain configurable only within hard global maxima.
- Bound concurrent builds globally and per owner. Queue saturation returns a truthful retryable response; it does not spawn an unbounded VM.
- Egress is default-deny. Allow HTTPS to the exact Git source host and registry plus approved package/base-image mirrors. Do not permit arbitrary RFC1918, link-local, loopback, metadata, host or control-plane destinations. Apply DNS/IP validation at connection time, not only at request validation.
- Source checkout uses a short-lived read-only credential, if needed, scoped to the one repository. Registry push uses a different short-lived token scoped to one repository namespace. Credentials are injected as BuildKit secrets or short-lived files outside the build context and must not be copied into layers, logs, cache exports, provenance or operation payloads.
- No user-provided build arguments may contain secret values. Reject secret-like keys and values in persisted metadata. Build logs are bounded and scrubbed, but scrubbing is defense in depth—not permission to pass secrets to arbitrary build steps.
- Disable insecure BuildKit entitlements, host networking, device access and privileged execution. Do not export shared mutable caches in the first release.
- Cancellation and timeout terminate the VM, revoke credentials, remove scratch disks and release concurrency reservations. A janitor reconciles abandoned VM/disk resources after coordinator crashes.
- Never retry an ambiguous registry push by creating a mutable tag as the source of truth. Resolve the registry digest and verify it against the expected immutable artifact identity before recording success.

## 5. Build receipt and provenance

A successful build returns a bounded receipt containing:

- build operation ID and builder identity/version;
- repository canonical URL, immutable commit SHA and Dockerfile path;
- digest of the build recipe and normalized non-secret build parameters;
- base-image digests actually resolved;
- OCI registry/repository and immutable image digest;
- start/end timestamps and terminal result;
- guest image/kernel and Firecracker version;
- provenance statement digest and signature/key identifier.

The receipt must be independently verifiable against the registry artifact. A hash alone is an integrity fingerprint, not a trusted signature or trusted timestamp. Signing key custody belongs to a dedicated signing boundary; the build guest must not receive the signing private key.

## 6. Failure, recovery and cleanup

- A build is not successful until the registry digest and receipt have been verified and persisted by ARSY.
- Coordinator restart must discover and terminate/reconcile orphaned VMs by operation ID; it must not adopt an unknown VM.
- Lost guest/worker lease invalidates the old coordinator's ability to publish a terminal result.
- Registry timeout after push is an ambiguous outcome: query by immutable digest/manifest identity before retry; never assume failure means no artifact was pushed.
- Cleanup is idempotent and scoped to resources carrying the exact operation ID. Never delete unrelated images, volumes, networks or VMs.
- Failed cleanup raises an operational alert and leaves the build unavailable until the orphan is reconciled.

## 7. Proof required before acceptance

Issue #182 remains open until a reproducible, disposable CI experiment proves all of the following on the actual selected runner class:

1. A malicious Dockerfile cannot read a sentinel ARSY secret, host environment, host filesystem file, sibling-job file, Docker socket or VM host control socket.
2. A malicious Dockerfile cannot reach loopback, private infrastructure, link-local metadata, ARSY, PostgreSQL, Redis or an undeclared external destination.
3. CPU, memory, disk, PID, log and wall-clock ceilings are enforced and terminate the guest.
4. Cancellation, coordinator termination and forced VM exit all clean up guest resources and revoke temporary credentials.
5. A successful build produces an OCI digest and independently verifiable provenance receipt.
6. A failed or interrupted build cannot leave an untracked VM/disk or publish a false successful operation.
7. The proof is rerunnable from a documented command and pinned runner/guest/builder versions.

The experiment must use synthetic credentials and disposable registry/repository resources. It must not use production credentials or deploy an application.

## 8. Consequences

### Positive

- Arbitrary Dockerfile commands are separated from ARSY and the host control plane by a VM boundary.
- Build and deployment remain independent authorities and failure domains.
- Immutable artifact identity and provenance become explicit inputs to deployment authorization.
- Unsupported host capabilities fail closed rather than weakening isolation silently.

### Costs and limitations

- Firecracker requires compatible Linux/KVM hosts and adds VM lifecycle, guest image, patching, observability and capacity operations.
- The first release supports Dockerfile builds only and a bounded platform matrix.
- Network egress proxying and artifact-signing custody are required supporting services, not optional documentation.
- The proposal does not select a registry vendor or assert that a registry account/credential exists.
- The proposal does not authorize production execution, public build APIs, Compose builds or marketplace-style multi-tenant use.


## 8. Runner capability observation — 2026-11-08

A disposable GitHub Actions runner preflight was added in this PR and executed on the repository's `ubuntu-24.04` hosted runner:

- Host OS/architecture: Linux x86_64 — available.
- cgroup v2 CPU/memory/PID controllers — available.
- Kernel seccomp action list — available.
- TUN device — available.
- `/dev/kvm` — **NOT AVAILABLE** (missing, not a character device, or not readable/writable).
- ARSY/ORACLE database, Redis and Docker endpoint credential variables checked by the preflight — not present.

The workflow is intentionally informational: it exits successfully so ordinary repository CI remains usable, while its summary records the KVM result as **NO-GO**. The result is not a Firecracker proof. It establishes that the standard hosted runner used by this PR cannot be the v1 Firecracker execution host. The actual builder/proof therefore requires an explicitly provisioned, access-controlled self-hosted KVM runner class; no such runner is currently verified or registered in this repository's execution environment.

The `--require-kvm` preflight mode must be used as a hard gate by any future KVM integration workflow. The `--full` mode additionally verifies the pinned Firecracker v1.17.0 and jailer binary digests, guest kernel/rootfs digests, non-root jailer identity and root-owned non-writable chroot base. These checks still do not replace adversarial guest/network/resource/cleanup tests.


## 8. Dedicated KVM runner gate

The hosted `ubuntu-24.04` runner has no accessible `/dev/kvm`, so it is not an approved Firecracker execution host. A later proof run must use a separately provisioned runner with all of these properties:

- Linux x86_64 host with hardware virtualization enabled and a readable/writable `/dev/kvm` character device.
- Dedicated GitHub Actions runner group scoped to this repository and this workflow only; label exactly `self-hosted`, `linux`, `x64`, `kvm`.
- No use by untrusted pull-request workflows, fork builds, or arbitrary repository workflows. The KVM job in this repository is manual-dispatch only and executes only when the selected ref is protected `main`.
- No ARSY, ORACLE, database, Redis, registry or production Docker credentials in runner environment. The preflight explicitly checks the known control-plane/Docker variables and suppresses values.
- Host-owned, pinned Firecracker and jailer binaries, guest kernel/rootfs images, and a root-owned non-writable jailer chroot base. Binary and guest asset SHA-256 values must be configured on the host for the `--full` preflight.
- cgroup CPU/memory/PID limits, seccomp, TUN and a controlled egress boundary. The runner itself must not have a route to production data/control-plane networks.
- The runner registration credential is not stored in repository secrets or on the guest builder; use the organization's approved short-lived runner registration and lifecycle process.

The workflow now keeps the hosted-runner report informational for normal PR CI and adds a separate manual-dispatch-only `dedicated-kvm-proof-preflight` job. It selects only the above runner labels, checks out protected `main`, and runs the hard-failing `--full` preflight. It cannot silently fall back to a GitHub-hosted runner. If no such runner is registered, this job cannot run; that is an infrastructure blocker, not a reason to weaken the isolation boundary.

The dedicated-runner job only checks host prerequisites and pinned asset digests. It does **not** establish the adversarial guest, network, resource, credential-isolation, cancellation, provenance or cleanup proof in §7.

## 9. Acceptance state

**Proposed / NOT ACCEPTED.** The option analysis, trust boundary and hosted-runner KVM NO-GO are documented. No eligible self-hosted KVM runner is yet evidenced, and no adversarial VM/network/resource/cleanup proof has run. Maintainer review and explicit acceptance are outstanding. Issue #183 must not start implementation until those gates are satisfied.
