#!/bin/bash
cd "$(dirname "$0")"
echo "在 http://localhost:8000 啟動靜態伺服器 (Ctrl+C 結束)"
sleep 1
open "http://localhost:8000"
python3 -m http.server 8000
