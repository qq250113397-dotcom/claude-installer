#requires -Version 5.1
$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = Split-Path -Parent $ScriptDir
$AssetsDir = Join-Path $InstallDir "assets"
$AppInstallerDir = Join-Path $AssetsDir "AppInstaller"
$Desktop = [Environment]::GetFolderPath("Desktop")
$Report = Join-Path $Desktop "Codex-Claude-Verify-Report.txt"

function Write-Log {
  param([string]$Message, [string]$Level = "INFO")
  $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
  Write-Host $line
  Add-Content -Path $Report -Value $line -Encoding UTF8
}

function Add-Section {
  param([string]$Name)
  Write-Host ""
  Write-Host "==== $Name ===="
  Add-Content -Path $Report -Value "" -Encoding UTF8
  Add-Content -Path $Report -Value "==== $Name ====" -Encoding UTF8
}

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($id)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-TcpPort {
  param([int]$Port, [int]$TimeoutMs = 1200)
  $client = New-Object Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) { return $false }
    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Get-CommandStatus {
  param([string]$Name)
  try {
    $cmd = Get-Command $Name -ErrorAction Stop
    return "OK: $($cmd.Source)"
  } catch {
    return "MISSING"
  }
}

function Get-ProxyPort {
  try {
    $reg = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
    if ($reg.ProxyEnable -eq 1 -and $reg.ProxyServer -match ":(\d+)") {
      return [int]$Matches[1]
    }
  } catch {}
  foreach ($p in @(10808, 10809, 7890, 1080, 7897, 8080)) {
    if (Test-TcpPort -Port $p) { return $p }
  }
  return $null
}

function Test-Url {
  param([string]$Name, [string]$Url, [string]$Proxy)
  try {
    $params = @{
      Uri = $Url
      Method = "GET"
      UseBasicParsing = $true
      TimeoutSec = 20
    }
    if ($Proxy) { $params.Proxy = $Proxy }
    Invoke-WebRequest @params | Out-Null
    Write-Log "[OK] $Name $Url"
  } catch {
    if ($_.Exception.Response) {
      Write-Log "[OK] $Name reachable with HTTP response: $Url"
    } else {
      Write-Log "[FAIL] $Name $Url -> $($_.Exception.Message)" "WARN"
    }
  }
}

"Codex + Claude Code Verify Report" | Set-Content -Path $Report -Encoding UTF8
Add-Content -Path $Report -Value ("Date: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")) -Encoding UTF8
Add-Content -Path $Report -Value ("InstallDir: " + $InstallDir) -Encoding UTF8

Add-Section "System"
$build = 0
try {
  $os = Get-CimInstance Win32_OperatingSystem
  $build = [int]$os.BuildNumber
  Write-Log "OS: $($os.Caption) build $($os.BuildNumber) $($os.OSArchitecture)"
  if ($build -lt 17763) {
    Write-Log "[BLOCKED] Windows 10 1809/build 17763 or newer is required." "ERROR"
  }
  if ($os.OSArchitecture -notmatch "64") {
    Write-Log "[BLOCKED] This package supports x64 Windows only." "ERROR"
  }
} catch {
  Write-Log "OS check failed: $($_.Exception.Message)" "WARN"
}
Write-Log "Admin: $(Test-Admin)"
Write-Log "PowerShell: $($PSVersionTable.PSVersion)"
Write-Log "ExecutionPolicy CurrentUser: $(Get-ExecutionPolicy -Scope CurrentUser)"

