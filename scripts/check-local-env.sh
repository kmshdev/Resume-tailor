#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/apps/backend"
FRONTEND_DIR="$ROOT_DIR/apps/frontend"
REQUIRED_PYTHON_MAJOR="3"
REQUIRED_PYTHON_MINOR="13"
REQUIRED_NODE_MAJOR="22"

info() {
  printf '[check] %s\n' "$1"
}

fail() {
  printf '[check] ERROR: %s\n' "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

version_major() {
  printf '%s' "$1" | sed -E 's/^v?([0-9]+).*/\1/'
}

python_version_parts() {
  python3 - <<'PY'
import sys
print(f"{sys.version_info.major} {sys.version_info.minor}")
PY
}

info "checking required tools"

command_exists node || fail "Node.js is required. Install Node.js $REQUIRED_NODE_MAJOR or newer."
node_major="$(version_major "$(node --version)")"
if [ "$node_major" -lt "$REQUIRED_NODE_MAJOR" ]; then
  fail "Node.js $REQUIRED_NODE_MAJOR+ is required; found $(node --version)."
fi

command_exists npm || fail "npm is required and should be installed with Node.js."
command_exists python3 || fail "Python $REQUIRED_PYTHON_MAJOR.$REQUIRED_PYTHON_MINOR+ is required."
read -r python_major python_minor < <(python_version_parts)
if [ "$python_major" -lt "$REQUIRED_PYTHON_MAJOR" ] ||
  { [ "$python_major" -eq "$REQUIRED_PYTHON_MAJOR" ] && [ "$python_minor" -lt "$REQUIRED_PYTHON_MINOR" ]; }; then
  fail "Python $REQUIRED_PYTHON_MAJOR.$REQUIRED_PYTHON_MINOR+ is required; found $(python3 --version)."
fi

command_exists uv || fail "uv is required. Install it from https://docs.astral.sh/uv/."

info "checking project files"
[ -f "$BACKEND_DIR/pyproject.toml" ] || fail "missing backend pyproject.toml"
[ -f "$FRONTEND_DIR/package.json" ] || fail "missing frontend package.json"
[ -f "$FRONTEND_DIR/package-lock.json" ] || fail "missing frontend package-lock.json"

info "local toolchain looks ready"
