#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"

major="$(node -p "process.versions.node.split('.')[0]")"
if (( major < 22 )); then
  echo "Node >= 22 required, got $(node -v)" >&2
  exit 1
fi

body="$(curl -sf http://127.0.0.1:3000/ || true)"
if [[ -z "$body" ]]; then
  echo "http://127.0.0.1:3000 not reachable" >&2
  exit 1
fi
if ! grep -q '聚餐分账' <<<"$body"; then
  echo "Home page missing expected title" >&2
  exit 1
fi

SESSION="verify-split-bill-dev"
if tmux -f /exec-daemon/tmux.portal.conf has-session -t "=$SESSION" 2>/dev/null; then
  echo "doctor ok: node $(node -v), home 200, tmux session $SESSION"
else
  echo "doctor ok: node $(node -v), home 200 (dev server up; tmux session $SESSION not found — external dev?)"
fi
