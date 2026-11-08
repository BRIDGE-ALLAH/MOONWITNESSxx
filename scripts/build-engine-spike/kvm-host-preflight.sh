#!/usr/bin/env bash
# Informational host preflight for the proposed Firecracker Build Engine.
# This script does not launch a VM and is not an isolation/security proof.
set -uo pipefail

mode="report"
case "${1:-}" in
  ""|--report-only) mode="report" ;;
  --require-kvm) mode="require-kvm" ;;
  --full) mode="full" ;;
  *) printf 'Usage: %s [--report-only|--require-kvm|--full]\n' "$0" >&2; exit 64 ;;
esac

failed=0
checks=()
record() {
  local label="$1" ok="$2" detail="$3"
  if [[ "$ok" == "true" ]]; then
    checks+=("| ${label} | PASS | ${detail} |")
  else
    checks+=("| ${label} | NO-GO | ${detail} |")
    failed=1
  fi
}
has_command() { command -v "$1" >/dev/null 2>&1; }
safe_uint() { [[ "$1" =~ ^[1-9][0-9]{0,8}$ ]]; }

os="$(uname -s 2>/dev/null || printf unknown)"
arch="$(uname -m 2>/dev/null || printf unknown)"
record "Host OS" "$([[ "$os" == Linux ]] && echo true || echo false)" "$os"
record "Host architecture" "$([[ "$arch" == x86_64 || "$arch" == aarch64 ]] && echo true || echo false)" "$arch"

kvm_ok=false
if [[ -c /dev/kvm && -r /dev/kvm && -w /dev/kvm ]]; then kvm_ok=true; fi
record "/dev/kvm" "$kvm_ok" "$([[ "$kvm_ok" == true ]] && echo 'character device is readable and writable' || echo 'missing, not a character device, or not readable/writable')"

cgroup_ok=false
cgroup_detail="required cpu, memory and pids controllers not found"
if [[ -r /sys/fs/cgroup/cgroup.controllers ]]; then
  controllers="$(cat /sys/fs/cgroup/cgroup.controllers 2>/dev/null)"
  if grep -qw cpu <<<"$controllers" && grep -qw memory <<<"$controllers" && grep -qw pids <<<"$controllers"; then
    cgroup_ok=true
    cgroup_detail="cgroup v2 exposes cpu, memory and pids"
  fi
elif [[ -d /sys/fs/cgroup/cpu && -d /sys/fs/cgroup/memory && -d /sys/fs/cgroup/pids ]]; then
  cgroup_ok=true
  cgroup_detail="cgroup v1 cpu, memory and pids mounts exist"
fi
record "Cgroup resource controllers" "$cgroup_ok" "$cgroup_detail"

seccomp_ok=false
if [[ -r /proc/sys/kernel/seccomp/actions_avail ]] && grep -qw kill_process /proc/sys/kernel/seccomp/actions_avail; then
  seccomp_ok=true
fi
record "Kernel seccomp support" "$seccomp_ok" "$([[ "$seccomp_ok" == true ]] && echo 'seccomp action list is available' || echo 'seccomp action list is unavailable')"

tun_ok=false
if [[ -c /dev/net/tun && -r /dev/net/tun && -w /dev/net/tun ]]; then tun_ok=true; fi
record "TUN device" "$tun_ok" "$([[ "$tun_ok" == true ]] && echo 'read/write TUN character device available' || echo 'TUN device unavailable or not accessible')"

# The default GitHub-hosted runner must never receive the service credentials
# or a Docker endpoint. Values are deliberately never printed.
for name in ARSY_OPERATOR_TOKEN ORACLE_SERVICE_TOKEN DATABASE_URL REDIS_URL DOCKER_HOST DOCKER_TLS_VERIFY DOCKER_CERT_PATH; do
  if [[ -n "${!name-}" ]]; then
    record "Sensitive runner env: $name" false "variable is set; value suppressed"
  else
    record "Sensitive runner env: $name" true "not present"
  fi
done

