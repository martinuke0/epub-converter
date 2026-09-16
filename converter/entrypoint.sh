#!/bin/bash
set -euo pipefail
# Soft virtual display helps some Calibre PDF/Qt paths
export DISPLAY="${DISPLAY:-:99}"
if ! pgrep -x Xvfb >/dev/null 2>&1; then
  Xvfb :99 -screen 0 1024x768x24 -ac +extension GLX +render -noreset >/tmp/xvfb.log 2>&1 &
  sleep 0.5
fi
exec python3 /app/server.py