Add-Section "Assets"
foreach ($file in @(
  "v2rayN-windows-64-desktop-portable.zip",
  "node-v24.16.0-x64.msi",
  "Git-2.54.0-64-bit.exe",
  "VC_redist.x64.exe",
  "VC_redist.x86.exe",
  "AppInstaller\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle",
  "AppInstaller\Dependencies\x64\Microsoft.VCLibs.140.00_14.0.33519.0_x64.appx",
  "AppInstaller\Dependencies\x64\Microsoft.VCLibs.140.00.UWPDesktop_14.0.33728.0_x64.appx",
  "AppInstaller\Dependencies\x64\Microsoft.WindowsAppRuntime.1.8_8000.616.304.0_x64.appx"
)) {
  $path = Join-Path $AssetsDir $file
  if (Test-Path $path) {
    $item = Get-Item $path
    Write-Log "[OK] $file size=$($item.Length)"
  } else {
    Write-Log "[MISSING] $file" "WARN"
  }
}

Add-Section "Commands"
foreach ($cmd in @("powershell", "curl", "winget", "node", "npm", "git", "claude", "codex")) {
  Write-Log "${cmd}: $(Get-CommandStatus $cmd)"
}

Add-Section "Proxy"
$proxyPort = Get-ProxyPort
if ($proxyPort) {
  $proxy = "http://127.0.0.1:$proxyPort"
  Write-Log "Detected proxy: $proxy"
} else {
  $proxy = $null
  Write-Log "No local proxy detected." "WARN"
}
try {
  netsh.exe winhttp show proxy | Out-String | Add-Content -Path $Report -Encoding UTF8
} catch {}

Add-Section "Network"
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
Test-Url "Claude install script" "https://claude.ai/install.ps1" $proxy
Test-Url "Codex install script" "https://chatgpt.com/codex/install.ps1" $proxy
Test-Url "npm registry" "https://registry.npmjs.org/" $proxy
Test-Url "GitHub" "https://github.com/" $proxy
Test-Url "Microsoft Store service" "https://storeedgefd.dsx.mp.microsoft.com/" $proxy
Test-Url "OpenAI API" "https://api.openai.com/" $proxy
Test-Url "Anthropic API" "https://api.anthropic.com/" $proxy

Add-Section "AppX"
$appxBaseReady = $true
foreach ($command in @("Get-AppxPackage", "Add-AppxPackage")) {
  if (Get-Command $command -ErrorAction SilentlyContinue) {
    Write-Log "${command}: OK"
  } else {
    Write-Log "${command}: MISSING" "ERROR"
    $appxBaseReady = $false
  }
}
foreach ($service in @("AppXSvc", "ClipSVC", "StateRepository", "InstallService", "BITS", "wuauserv")) {
  $svc = Get-Service -Name $service -ErrorAction SilentlyContinue
  if ($svc) {
    Write-Log "$service status=$($svc.Status) start=$($svc.StartType)"
  } else {
    Write-Log "${service}: MISSING" "ERROR"
    if ($service -in @("AppXSvc", "ClipSVC", "StateRepository")) {
      $appxBaseReady = $false
    }
  }
}
try {
  $store = Get-AppxPackage Microsoft.WindowsStore -ErrorAction SilentlyContinue
  $installer = Get-AppxPackage Microsoft.DesktopAppInstaller -ErrorAction SilentlyContinue
  Write-Log "Microsoft Store package: $(if ($store) { 'OK' } else { 'MISSING' })"
  Write-Log "App Installer package: $(if ($installer) { 'OK' } else { 'MISSING' })"
} catch {
  Write-Log "AppX check failed: $($_.Exception.Message)" "WARN"
}

Add-Section "Result"
if ($build -lt 17763) {
  Write-Log "Assessment: BLOCKED - Windows is too old for supported App Installer/winget and Codex." "ERROR"
} elseif (-not $appxBaseReady) {
  Write-Log "Assessment: BLOCKED - core AppX services/cmdlets were removed. Use an official Windows ISO for in-place repair." "ERROR"
} elseif (-not $store -or -not $installer) {
  Write-Log "Assessment: REPAIRABLE - Store/App Installer package is missing, but the AppX base exists. Run START-ONECLICK.cmd." "WARN"
} else {
  Write-Log "Assessment: READY - Store and App Installer packages are present."
}
Write-Log "Verify-only completed. No install or proxy changes were made."
Write-Log "Report path: $Report"
exit 0
