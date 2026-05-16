#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FALLBACK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_TREE="${CODEX_SOURCE_TREE_PATH:-$FALLBACK_ROOT}"
WORKTREE="${CODEX_WORKTREE_PATH:-$FALLBACK_ROOT}"

info() {
  printf '[codex-worktree-setup] %s\n' "$1"
}

copy_secret_if_present() {
  local relative_path="$1"
  local source_file="$SOURCE_TREE/$relative_path"
  local target_file="$WORKTREE/$relative_path"

  if [ "$SOURCE_TREE" = "$WORKTREE" ]; then
    return
  fi

  if [ ! -f "$source_file" ]; then
    return
  fi

  if [ -f "$target_file" ]; then
    info "keeping existing $relative_path"
    return
  fi

  mkdir -p "$(dirname "$target_file")"
  cp -p "$source_file" "$target_file"
  info "copied local $relative_path from source checkout"
}

if [ ! -e "$WORKTREE/.git" ]; then
  printf '[codex-worktree-setup] %s is not a git checkout\n' "$WORKTREE" >&2
  exit 1
fi

if [ ! -x "$WORKTREE/scripts/setup-local.sh" ]; then
  printf '[codex-worktree-setup] missing executable scripts/setup-local.sh in %s\n' "$WORKTREE" >&2
  exit 1
fi

info "source checkout: $SOURCE_TREE"
info "worktree checkout: $WORKTREE"

copy_secret_if_present "apps/backend/.env"
copy_secret_if_present "apps/frontend/.env.local"

cd "$WORKTREE"
scripts/setup-local.sh --skip-browser
