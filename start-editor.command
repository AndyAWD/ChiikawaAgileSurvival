#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo " ============================================"
echo "  吉伊卡哇簡報 - 視覺化內容編輯器"
echo "  http://localhost:8001/editor.html"
echo "  按 Ctrl+C 停止"
echo " ============================================"
echo ""
sleep 1
open "http://localhost:8001/editor.html" 2>/dev/null || xdg-open "http://localhost:8001/editor.html" 2>/dev/null
python3 editor_server.py
