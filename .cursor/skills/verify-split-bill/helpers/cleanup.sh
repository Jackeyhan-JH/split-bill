#!/usr/bin/env bash
set -euo pipefail
MARKER="/tmp/verify-split-bill-dev.pid"
SESSION="verify-split-bill-dev"
TMUX=(tmux -f /exec-daemon/tmux.portal.conf)

if [[ -f "$MARKER" ]]; then
  recorded="$(cat "$MARKER")"
  if [[ "$recorded" == "$SESSION" ]] && "${TMUX[@]}" has-session -t "=$SESSION" 2>/dev/null; then
    "${TMUX[@]}" send-keys -t "$SESSION:0.0" C-c
    sleep 1
    "${TMUX[@]}" kill-session -t "$SESSION" 2>/dev/null || true
  fi
  rm -f "$MARKER"
fi
echo "cleanup done (artifacts under /opt/cursor/artifacts preserved)"
