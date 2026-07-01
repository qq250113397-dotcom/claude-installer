@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title Emergency Windows Proxy Reset

net session >nul 2>&1
if errorlevel 1 (
  echo 需要管理员权限，正在请求管理员运行...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b 0
)

echo.
echo ================================================
echo  紧急恢复网络：关闭 Windows 系统代理
echo ================================================
echo 此操作不会删除 v2rayN 节点、订阅、Claude Code 或 Codex。
echo 仅在 v2rayN 没启动导致所有网页打不开时使用。
echo.
choice /C YN /N /M "继续？[Y/N]: "
if errorlevel 2 exit /b 0

netsh.exe winhttp reset proxy
reg.exe add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f
reg.exe delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v AutoConfigURL /f >nul 2>&1

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -Namespace WinINet -Name Native -MemberDefinition '[DllImport(\"wininet.dll\", SetLastError=true)] public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);'; [WinINet.Native]::InternetSetOption([IntPtr]::Zero,39,[IntPtr]::Zero,0) | Out-Null; [WinINet.Native]::InternetSetOption([IntPtr]::Zero,37,[IntPtr]::Zero,0) | Out-Null"

echo.
echo 已关闭 Windows 代理。关闭并重新打开浏览器后，国内直连网站应恢复。
pause
