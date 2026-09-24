#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
SESSION="verify-split-bill-dev"
MARKER="/tmp/verify-split-bill-dev.pid"
TMUX=(tmux -f /exec-daemon/tmux.portal.conf)

home_ok() {
  curl -sf http://127.0.0.1:3000/ | grep -q '饭局名称'
}

started=0
if home_ok; then
  echo "reuse" >"$MARKER"
  echo "split-bill dev already up at http://127.0.0.1:3000 (reuse existing server)"
  exit 0
fi

if ! "${TMUX[@]}" has-session -t "=$SESSION" 2>/dev/null; then
  "${TMUX[@]}" new-session -d -s "$SESSION" -c "$ROOT" -- "${SHELL:-bash}" -l
  "${TMUX[@]}" send-keys -t "$SESSION:0.0" "cd \"$ROOT\" && npm run dev" C-m
  started=1
fi
echo "$SESSION" >"$MARKER"

end=$((SECONDS + 120))
while (( SECONDS < end )); do
  if home_ok; then
    echo "split-bill dev ready at http://127.0.0.1:3000 session=${SESSION} started=${started}"
    exit 0
  fi
  sleep 1
done
echo "Timed out waiting for home page at http://127.0.0.1:3000" >&2
exit 1
