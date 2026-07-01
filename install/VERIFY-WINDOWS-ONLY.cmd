@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title Verify Codex + Claude Code OneClick

set "ROOT=%~dp0"
if not exist "%ROOT%lib\verify-windows-only.ps1" (
  echo.
  echo Package is incomplete or running from inside the ZIP file.
  echo Please extract the whole ZIP folder first, then run VERIFY-WINDOWS-ONLY.cmd.
  echo.
  pause
  exit /b 20
)

cd /d "%ROOT%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%lib\verify-windows-only.ps1"
set "RC=%ERRORLEVEL%"
echo.
echo Exit code: %RC%
echo Report: Desktop\Codex-Claude-Verify-Report.txt
pause
exit /b %RC%
