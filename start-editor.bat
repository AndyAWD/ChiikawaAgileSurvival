@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo.
echo  ============================================
echo   吉伊卡哇簡報 - 視覺化內容編輯器
echo   http://localhost:8001/editor.html
echo   關閉此視窗即停止編輯器
echo  ============================================
echo.
timeout /t 2 /nobreak > nul
start "" "http://localhost:8001/editor.html"
py editor_server.py
if %errorlevel% neq 0 (
  python editor_server.py
)
pause
