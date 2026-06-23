@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title Codex + Claude Code 一键安装

set "ROOT=%~dp0"
call :check_layout || exit /b 20

net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo 需要管理员权限，正在请求管理员运行...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b 0
)

cd /d "%ROOT%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%lib\oneclick-windows.ps1"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo 安装流程执行完成。
) else (
  echo 安装流程返回错误码：%RC%
)
echo.
echo 请把桌面的 Codex-Claude-OneClick-Report.txt 发回给维护者，方便确认结果。
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
echo  文件夹不完整，或你正在压缩包里面直接运行。
echo ============================================================
echo 请先右键 ZIP 文件，选择“全部解压/解压到当前文件夹”。
echo 然后进入解压后的完整文件夹，再运行本文件。
echo.
echo 可以解压到桌面、D盘、E盘或任意磁盘，不要求必须在桌面。
echo 但必须保留这些文件：
echo   一键安装-Codex-Claude-Code.cmd
echo   lib\oneclick-windows.ps1
echo   assets\v2rayN-windows-64-desktop-portable.zip
echo   assets\node-v24.16.0-x64.msi
echo   assets\Git-2.54.0-64-bit.exe
echo   assets\VC_redist.x64.exe
echo   assets\VC_redist.x86.exe
echo   assets\AppInstaller\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle
echo   assets\AppInstaller\Dependencies\x64\*.appx
echo.
echo 不要只从压缩包里拖出一个 cmd 文件运行。
echo.
pause
exit /b 20
