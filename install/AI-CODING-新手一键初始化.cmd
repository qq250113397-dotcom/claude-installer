@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title AI Coding 新手一键初始化

set "ROOT=%~dp0"
if not exist "%ROOT%lib\ai-coding-starter.ps1" goto missing

set "NEED_BASE=0"
where node >nul 2>&1 || set "NEED_BASE=1"
where git >nul 2>&1 || set "NEED_BASE=1"
where codex >nul 2>&1 || set "NEED_BASE=1"

if "%NEED_BASE%"=="1" (
  if not exist "%ROOT%lib\oneclick-windows.ps1" goto missing
  echo 正在申请管理员权限，只用于安装 Codex、Node.js 和 Git...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p = Start-Process -FilePath '%ROOT%START-ONECLICK.cmd' -Verb RunAs -Wait -PassThru; exit $p.ExitCode"
  if errorlevel 1 (
    echo.
    echo 基础环境没有安装完整。请把桌面的安装报告发给维护者。
    pause
    exit /b 10
  )
)

rem 基础安装结束后回到当前用户，知识库和 Codex 配置不会写进管理员账号。
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%lib\ai-coding-starter.ps1" -Mode All
set "RC=%ERRORLEVEL%"
echo.
echo 完成状态码：%RC%
pause
exit /b %RC%

:missing
echo.
echo 安装包不完整，请先完整解压 ZIP，不要只拖出一个 cmd 文件。
pause
exit /b 20
