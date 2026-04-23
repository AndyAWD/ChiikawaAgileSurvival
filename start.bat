@echo off
cd /d "%~dp0"
echo 在 http://localhost:8000 啟動靜態伺服器 (關閉此視窗結束)
timeout /t 1 /nobreak > nul
start "" "http://localhost:8000"
py -m http.server 8000
pause
