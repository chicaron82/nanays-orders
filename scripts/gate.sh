#!/usr/bin/env bash
# Run all gates from the repo root, regardless of the caller's cwd.
# DiZee: always invoke this by absolute path so there's no ambient-cwd ambiguity.
#   bash /home/ronnie/Kitchen/nanays-orders/scripts/gate.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── lint ───────────────────────────────────────"
npm run lint

echo "── typecheck ──────────────────────────────────"
npx tsc --noEmit

echo "── tests ──────────────────────────────────────"
npm test

echo "── gate: all green ────────────────────────────"
