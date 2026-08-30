@echo off
cd /d "%~dp0"
set "NODE="
where node >nul 2>nul && set "NODE=node"
if not defined NODE (
  for /d %%R in ("%USERPROFILE%\.cache\codex-runtimes\*") do (
    if exist "%%R\dependencies\node\bin\node.exe" set "NODE=%%R\dependencies\node\bin\node.exe"
  )
)
if not defined NODE (
  echo [ERROR] Node.js not found. Please install Node.js first.
  pause
  exit /b
)
echo ============================================
echo   Housekeeping Service Server
echo   Home:  http://localhost:3000
echo   Admin: http://localhost:3000/admin
echo   Keep this window open while using.
echo   Press Ctrl+C to stop.
echo ============================================
"%NODE%" server.js
pause