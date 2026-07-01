@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title Emergency Windows Proxy Reset

net session >nul 2>&1
if errorlevel 1 (
  echo Requesting administrator permission...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b 0
)

echo.
echo ================================================
echo  Emergency Windows Proxy Reset
echo ================================================
echo This does not delete v2rayN, Claude Code, Codex, nodes, or subscriptions.
echo Use it only when v2rayN is down and all websites cannot open.
echo.
choice /C YN /N /M "Continue? [Y/N]: "
if errorlevel 2 exit /b 0

netsh.exe winhttp reset proxy
reg.exe add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f
reg.exe delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v AutoConfigURL /f >nul 2>&1

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -Namespace WinINet -Name Native -MemberDefinition '[DllImport(\"wininet.dll\", SetLastError=true)] public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);'; [WinINet.Native]::InternetSetOption([IntPtr]::Zero,39,[IntPtr]::Zero,0) | Out-Null; [WinINet.Native]::InternetSetOption([IntPtr]::Zero,37,[IntPtr]::Zero,0) | Out-Null"

echo.
echo Windows proxy disabled. Close and reopen the browser.
pause