if [[ "$mode" == full ]]; then
  expected_version="${MW_FIRECRACKER_VERSION:-v1.17.0}"
  firecracker_bin="$(command -v firecracker 2>/dev/null || true)"
  jailer_bin="$(command -v jailer 2>/dev/null || true)"
  record "Firecracker binary" "$([[ -n "$firecracker_bin" && -x "$firecracker_bin" ]] && echo true || echo false)" "$([[ -n "$firecracker_bin" ]] && echo 'executable found' || echo 'executable not found')"
  record "Jailer binary" "$([[ -n "$jailer_bin" && -x "$jailer_bin" ]] && echo true || echo false)" "$([[ -n "$jailer_bin" ]] && echo 'executable found' || echo 'executable not found')"

  if [[ -n "$firecracker_bin" ]]; then
    version="$("$firecracker_bin" --version 2>&1 | head -n 1 || true)"
    record "Firecracker version" "$(grep -Fq "$expected_version" <<<"$version" && echo true || echo false)" "$([[ -n "$version" ]] && echo "$version" || echo 'version command returned no output')"
    binary_hash="${MW_FIRECRACKER_BINARY_SHA256:-}"
    actual_hash="$(sha256sum "$firecracker_bin" 2>/dev/null | awk '{print $1}')"
    record "Firecracker binary digest" "$([[ "$binary_hash" =~ ^[a-f0-9]{64}$ && "$actual_hash" == "$binary_hash" ]] && echo true || echo false)" "configured SHA-256 must match installed binary"
  else
    record "Firecracker version" false "binary unavailable"
    record "Firecracker binary digest" false "binary unavailable"
  fi

  if [[ -n "$jailer_bin" ]]; then
    jailer_hash="${MW_JAILER_BINARY_SHA256:-}"
    actual_jailer_hash="$(sha256sum "$jailer_bin" 2>/dev/null | awk '{print $1}')"
    record "Jailer binary digest" "$([[ "$jailer_hash" =~ ^[a-f0-9]{64}$ && "$actual_jailer_hash" == "$jailer_hash" ]] && echo true || echo false)" "configured SHA-256 must match installed binary"
  else
    record "Jailer binary digest" false "jailer unavailable"
  fi

  for item in GUEST_KERNEL GUEST_ROOTFS; do
    path_var="MW_FIRECRACKER_${item}"
    hash_var="MW_FIRECRACKER_${item}_SHA256"
    path="${!path_var-}"
    expected="${!hash_var-}"
    if [[ -n "$path" && -f "$path" && -r "$path" && "$expected" =~ ^[a-f0-9]{64}$ ]]; then
      actual="$(sha256sum "$path" 2>/dev/null | awk '{print $1}')"
      record "$item asset digest" "$([[ "$actual" == "$expected" ]] && echo true || echo false)" "configured SHA-256 must match readable asset"
    else
      record "$item asset digest" false "asset path and 64-character expected SHA-256 are required"
    fi
  done

  uid="${MW_FIRECRACKER_UID:-}"
  gid="${MW_FIRECRACKER_GID:-}"
  record "Dedicated non-root jailer identity" "$([[ "$uid" =~ ^[1-9][0-9]{0,8}$ && "$gid" =~ ^[1-9][0-9]{0,8}$ ]] && echo true || echo false)" "MW_FIRECRACKER_UID and MW_FIRECRACKER_GID must be numeric and non-zero"

  chroot_base="${MW_FIRECRACKER_CHROOT_BASE_DIR:-}"
  chroot_ok=false
  if [[ -n "$chroot_base" && -d "$chroot_base" ]]; then
    owner="$(stat -c '%u' "$chroot_base" 2>/dev/null || printf unknown)"
    permissions="$(stat -c '%a' "$chroot_base" 2>/dev/null || printf 777)"
    perm_value=$((8#$permissions))
    if [[ "$owner" == 0 ]] && (( (perm_value & 022) == 0 )); then chroot_ok=true; fi
  fi
  record "Jailer chroot base" "$chroot_ok" "must exist, be root-owned and not group/world-writable"
fi

printf '\nBuild Engine host preflight: %s\n' "$([[ "$failed" == 0 ]] && echo 'HOST PREREQUISITES PASS' || echo 'NO-GO')"
printf '| Check | Result | Evidence |\n|---|---|---|\n'
for row in "${checks[@]}"; do printf '%s\n' "$row"; done

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    printf '## Build Engine KVM host preflight\n\n'
    printf '**Result:** %s\n\n' "$([[ "$failed" == 0 ]] && echo 'HOST PREREQUISITES PASS' || echo 'NO-GO')"
    printf '| Check | Result | Evidence |\n|---|---|---|\n'
    for row in "${checks[@]}"; do printf '%s\n' "$row"; done
    printf '\nThis preflight does not launch Firecracker or prove isolation. It only checks the reported host prerequisites.\n'
  } >>"$GITHUB_STEP_SUMMARY"
fi

if [[ "$mode" == report ]]; then exit 0; fi
if [[ "$failed" != 0 ]]; then exit 1; fi
