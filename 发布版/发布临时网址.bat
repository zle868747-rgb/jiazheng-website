@echo off
cd /d "%~dp0"
if not exist "cloudflared.exe" (
  echo First run: downloading cloudflared tool...
  powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe' -TimeoutSec 180; exit 0 } catch { Write-Output 'download failed'; exit 1 }"
  if errorlevel 1 (
    echo [ERROR] Download failed. Please check network and retry.
    pause
    exit /b
  )
)
echo ============================================
echo   Creating public URL (Cloudflare tunnel)...
echo   Keep this window open while using it.
echo   Close this window to stop the public URL.
echo ============================================
cloudflared.exe tunnel --url http://localhost:3000 --no-autoupdate
pause