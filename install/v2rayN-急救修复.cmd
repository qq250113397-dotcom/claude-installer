@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title v2rayN Emergency Repair

set "ROOT=%~dp0"
if not exist "%ROOT%lib\v2rayn-repair.ps1" goto missing

net session >nul 2>&1
if errorlevel 1 (
  echo 正在请求管理员权限...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -Verb RunAs -FilePath powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','%ROOT%lib\v2rayn-repair.ps1')"
  exit /b 0
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%lib\v2rayn-repair.ps1"
echo.
echo 报告在桌面: %USERPROFILE%\Desktop\v2rayN-repair-report.txt
pause
exit /b %ERRORLEVEL%

:missing
echo.
echo ============================================================
echo  修复工具文件不完整
echo ============================================================
echo 请确认整个文件夹完整解压后再双击运行。
echo 需要同时存在：
echo   v2rayN-急救修复.cmd
echo   lib\v2rayn-repair.ps1
echo.
pause
exit /b 20
