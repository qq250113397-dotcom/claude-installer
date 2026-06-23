@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
call "%~dp0START-ONECLICK.cmd"
exit /b %ERRORLEVEL%
