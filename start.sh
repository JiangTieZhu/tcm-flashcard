#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PORT="${1:-8000}"

# 端口被占用时，向后寻找一个可用端口
while ! python3 - "$PORT" <<'PY'
import socket, sys
port = int(sys.argv[1])
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(("127.0.0.1", port))
    except OSError:
        sys.exit(1)
PY
do
  PORT=$((PORT + 1))
done

URL="http://localhost:${PORT}"
printf '\n  中医中药学 · 执业医师闪卡\n'
printf '  已启动：%s\n' "$URL"
printf '  按 Ctrl+C 停止服务\n\n'

if command -v xdg-open >/dev/null 2>&1; then
  (sleep 1; xdg-open "$URL" >/dev/null 2>&1 || true) &
elif command -v open >/dev/null 2>&1; then
  (sleep 1; open "$URL" >/dev/null 2>&1 || true) &
fi

python3 -m http.server "$PORT" --bind 127.0.0.1
