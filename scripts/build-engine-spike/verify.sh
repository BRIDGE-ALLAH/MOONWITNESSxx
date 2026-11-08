#!/usr/bin/env bash
set -Eeuo pipefail

BUILDKIT_VERSION="0.34.2"
ROOTLESSKIT_VERSION="3.3.0"
BUILDER_USER="mw-build-spike-$$"
UNIT="mw-buildkit-spike-$$"
HOST_SOCKET="/tmp/build-engine-build-spike-${BASHPID}.sock"
HOST_PORT="$((18000 + BASHPID % 40000))"
SOURCE_COMMIT="${GITHUB_SHA:-local-spike}"
TMP_DIR="$(mktemp -d /tmp/mw-build-engine-spike.XXXXXX)"
WORK="$TMP_DIR/work"
BUILDER_HOME="$TMP_DIR/home"
RUNTIME_DIR="$WORK/runtime"
STATE_DIR="$WORK/rootlesskit-state"
BUILDKIT_ROOT="$WORK/buildkit-root"
CONFIG="$WORK/buildkitd.toml"
CONTEXT="$WORK/context"
OUTPUT="$WORK/image.oci.tar"
METADATA="$WORK/metadata.json"
BUILD_LOG="$WORK/build.log"
RUN_SCRIPT="$TMP_DIR/run-build.sh"
DOCKER_CONFIG="$WORK/docker-config"
BUILDER_NAME="mw-build-remote-${BASHPID}"
EXTRACT="$WORK/extracted"
BUILDER_UID=""
HOST_PID=""
WORK_MOUNTED=0

fail() { echo "BUILD ENGINE SPIKE FAILED: $*" >&2; exit 1; }
require() { command -v "$1" >/dev/null 2>&1 || fail "missing prerequisite: $1"; }

