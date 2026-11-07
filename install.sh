#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Node.js >=22 is required. Install Node.js, then rerun this script.' >&2
  exit 1
fi

exec node "$ROOT_DIR/scripts/moonwitness.mjs" install "$@"
