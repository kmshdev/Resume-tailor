#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE="${RAILWAY_SERVICE:-resume-matcher}"
ENVIRONMENT="${RAILWAY_ENVIRONMENT:-production}"
MESSAGE="${RAILWAY_DEPLOY_MESSAGE:-Deploy Resume Matcher from Codex action}"
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: scripts/deploy-railway.sh [--dry-run]

Deploys the current checkout to Railway with:
  railway up --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENVIRONMENT" --detach -m "$RAILWAY_DEPLOY_MESSAGE"

Environment defaults:
  RAILWAY_SERVICE=resume-matcher
  RAILWAY_ENVIRONMENT=production
  RAILWAY_DEPLOY_MESSAGE="Deploy Resume Matcher from Codex action"

Options:
  --dry-run    Validate Railway CLI/context and print the deploy command.
  -h, --help   Show this help.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
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
  printf '[railway-deploy] %s\n' "$1"
}

if ! command -v railway >/dev/null 2>&1; then
  printf '[railway-deploy] Railway CLI is not installed or not on PATH\n' >&2
  exit 1
fi

cd "$ROOT_DIR"

info "checking Railway project link"
railway status --json >/dev/null

info "target service: $SERVICE"
info "target environment: $ENVIRONMENT"

if [ "$DRY_RUN" -eq 1 ]; then
  printf 'railway up --service %q --environment %q --detach -m %q\n' "$SERVICE" "$ENVIRONMENT" "$MESSAGE"
  exit 0
fi

railway up --service "$SERVICE" --environment "$ENVIRONMENT" --detach -m "$MESSAGE"