for cmd in curl jq sha256sum tar python3 systemd-run systemctl mount umount useradd userdel mktemp docker; do require "$cmd"; done
[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail "GITHUB_SHA must be a 40-character commit SHA"
require sudo
require timeout
require slirp4netns
require newuidmap
require newgidmap
docker buildx version >/dev/null || fail "Docker Buildx plugin is required for native provenance attestations"

[[ "$(uname -s)" == "Linux" ]] || fail "Linux worker required"
[[ -f /etc/subuid && -f /etc/subgid ]] || fail "subuid/subgid support required"
[[ -d /sys/fs/cgroup ]] || fail "cgroup v2 worker limits required"
grep -q 'cgroup2' /proc/mounts || fail "cgroup v2 is not mounted"

mkdir -p "$TMP_DIR" "$WORK"
chmod 700 "$TMP_DIR"
sudo mount -t tmpfs -o size=1g,mode=0755 tmpfs "$WORK"
WORK_MOUNTED=1
sudo chown "$(id -u):$(id -g)" "$WORK"

cleanup() {
  set +e
  if [[ -n "$HOST_PID" ]]; then kill "$HOST_PID" >/dev/null 2>&1; wait "$HOST_PID" >/dev/null 2>&1; fi
  rm -f "$HOST_SOCKET"
  if [[ -n "$UNIT" ]]; then
    sudo systemctl stop "$UNIT.service" >/dev/null 2>&1
    sudo systemctl reset-failed "$UNIT.service" >/dev/null 2>&1
  fi
  if [[ -n "$BUILDER_UID" ]]; then
    if pgrep -u "$BUILDER_UID" -f 'buildkitd|rootlesskit|slirp4netns' >/dev/null 2>&1; then
      echo "worker processes remained after systemd stop" >&2
      pgrep -a -u "$BUILDER_UID" -f 'buildkitd|rootlesskit' >&2
    fi
  fi
  if [[ "${WORK_MOUNTED:-0}" == "1" ]]; then sudo umount "$WORK" >/dev/null 2>&1; fi
  if id "$BUILDER_USER" >/dev/null 2>&1; then sudo userdel -r "$BUILDER_USER" >/dev/null 2>&1; fi
  sudo sed -i "/^$BUILDER_USER:/d" /etc/subuid /etc/subgid >/dev/null 2>&1
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

asset_digest() {
  local repo_path="$1" tag="$2" asset="$3" metadata digest
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    metadata="$(curl -fsSL -H "Authorization: Bearer $GITHUB_TOKEN" -H 'Accept: application/vnd.github+json' "https://api.github.com/repos/$repo_path/releases/tags/$tag")"
  else
    metadata="$(curl -fsSL -H 'Accept: application/vnd.github+json' "https://api.github.com/repos/$repo_path/releases/tags/$tag")"
  fi
  digest="$(jq -r --arg name "$asset" '.assets[] | select(.name == $name) | .digest // empty' <<<"$metadata")"
  [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "GitHub did not publish a verifiable SHA-256 digest for $asset"
  printf '%s' "${digest#sha256:}"
}

download_verified() {
  local repo_path="$1" tag="$2" asset="$3" destination="$4"
  local expected actual
  expected="$(asset_digest "$repo_path" "$tag" "$asset")"
  curl -fsSL --retry 3 "https://github.com/$repo_path/releases/download/$tag/$asset" -o "$destination"
  actual="$(sha256sum "$destination" | awk '{print $1}')"
  [[ "$actual" == "$expected" ]] || fail "SHA-256 mismatch for $asset"
}

mkdir -p "$TMP_DIR/buildkit" "$TMP_DIR/rootlesskit"
chmod 755 "$TMP_DIR"
download_verified "moby/buildkit" "v$BUILDKIT_VERSION" "buildkit-v$BUILDKIT_VERSION.linux-amd64.tar.gz" "$TMP_DIR/buildkit.tar.gz"
download_verified "rootless-containers/rootlesskit" "v$ROOTLESSKIT_VERSION" "rootlesskit-x86_64.tar.gz" "$TMP_DIR/rootlesskit.tar.gz"
tar -xzf "$TMP_DIR/buildkit.tar.gz" -C "$TMP_DIR/buildkit"
tar -xzf "$TMP_DIR/rootlesskit.tar.gz" -C "$TMP_DIR/rootlesskit"
BUILDCTL="$(find "$TMP_DIR/buildkit" -type f -name buildctl -print -quit)"
BUILDKITD="$(find "$TMP_DIR/buildkit" -type f -name buildkitd -print -quit)"
ROOTLESSKIT="$(find "$TMP_DIR/rootlesskit" -type f -name rootlesskit -print -quit)"
chmod -R a+rX "$TMP_DIR/buildkit" "$TMP_DIR/rootlesskit"
[[ -x "$BUILDCTL" && -x "$BUILDKITD" && -x "$ROOTLESSKIT" ]] || fail "pinned BuildKit/RootlessKit binaries not found"
"$BUILDKITD" --version | grep -F "$BUILDKIT_VERSION" >/dev/null || fail "unexpected BuildKit version"
"$ROOTLESSKIT" --version | grep -F "$ROOTLESSKIT_VERSION" >/dev/null || fail "unexpected RootlessKit version"

sudo useradd --system --create-home --home-dir "$BUILDER_HOME" --shell /usr/sbin/nologin "$BUILDER_USER"
BUILDER_UID="$(id -u "$BUILDER_USER")"
sudo sh -c "printf '%s:2000000:65536\n' '$BUILDER_USER' >> /etc/subuid"
sudo sh -c "printf '%s:2000000:65536\n' '$BUILDER_USER' >> /etc/subgid"
sudo chown -R "$BUILDER_USER:$BUILDER_USER" "$BUILDER_HOME"
id -nG "$BUILDER_USER" | tr ' ' '\n' | grep -qx docker && fail "builder identity is in the docker group"
if [[ -S /var/run/docker.sock ]] && sudo -u "$BUILDER_USER" test -r /var/run/docker.sock; then
  fail "builder identity can read the host Docker socket"
fi

mkdir -p "$RUNTIME_DIR" "$STATE_DIR" "$BUILDKIT_ROOT" "$CONTEXT" "$EXTRACT" "$WORK/tmp" "$DOCKER_CONFIG"
chmod 700 "$RUNTIME_DIR" "$STATE_DIR"
cat > "$CONFIG" <<EOF
root = "$BUILDKIT_ROOT"
proxyNetwork = true
insecure-entitlements = []

[worker.oci]
  rootless = true
  snapshotter = "native"
  noProcessSandbox = false
  max-parallelism = 2
  gc = true
  maxUsedSpace = "512MB"
EOF
cp -R "$(dirname "$0")/context/." "$CONTEXT/"
sudo chown -R "$BUILDER_USER:$BUILDER_USER" "$WORK"
context_bytes="$(du -sb "$CONTEXT" | awk '{print $1}')"
(( context_bytes <= 268435456 )) || fail "build context exceeds 256 MiB"

rm -f "$HOST_SOCKET"
python3 - "$HOST_SOCKET" "$HOST_PORT" <<'PY' &
import socket, sys, threading
socket_path, port = sys.argv[1], int(sys.argv[2])
unix_server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
unix_server.bind(socket_path)
unix_server.listen(4)
def serve_unix():
    while True:
        conn, _ = unix_server.accept()
        conn.close()
threading.Thread(target=serve_unix, daemon=True).start()
tcp_server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
tcp_server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
tcp_server.bind(("127.0.0.1", port))
tcp_server.listen(4)
while True:
    conn, _ = tcp_server.accept()
    try:
        conn.recv(4096)
        conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK")
    finally:
        conn.close()
PY
HOST_PID=$!
for _ in $(seq 1 20); do [[ -S "$HOST_SOCKET" ]] && break; sleep 0.1; done
[[ -S "$HOST_SOCKET" ]] || fail "host socket sentinel did not start"
kill -0 "$HOST_PID" 2>/dev/null || fail "host loopback sentinel process exited"
curl -fsS "http://127.0.0.1:$HOST_PORT/" >/dev/null || fail "host loopback sentinel is not reachable from the host"

sudo systemd-run --no-block --collect --unit="$UNIT" \
  --property="User=$BUILDER_USER" \
  --property="Group=$BUILDER_USER" \
  --property="WorkingDirectory=$BUILDER_HOME" \
  --property="Environment=HOME=$BUILDER_HOME" \
  --property="Environment=XDG_RUNTIME_DIR=$RUNTIME_DIR" \
  --property="Environment=TMPDIR=$WORK/tmp" \
  --property="Environment=ARSY_OPERATOR_TOKEN=SPIKE_SENTINEL_NOT_A_REAL_SECRET" \
  --property="MemoryMax=2G" \
  --property="CPUQuota=200%" \
  --property="TasksMax=256" \
  --property="RuntimeMaxSec=240s" \
  --property="LimitNOFILE=65536" \
  --property="KillMode=control-group" \
  "$ROOTLESSKIT" --state-dir "$STATE_DIR" --net=slirp4netns --copy-up=/etc --disable-host-loopback \
  "$BUILDKITD" --config "$CONFIG" --addr "unix://$RUNTIME_DIR/buildkitd.sock"

SOCKET="unix://$RUNTIME_DIR/buildkitd.sock"
ready=0
for _ in $(seq 1 60); do
  if sudo -u "$BUILDER_USER" env HOME="$BUILDER_HOME" XDG_RUNTIME_DIR="$RUNTIME_DIR" "$BUILDCTL" --addr "$SOCKET" debug workers >/dev/null 2>&1; then ready=1; break; fi
  if ! sudo systemctl is-active --quiet "$UNIT.service"; then sudo journalctl -u "$UNIT.service" --no-pager -n 100 >&2; fail "rootless BuildKit worker exited during startup"; fi
  sleep 1
done
[[ "$ready" == "1" ]] || { sudo journalctl -u "$UNIT.service" --no-pager -n 100 >&2; fail "rootless BuildKit worker did not become ready"; }

memory_limit="$(sudo systemctl show "$UNIT.service" --property=MemoryMax --value)"
task_limit="$(sudo systemctl show "$UNIT.service" --property=TasksMax --value)"
[[ "$memory_limit" == "2147483648" ]] || fail "2 GiB cgroup memory limit is not active"
[[ "$task_limit" == "256" ]] || fail "PID/task cgroup limit is not active"

cat > "$RUN_SCRIPT" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
ulimit -f 20480
export DOCKER_HOST="unix://$TMP_DIR/no-docker-daemon.sock"
export DOCKER_CONFIG="$DOCKER_CONFIG"
docker buildx create --name "$BUILDER_NAME" --driver remote "$SOCKET" >/dev/null
docker buildx inspect --bootstrap "$BUILDER_NAME" >/dev/null
exec timeout 180s docker buildx build \
  --builder "$BUILDER_NAME" \
  --tag "local/build-engine-spike:$SOURCE_COMMIT" \
  --build-arg "SPIKE_SOURCE_COMMIT=$SOURCE_COMMIT" \
  --provenance=mode=max \
  --output "type=oci,dest=$OUTPUT" \
  --metadata-file "$METADATA" \
  --progress plain \
  "$CONTEXT" > "$BUILD_LOG" 2>&1
EOF
chmod 644 "$RUN_SCRIPT"
sudo -u "$BUILDER_USER" env HOME="$BUILDER_HOME" XDG_RUNTIME_DIR="$RUNTIME_DIR" bash "$RUN_SCRIPT" || {
  sudo -u "$BUILDER_USER" tail -n 160 "$BUILD_LOG" >&2 || true
  fail "rootless BuildKit adversarial build failed"
}
sudo systemctl stop "$UNIT.service"
for _ in $(seq 1 20); do
  if ! pgrep -u "$BUILDER_UID" -f 'buildkitd|rootlesskit' >/dev/null 2>&1; then break; fi
  sleep 0.25
done
if pgrep -u "$BUILDER_UID" -f 'buildkitd|rootlesskit' >/dev/null 2>&1; then
  pgrep -a -u "$BUILDER_UID" -f 'buildkitd|rootlesskit' >&2
  fail "rootless worker processes survived their build service"
fi
log_bytes="$(stat -c '%s' "$BUILD_LOG")"
(( log_bytes <= 10485760 )) || fail "build log exceeded 10 MiB"
output_bytes="$(stat -c '%s' "$OUTPUT")"
(( output_bytes <= 1073741824 )) || fail "OCI output exceeded 1 GiB"

sudo -u "$BUILDER_USER" tar -xf "$OUTPUT" -C "$EXTRACT"
INDEX="$EXTRACT/index.json"
[[ -s "$INDEX" ]] || fail "OCI index missing"
METADATA_DIGEST="$(jq -r '."containerimage.digest" // empty' "$METADATA")"
[[ "$METADATA_DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "BuildKit did not return an immutable image digest"
jq -e --arg digest "$METADATA_DIGEST" 'any(.manifests[]; .digest == $digest)' "$INDEX" >/dev/null || fail "metadata digest is not present in OCI index"
# Buildx metadata may identify an index descriptor; select the runnable image
# manifest explicitly so config/layer verification never targets an index or attestation.
# Only a platform image manifest is runnable. Attestation descriptors and nested
# indexes can lack config/layers; do not treat them as the image payload.
IMAGE_DIGEST="$(jq -r '[.manifests[]
  | select(.mediaType == "application/vnd.oci.image.manifest.v1+json" or .mediaType == "application/vnd.docker.distribution.manifest.v2+json")
  | select(.platform.os? != null and .platform.architecture? != null)
  | select((.annotations["vnd.docker.reference.type"] // "") != "attestation-manifest")
  | .digest][0] // empty' "$INDEX")"
[[ "$IMAGE_DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "OCI index has no platform image manifest"
IMAGE_HEX="${IMAGE_DIGEST#sha256:}"
IMAGE_MANIFEST="$EXTRACT/blobs/sha256/$IMAGE_HEX"
CONFIG_DIGEST="$(jq -r '.config.digest // empty' "$IMAGE_MANIFEST")"
[[ "$CONFIG_DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "selected OCI image manifest has no valid config digest"

verify_blob() {
  local digest="$1" algorithm hex file actual
  algorithm="${digest%%:*}"
  hex="${digest#*:}"
  file="$EXTRACT/blobs/$algorithm/$hex"
  [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "invalid OCI blob digest: $digest"
  [[ -s "$file" ]] || fail "missing OCI blob $digest"
  actual="$(sha256sum "$file" | awk '{print $1}')"
  [[ "$actual" == "$hex" ]] || fail "OCI blob digest mismatch: $digest"
}
verify_blob "$IMAGE_DIGEST"
IMAGE_HEX="${IMAGE_DIGEST#sha256:}"
IMAGE_MANIFEST="$EXTRACT/blobs/sha256/$IMAGE_HEX"
CONFIG_DIGEST="$(jq -r '.config.digest' "$IMAGE_MANIFEST")"
verify_blob "$CONFIG_DIGEST"
CONFIG_HEX="${CONFIG_DIGEST#sha256:}"
jq -e --arg source "$SOURCE_COMMIT" '.config.Labels["org.opencontainers.image.revision"] == $source' "$EXTRACT/blobs/sha256/$CONFIG_HEX" >/dev/null || fail "image config does not bind the source commit"

ATTEST_DIGEST="$(jq -r '.manifests[] | select(.annotations["vnd.docker.reference.type"] == "attestation-manifest") | .digest' "$INDEX" | head -n 1)"
[[ "$ATTEST_DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "OCI provenance attestation manifest missing"
verify_blob "$ATTEST_DIGEST"
ATTEST_HEX="${ATTEST_DIGEST#sha256:}"
ATTEST_MANIFEST="$EXTRACT/blobs/sha256/$ATTEST_HEX"
PAYLOAD_DIGEST="$(jq -r '.layers[] | select(.mediaType == "application/vnd.in-toto+json") | .digest' "$ATTEST_MANIFEST" | head -n 1)"
[[ "$PAYLOAD_DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "in-toto provenance payload missing"
verify_blob "$PAYLOAD_DIGEST"
PAYLOAD_HEX="${PAYLOAD_DIGEST#sha256:}"
PAYLOAD="$EXTRACT/blobs/sha256/$PAYLOAD_HEX"
jq -e '(.predicateType // "") | test("provenance")' "$PAYLOAD" >/dev/null || fail "attestation is not a provenance statement"
jq -e --arg source "$SOURCE_COMMIT" 'any(.. | strings; . == $source)' "$PAYLOAD" >/dev/null || fail "provenance does not include the exact source commit"
jq -e --arg digest "$IMAGE_HEX" 'any(.subject[]?; .digest.sha256 == $digest)' "$PAYLOAD" >/dev/null || fail "provenance subject does not match the OCI image digest"

echo "BuildKit version: $("$BUILDKITD" --version)"
echo "RootlessKit version: $("$ROOTLESSKIT" --version)"
echo "Worker cgroup: MemoryMax=$memory_limit TasksMax=$task_limit CPUQuota=200%"
echo "Source commit: $SOURCE_COMMIT"
echo "OCI image digest: $IMAGE_DIGEST"
echo "Provenance digest: $PAYLOAD_DIGEST"
echo "Build log bytes: $log_bytes; OCI bytes: $output_bytes"
echo "Isolation assertions: ARSY sentinel absent; host Docker socket inaccessible; host loopback blocked; RUN --network=none enforced."
