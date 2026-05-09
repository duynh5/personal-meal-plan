#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$REPO_DIR/logs"

mkdir -p "$LOG_DIR"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

cd "$REPO_DIR"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "Would run deterministic monthly meal planning from $REPO_DIR"
  exit 0
fi

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) Running monthly meal planning."
node scripts/generate-meal-plan.mjs
node scripts/validate-plan.mjs
node scripts/render-site.mjs
