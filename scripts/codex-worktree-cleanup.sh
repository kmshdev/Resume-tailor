#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FALLBACK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREE="${CODEX_WORKTREE_PATH:-$(git -C "$FALLBACK_ROOT" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$FALLBACK_ROOT")}"
CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
CODEX_WORKTREES_DIR="$CODEX_HOME_DIR/worktrees"

info() {
  printf '[codex-worktree-cleanup] %s\n' "$1"
}

case "$WORKTREE/" in
  "$CODEX_WORKTREES_DIR"/*)
    ;;
  *)
    info "skipping cleanup outside Codex-managed worktrees: $WORKTREE"
    exit 0
    ;;
esac

info "cleaning generated files from $WORKTREE"

rm -rf \
  "$WORKTREE/apps/backend/.venv" \
  "$WORKTREE/apps/backend/.pytest_cache" \
  "$WORKTREE/apps/frontend/.next" \
  "$WORKTREE/apps/frontend/node_modules" \
  "$WORKTREE/.pytest_cache"

rm -f \
  "$WORKTREE/apps/backend/.env" \
  "$WORKTREE/apps/frontend/.env.local"

info "cleanup complete"
