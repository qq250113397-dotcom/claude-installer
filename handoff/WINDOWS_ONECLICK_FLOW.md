# Windows One-Click Flow: Codex + Claude Code

## Goal

Provide a Windows-first installer that turns the existing video tutorial flow into an executable path:

1. Verify the Windows base system.
2. Start or detect v2rayN.
3. Force PowerShell, npm, winget, and WinHTTP through the verified local proxy.
4. Install system/runtime dependencies.
5. Install Claude Code and Codex.
6. Write a report that can be sent back for remote diagnosis.

## Why this order

1. Windows base checks come first because trimmed Windows images often lack services, PowerShell capabilities, certificates, App Installer, or Store dependencies.
2. Proxy setup comes before online installers because npm, winget, GitHub release assets, Claude, and Codex may all require international network access.
3. Offline dependencies run before CLI installs so npm/PowerShell errors are reduced:
   - VC++ runtime
   - Node.js
   - Git
4. Claude Code uses official native PowerShell install first, then winget, then npm.
5. Codex uses Microsoft Store/winget for the Windows app when available, then the official CLI install script, then npm fallback.

## Current package

Generated package:

```text
dist/Codex-Claude-Windows-OneClick.zip
/Users/chengwei/Desktop/📦 安装包/Codex-Claude-Windows-OneClick.zip
dist/Codex-Windows-Store-OneClick.zip
dist/Codex-Windows-Store-OneClick.exe
/Users/chengwei/Desktop/📦 安装包/Codex-Windows-Store-OneClick.zip
/Users/chengwei/Desktop/📦 安装包/Codex-Windows-Store-OneClick.exe
```

Entry points:

```text
START-HERE.cmd
START-ONECLICK.cmd
一键安装-Codex-Claude-Code.cmd
EMERGENCY-PROXY-RESET.cmd
紧急恢复网络-关闭Windows代理.cmd
```

Report file on the client desktop:

```text
Codex-Claude-OneClick-Report.txt
```

## Included offline assets

```text
assets/v2rayN-windows-64-desktop-portable.zip
assets/node-v24.16.0-x64.msi
assets/Git-2.54.0-64-bit.exe
assets/VC_redist.x64.exe
assets/VC_redist.x86.exe
assets/AppInstaller/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle
assets/AppInstaller/Dependencies/x64/*.appx
```

Optional asset:

```text
assets/Git-*-64-bit.exe
```

Git is bundled from the official Git for Windows release.

The App Installer bundle and x64 dependencies are bundled from the official
Microsoft winget-cli release. This lets the installer recover winget when the
Microsoft Store window is broken but the Windows AppX servicing base still
exists.

## Network strategy

The installer checks these local proxy ports:

```text
10808, 10809, 7890, 1080, 7897, 8080
```

When a port is reachable, it sets proxy variables only for the installer
process and passes `--proxy` to supported winget versions:

```text
HTTP_PROXY
HTTPS_PROXY
ALL_PROXY
```

The current package deliberately does not overwrite persistent WinHTTP,
WinINET, or npm proxy configuration. This prevents the reboot-time failure
where Windows remains pointed at a local proxy port after v2rayN stops.

If no proxy port is open, it extracts and starts the bundled v2rayN portable package, then waits for a listening port.

## Limits

This package cannot guarantee success on every modified Windows image. It cannot fully repair systems where these components were removed or blocked:

```text
PowerShell
root certificates / TLS
AppX infrastructure
Microsoft Store
App Installer / winget
BITS / Windows Update service stack
administrator policy
security software blocking scripts
```

When that happens, use `Codex-Claude-OneClick-Report.txt` to decide whether to repair Windows or reinstall a clean Windows image.

## Source alignment

- Claude Code setup supports native Windows PowerShell install, winget, and npm fallback.
- Codex Windows guidance recommends Windows 11, treats recent fully updated Windows 10 as best effort, and expects `winget` plus common developer tools like Git and Node.js.
- Codex Windows app install path uses Microsoft Store / winget; Codex CLI can be installed separately as a terminal fallback.
