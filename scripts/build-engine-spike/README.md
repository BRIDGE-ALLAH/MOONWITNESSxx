# Rootless BuildKit isolation spike

This is a bounded, disposable-VM proof for ADR 0003. It is not a production Build Engine or deployment worker.

## What it verifies

- Downloads pinned BuildKit v0.34.2 and RootlessKit v3.3.0 and checks the GitHub-published SHA-256 asset digests.
- Starts BuildKit as a dedicated unprivileged OS identity, outside the Docker group, inside a RootlessKit/slirp4netns network namespace.
- Uses cgroup v2 limits (2 GiB memory, 2 CPU quota, 256 tasks, 240-second worker lifetime), a 1 GiB tmpfs scratch volume, a 180-second build timeout, a 10 MiB build-log file limit, a 256 MiB context ceiling and a 1 GiB OCI output ceiling.
- Injects a non-secret ARSY sentinel into the daemon environment and proves a malicious Dockerfile cannot see it.
- Proves the build step cannot see the host Docker socket or a host-only UNIX socket, and cannot reach a host-loopback HTTP sentinel.
- Proves `RUN --network=none` cannot reach an external IP.
- Exports an OCI image plus BuildKit provenance, independently verifies OCI blob hashes, binds the source commit into image metadata and checks the provenance subject/source commit.
- Stops the worker, verifies no worker processes remain, unmounts scratch storage and removes the temporary OS identity/state.

The GitHub Actions job runs on a fresh `ubuntu-24.04` hosted VM and does not mount or use the runner Docker socket for the build. The temporary AppArmor user-namespace sysctl adjustment is confined to that disposable CI VM; it is not a production deployment instruction.

## What it does not prove

- A production VM/network firewall or NSG allowlist for all registry, Git, DNS and build-step egress paths.
- Cross-tenant cache isolation, a production secret broker, registry push credentials, cancellation/reconciliation against a real registry, or a per-build VM provider.
- Production image signing, SBOM policy enforcement, or the complete ARSY orchestration lifecycle.

Those remain explicit production gates in ADR 0003. A passing spike is necessary evidence, not production approval.
