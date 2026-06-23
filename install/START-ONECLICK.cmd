@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title Codex + Claude Code OneClick

set "ROOT=%~dp0"
call :check_layout || exit /b 20

net session >nul 2>&1
if errorlevel 1 (
  echo Requesting administrator permission...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b 0
)

cd /d "%ROOT%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%lib\oneclick-windows.ps1"
set "RC=%ERRORLEVEL%"
echo.
echo Exit code: %RC%
echo Report: Desktop\Codex-Claude-OneClick-Report.txt
pause
exit /b %RC%

:check_layout
if not exist "%ROOT%lib\oneclick-windows.ps1" goto missing
if not exist "%ROOT%assets\v2rayN-windows-64-desktop-portable.zip" goto missing
if not exist "%ROOT%assets\node-v24.16.0-x64.msi" goto missing
if not exist "%ROOT%assets\Git-2.54.0-64-bit.exe" goto missing
if not exist "%ROOT%assets\VC_redist.x64.exe" goto missing
if not exist "%ROOT%assets\VC_redist.x86.exe" goto missing
if not exist "%ROOT%assets\AppInstaller\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle" goto missing
if not exist "%ROOT%assets\AppInstaller\Dependencies\x64\Microsoft.WindowsAppRuntime.1.8_8000.616.304.0_x64.appx" goto missing
exit /b 0

:missing
echo.
echo ============================================================
echo  Package is incomplete or running from inside the ZIP file.
echo ============================================================
echo Please right-click the ZIP file and choose "Extract All" first.
echo Then open the extracted folder and run START-ONECLICK.cmd again.
echo.
echo The folder may be on Desktop, D:, E:, or any other disk.
echo It only needs to keep this structure:
echo   START-ONECLICK.cmd
echo   lib\oneclick-windows.ps1
echo   assets\v2rayN-windows-64-desktop-portable.zip
echo   assets\node-v24.16.0-x64.msi
echo   assets\Git-2.54.0-64-bit.exe
echo   assets\VC_redist.x64.exe
echo   assets\VC_redist.x86.exe
echo   assets\AppInstaller\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle
echo   assets\AppInstaller\Dependencies\x64\*.appx
echo.
echo Do not drag out only one cmd file from the ZIP.
echo.
pause
exit /b 20
