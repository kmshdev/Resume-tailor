#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/apps/backend"
FRONTEND_DIR="$ROOT_DIR/apps/frontend"
INSTALL_BROWSER=1

usage() {
  cat <<'EOF'
Usage: scripts/setup-local.sh [--skip-browser]

Bootstraps Resume Matcher for local development:
  - verifies Node.js, npm, Python, and uv
  - copies backend/frontend env templates if missing
  - installs backend dependencies with uv
  - installs Chromium for Playwright PDF generation
  - installs frontend dependencies with npm

Options:
  --skip-browser    Skip Playwright Chromium installation.
  -h, --help        Show this help.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-browser)
      INSTALL_BROWSER=0
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

info() {
  printf '[setup] %s\n' "$1"
}

copy_if_missing() {
  local source_file="$1"
  local target_file="$2"

  if [ -f "$target_file" ]; then
    info "keeping existing ${target_file#$ROOT_DIR/}"
    return
  fi

  cp "$source_file" "$target_file"
  info "created ${target_file#$ROOT_DIR/}"
}

info "checking local toolchain"
"$ROOT_DIR/scripts/check-local-env.sh"

info "preparing env files"
copy_if_missing "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
copy_if_missing "$FRONTEND_DIR/.env.sample" "$FRONTEND_DIR/.env.local"

if [ -n "${OPENAI_API_KEY:-}" ] && [ -z "${LLM_API_KEY:-}" ]; then
  info "OPENAI_API_KEY is set in the shell; add it to apps/backend/.env as LLM_API_KEY for this app"
fi

info "installing backend dependencies"
(
  cd "$BACKEND_DIR"
  uv sync --extra dev
)

if [ "$INSTALL_BROWSER" -eq 1 ]; then
  info "installing Chromium for Playwright PDF generation"
  (
    cd "$BACKEND_DIR"
    uv run python -m playwright install chromium
  )
else
  info "skipping Playwright Chromium installation"
fi

info "installing frontend dependencies"
(
  cd "$FRONTEND_DIR"
  npm install
)

info "local setup complete"
info "start backend:  cd apps/backend && uv run uvicorn app.main:app --reload --port 8000"
info "start frontend: cd apps/frontend && npm run dev"
