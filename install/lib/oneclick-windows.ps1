#requires -Version 5.1
$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = Split-Path -Parent $ScriptDir
$AssetsDir = Join-Path $InstallDir "assets"
$Desktop = [Environment]::GetFolderPath("Desktop")
$Report = Join-Path $Desktop "Codex-Claude-OneClick-Report.txt"
$WorkRoot = Join-Path $env:LOCALAPPDATA "CodexClaudeOneClick"
$AppInstallerDir = Join-Path $AssetsDir "AppInstaller"
$ProxyPort = $null
$ProxyUri = $null
$WindowsBuild = 0
$StorePackageReady = $false
$WingetReady = $false
$CodexAppInstalled = $false
$CodexCliInstalled = $false
$ArchitectureSupported = $true

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
  param([string]$HostName = "127.0.0.1", [int]$Port, [int]$TimeoutMs = 1200)
  $client = New-Object Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) { return $false }
    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Invoke-Download {
  param([string]$Url, [string]$OutFile)
  Write-Log "Downloading $Url"
  $params = @{
    Uri = $Url
    OutFile = $OutFile
    UseBasicParsing = $true
    TimeoutSec = 90
  }
  if ($ProxyUri) { $params.Proxy = $ProxyUri }
  try {
    Invoke-WebRequest @params
    return (Test-Path $OutFile)
  } catch {
    Write-Log "Download failed: $($_.Exception.Message)" "WARN"
    return $false
  }
}

function Invoke-External {
  param([string]$FilePath, [string[]]$ArgumentList, [string]$Name)
  Write-Log "Run: $Name"
  try {
    $p = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -Wait -PassThru -WindowStyle Normal
    Write-Log "$Name exited with code $($p.ExitCode)"
    return $p.ExitCode
  } catch {
    Write-Log "$Name failed: $($_.Exception.Message)" "WARN"
    return 9999
  }
}

function Get-CommandText {
  param([string]$Command)
  try {
    $cmd = Get-Command $Command -ErrorAction Stop
    return $cmd.Source
  } catch {
    return $null
  }
}

function Get-WindowsBuild {
  try {
    $value = Get-ItemPropertyValue "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion" -Name CurrentBuildNumber -ErrorAction Stop
    return [int]$value
  } catch {
    try {
      return [int](Get-CimInstance Win32_OperatingSystem).BuildNumber
    } catch {
      return 0
    }
  }
}

function Get-WingetPath {
  Refresh-LocalPath
  $command = Get-Command winget.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  try {
    $package = Get-AppxPackage Microsoft.DesktopAppInstaller -ErrorAction SilentlyContinue |
      Sort-Object Version -Descending |
      Select-Object -First 1
    if ($package -and $package.InstallLocation) {
      $candidate = Join-Path $package.InstallLocation "winget.exe"
      if (Test-Path $candidate) { return $candidate }
    }
  } catch {}

  $alias = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\winget.exe"
  if (Test-Path $alias) { return $alias }
  return $null
}

function Invoke-Winget {
  param([string[]]$ArgumentList, [string]$Name)
  $winget = Get-WingetPath
  if (-not $winget) {
    Write-Log "$Name skipped: winget is unavailable." "WARN"
    return 9009
  }

  $wingetArgs = New-Object System.Collections.Generic.List[string]
  foreach ($arg in $ArgumentList) { [void]$wingetArgs.Add($arg) }
  if ($ProxyUri) {
    try {
      $helpText = (& $winget --help 2>$null | Out-String)
      if ($helpText -match "--proxy") {
        [void]$wingetArgs.Add("--proxy")
        [void]$wingetArgs.Add($ProxyUri)
      }
    } catch {}
  }

  Write-Log "Run winget: $Name"
  try {
    $nativeArgs = $wingetArgs.ToArray()
    & $winget @nativeArgs 2>&1 | Tee-Object -FilePath $Report -Append
    $code = $LASTEXITCODE
    Write-Log "$Name exited with code $code"
    return $code
  } catch {
    Write-Log "$Name failed: $($_.Exception.Message)" "WARN"
    return 9999
  }
}

function Get-NodeMajor {
  try {
    $ver = (& node --version 2>$null)
    if (-not $ver) { return 0 }
    return [int](($ver.TrimStart("v") -split "\.")[0])
  } catch {
    return 0
  }
}

function Refresh-LocalPath {
  $extra = @(
    "$env:LOCALAPPDATA\Microsoft\WindowsApps",
    "$env:ProgramFiles\nodejs",
    "${env:ProgramFiles(x86)}\nodejs",
    "$env:ProgramFiles\Git\cmd",
    "$env:ProgramFiles\Git\bin",
    "$env:APPDATA\npm",
    "$env:LOCALAPPDATA\Programs\Git\cmd"
  ) | Where-Object { $_ -and (Test-Path $_) }
  foreach ($p in $extra) {
    if (($env:Path -split ";") -notcontains $p) {
      $env:Path = "$p;$env:Path"
    }
  }
}

function Enable-ModernTls {
  Add-Section "Windows TLS / PowerShell baseline"
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  } catch {}

  $keys = @(
    "HKLM:\SOFTWARE\Microsoft\.NETFramework\v4.0.30319",
    "HKLM:\SOFTWARE\Wow6432Node\Microsoft\.NETFramework\v4.0.30319",
    "HKCU:\SOFTWARE\Microsoft\.NETFramework\v4.0.30319"
  )
  foreach ($key in $keys) {
    try {
      New-Item -Path $key -Force | Out-Null
      New-ItemProperty -Path $key -Name "SchUseStrongCrypto" -Value 1 -PropertyType DWord -Force | Out-Null
      New-ItemProperty -Path $key -Name "SystemDefaultTlsVersions" -Value 1 -PropertyType DWord -Force | Out-Null
    } catch {
      Write-Log "TLS registry update failed for ${key}: $($_.Exception.Message)" "WARN"
    }
  }
  try {
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
    Write-Log "PowerShell execution policy set to CurrentUser RemoteSigned."
  } catch {
    Write-Log "Execution policy update failed: $($_.Exception.Message)" "WARN"
  }
}

function Start-BaselineServices {
  Add-Section "Windows services"
  $services = @{
    "BITS" = "demand"
    "wuauserv" = "demand"
    "InstallService" = "demand"
    "AppXSvc" = "demand"
    "ClipSVC" = "demand"
    "TokenBroker" = "demand"
    "StateRepository" = "auto"
  }
  foreach ($name in $services.Keys) {
    try {
      $svc = Get-Service -Name $name -ErrorAction Stop
      Write-Log "$name status=$($svc.Status) start=$($svc.StartType)"
      if ($svc.StartType -eq "Disabled") {
        sc.exe config $name start= $services[$name] 2>&1 | Add-Content -Path $Report -Encoding UTF8
        Write-Log "$name was disabled; changed startup to $($services[$name])."
      }
      if ($svc.Status -ne "Running") {
        Start-Service -Name $name -ErrorAction SilentlyContinue
      }
    } catch {
      Write-Log "$name missing or blocked: $($_.Exception.Message)" "WARN"
    }
  }
}

function Read-WinInetProxyPort {
  try {
    $reg = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
    if ($reg.ProxyEnable -ne 1 -or -not $reg.ProxyServer) { return $null }
    $text = [string]$reg.ProxyServer
    if ($text -match "127\.0\.0\.1:(\d+)") { return [int]$Matches[1] }
    if ($text -match "localhost:(\d+)") { return [int]$Matches[1] }
    if ($text -match ":(\d+)") { return [int]$Matches[1] }
    return $null
  } catch {
    return $null
  }
}

function Start-PortableV2RayN {
  Add-Section "v2rayN bootstrap"
  $zip = Join-Path $AssetsDir "v2rayN-windows-64-desktop-portable.zip"
  if (-not (Test-Path $zip)) {
    Write-Log "v2rayN portable zip not found: $zip" "WARN"
    return
  }

  $target = Join-Path $WorkRoot "v2rayN"
  $exe = Join-Path $target "v2rayN-windows-64-desktop-portable\v2rayN.exe"
  if (-not (Test-Path $exe)) {
    Write-Log "Extracting v2rayN portable package..."
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    try {
      Expand-Archive -Path $zip -DestinationPath $target -Force
    } catch {
      Write-Log "Expand v2rayN failed: $($_.Exception.Message)" "WARN"
      return
    }
  }
  if (Test-Path $exe) {
    try {
      Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe)
      Write-Log "Started portable v2rayN: $exe"
    } catch {
      Write-Log "Start v2rayN failed: $($_.Exception.Message)" "WARN"
    }
  }
}

function Find-Proxy {
  Add-Section "Proxy detection"
  $candidates = New-Object System.Collections.Generic.List[int]
  $fromReg = Read-WinInetProxyPort
  if ($fromReg) { [void]$candidates.Add($fromReg) }
  foreach ($p in @(10808, 10809, 7890, 1080, 7897, 8080)) {
    if (-not $candidates.Contains($p)) { [void]$candidates.Add($p) }
  }
  foreach ($p in $candidates) {
    if (Test-TcpPort -Port $p) {
      $script:ProxyPort = $p
      $script:ProxyUri = "http://127.0.0.1:$p"
      Write-Log "Proxy detected at $ProxyUri"
      return $true
    }
  }

  Write-Log "No local proxy found. Trying bundled v2rayN..."
  Start-PortableV2RayN
  for ($i = 1; $i -le 45; $i++) {
    foreach ($p in $candidates) {
      if (Test-TcpPort -Port $p) {
        $script:ProxyPort = $p
        $script:ProxyUri = "http://127.0.0.1:$p"
        Write-Log "Proxy detected after v2rayN start: $ProxyUri"
        return $true
      }
    }
    Start-Sleep -Seconds 1
  }
  Write-Log "No local proxy port is listening. Online installs may fail." "WARN"
  return $false
}

function Apply-ProxyForInstall {
  Add-Section "Scoped proxy injection"
  if (-not $ProxyPort) {
    Write-Log "No proxy configured for this run." "WARN"
    return
  }
  $env:HTTP_PROXY = $ProxyUri
  $env:HTTPS_PROXY = $ProxyUri
  $env:ALL_PROXY = $ProxyUri
  $env:http_proxy = $ProxyUri
  $env:https_proxy = $ProxyUri
  $env:all_proxy = $ProxyUri
  Write-Log "Proxy is scoped to this installer process: $ProxyUri"
  Write-Log "Windows system proxy and WinHTTP settings were not overwritten."
}

function Test-Endpoint {
  param([string]$Name, [string]$Url)
  try {
    $params = @{
      Uri = $Url
      UseBasicParsing = $true
      TimeoutSec = 20
      Method = "GET"
    }
    if ($ProxyUri) { $params.Proxy = $ProxyUri }
    Invoke-WebRequest @params | Out-Null
    Write-Log "[OK] $Name $Url"
    return $true
  } catch {
    if ($_.Exception.Response) {
      Write-Log "[OK] $Name reachable with HTTP response: $Url"
      return $true
    }
    Write-Log "[FAIL] $Name $Url -> $($_.Exception.Message)" "WARN"
    return $false
  }
}

function Test-Network {
  Add-Section "Network endpoint tests"
  Test-Endpoint "npm" "https://registry.npmjs.org/"
  Test-Endpoint "Node.js" "https://nodejs.org/"
  Test-Endpoint "GitHub" "https://github.com/"
  Test-Endpoint "Claude" "https://claude.ai/"
  Test-Endpoint "Anthropic API" "https://api.anthropic.com/"
  Test-Endpoint "ChatGPT" "https://chatgpt.com/"
  Test-Endpoint "OpenAI API" "https://api.openai.com/"
  Test-Endpoint "Microsoft Store" "https://storeedgefd.dsx.mp.microsoft.com/"
}

function Test-AppxInfrastructure {
  $requiredCommands = @("Get-AppxPackage", "Add-AppxPackage")
  foreach ($command in $requiredCommands) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
      Write-Log "AppX command missing: $command" "ERROR"
      return $false
    }
  }

  foreach ($service in @("AppXSvc", "ClipSVC", "StateRepository")) {
    if (-not (Get-Service -Name $service -ErrorAction SilentlyContinue)) {
      Write-Log "Core AppX service missing: $service" "ERROR"
      return $false
    }
  }
  return $true
}

function Register-AppxPackageIfPresent {
  param([string]$PackageName)
  try {
    $packages = @()
    $packages += Get-AppxPackage -Name $PackageName -ErrorAction SilentlyContinue
    $packages += Get-AppxPackage -AllUsers -Name $PackageName -ErrorAction SilentlyContinue
    $locations = $packages |
      Where-Object { $_ -and $_.InstallLocation } |
      Select-Object -ExpandProperty InstallLocation -Unique

    if (-not $locations) {
      Write-Log "$PackageName is not present in the Windows image." "WARN"
      return $false
    }

    $registered = $false
    foreach ($location in $locations) {
      $manifest = Join-Path $location "AppxManifest.xml"
      if (-not (Test-Path $manifest)) { continue }
      try {
        Add-AppxPackage -DisableDevelopmentMode -Register $manifest -ForceApplicationShutdown -ErrorAction Stop
        Write-Log "Re-registered $PackageName from $manifest"
        $registered = $true
      } catch {
        Write-Log "Re-register $PackageName failed: $($_.Exception.Message)" "WARN"
      }
    }
    return $registered
  } catch {
    Write-Log "AppX query failed for ${PackageName}: $($_.Exception.Message)" "WARN"
    return $false
  }
}

function Reset-StoreCache {
  $wsreset = Join-Path $env:WINDIR "System32\wsreset.exe"
  if (-not (Test-Path $wsreset)) {
    Write-Log "wsreset.exe is missing." "WARN"
    return
  }

  try {
    $process = Start-Process -FilePath $wsreset -PassThru -WindowStyle Hidden
    if (-not $process.WaitForExit(30000)) {
      $process.Kill()
      Write-Log "wsreset did not exit in 30 seconds; it was stopped after cache reset request." "WARN"
    } else {
      Write-Log "Microsoft Store cache reset completed."
    }
  } catch {
    Write-Log "Microsoft Store cache reset failed: $($_.Exception.Message)" "WARN"
  }
}

function Install-AppInstallerOffline {
  Add-Section "Offline App Installer / winget repair"
  $bundle = Join-Path $AppInstallerDir "Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle"
  $dependencyDir = Join-Path $AppInstallerDir "Dependencies\x64"
  if (-not (Test-Path $bundle)) {
    Write-Log "Offline App Installer bundle is missing: $bundle" "ERROR"
    return $false
  }
  if (-not (Test-Path $dependencyDir)) {
    Write-Log "Offline App Installer dependencies are missing: $dependencyDir" "ERROR"
    return $false
  }

  $dependencies = Get-ChildItem -Path $dependencyDir -Filter "*.appx" -File -ErrorAction SilentlyContinue
  if (-not $dependencies) {
    Write-Log "No x64 App Installer dependency packages were found." "ERROR"
    return $false
  }

  try {
    Get-ChildItem -Path $AppInstallerDir -Recurse -File | Unblock-File -ErrorAction SilentlyContinue
    Add-AppxPackage -Path $bundle -DependencyPath $dependencies.FullName -ForceApplicationShutdown -ErrorAction Stop
    Write-Log "Offline Microsoft App Installer package installed."
  } catch {
    Write-Log "Offline App Installer install returned: $($_.Exception.Message)" "WARN"
  }

  Register-AppxPackageIfPresent "Microsoft.DesktopAppInstaller" | Out-Null
  Refresh-LocalPath
  if (Get-WingetPath) {
    Write-Log "winget is available after offline repair."
    return $true
  }
  Write-Log "winget is still unavailable after offline App Installer repair." "ERROR"
  return $false
}

function Initialize-Winget {
  Refresh-LocalPath
  if (-not (Get-WingetPath)) {
    Install-AppInstallerOffline | Out-Null
  }

  $winget = Get-WingetPath
  if (-not $winget) {
    $script:WingetReady = $false
    return $false
  }

  try {
    Write-Log "winget executable: $winget"
    & $winget --version 2>&1 | Tee-Object -FilePath $Report -Append
  } catch {
    Write-Log "winget version check failed: $($_.Exception.Message)" "WARN"
  }

  Invoke-Winget -Name "winget source reset" -ArgumentList @("source", "reset", "--force", "--disable-interactivity") | Out-Null
  Invoke-Winget -Name "winget source update" -ArgumentList @("source", "update", "--disable-interactivity") | Out-Null
  $script:WingetReady = $true
  return $true
}

function Repair-MicrosoftStore {
  Add-Section "Microsoft Store and AppX repair"
  if ($WindowsBuild -lt 17763) {
    Write-Log "Windows build $WindowsBuild is older than 1809/build 17763. App Installer and Codex are unsupported." "ERROR"
    return $false
  }
  if (-not (Test-AppxInfrastructure)) {
    Write-Log "The AppX servicing base was removed from this Windows image." "ERROR"
    Write-Log "A ZIP package cannot recreate deleted Windows servicing components; use an official Windows in-place repair install." "ERROR"
    return $false
  }

  Register-AppxPackageIfPresent "Microsoft.WindowsStore" | Out-Null
  Register-AppxPackageIfPresent "Microsoft.StorePurchaseApp" | Out-Null
  Register-AppxPackageIfPresent "Microsoft.DesktopAppInstaller" | Out-Null
  Reset-StoreCache

  $store = Get-AppxPackage Microsoft.WindowsStore -ErrorAction SilentlyContinue
  if ($store) {
    $script:StorePackageReady = $true
    Write-Log "Microsoft Store package is registered."
  } else {
    $script:StorePackageReady = $false
    Write-Log "Microsoft Store UI package is absent. The installer will use winget/msstore without relying on the Store window." "WARN"
  }

  Initialize-Winget | Out-Null
  return $WingetReady
}

function Install-VC {
  Add-Section "VC++ runtimes"
  foreach ($file in @("VC_redist.x64.exe", "VC_redist.x86.exe")) {
    $path = Join-Path $AssetsDir $file
    if (Test-Path $path) {
      $code = Invoke-External -FilePath $path -ArgumentList @("/install", "/quiet", "/norestart") -Name $file
      if ($code -eq 0 -or $code -eq 3010 -or $code -eq 1638) {
        Write-Log "$file installed or already present."
      }
    } else {
      Write-Log "$file missing, skipped." "WARN"
    }
  }
}

function Install-Node {
  Add-Section "Node.js"
  Refresh-LocalPath
  $major = Get-NodeMajor
  if ($major -ge 18) {
    Write-Log "Node.js already available: $(& node --version 2>$null)"
    return
  }
  $msi = Join-Path $AssetsDir "node-v24.16.0-x64.msi"
  if (-not (Test-Path $msi)) {
    Write-Log "Node offline MSI missing. Trying winget/OpenJS.NodeJS.LTS..." "WARN"
    if (Get-WingetPath) {
      Invoke-Winget -Name "Install Node.js LTS" -ArgumentList @(
        "install", "--id", "OpenJS.NodeJS.LTS", "--exact",
        "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"
      ) | Out-Null
    }
  } else {
    $code = Invoke-External -FilePath "msiexec.exe" -ArgumentList @("/i", $msi, "/qn", "/norestart", "ADDLOCAL=ALL") -Name "Node.js MSI"
    if ($code -ne 0 -and $code -ne 3010) {
      Write-Log "Node.js MSI install returned $code" "WARN"
    }
  }
  Refresh-LocalPath
  $major = Get-NodeMajor
  if ($major -ge 18) {
    Write-Log "Node.js ready: $(& node --version 2>$null)"
    try { Write-Log "npm ready: $(& npm --version 2>$null)" } catch {}
  } else {
    Write-Log "Node.js is still not available." "WARN"
  }
}

function Install-Git {
  Add-Section "Git"
  Refresh-LocalPath
  if (Get-CommandText "git") {
    Write-Log "Git already available: $(& git --version 2>$null)"
    return
  }
  $gitAsset = Get-ChildItem -Path $AssetsDir -Filter "Git-*-64-bit.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($gitAsset) {
    $code = Invoke-External -FilePath $gitAsset.FullName -ArgumentList @("/VERYSILENT", "/NORESTART", "/NOCANCEL", "/SP-", "/CLOSEAPPLICATIONS", "/RESTARTAPPLICATIONS") -Name "Git for Windows"
    Write-Log "Git offline installer returned $code"
  } elseif (Get-WingetPath) {
    Write-Log "Git offline installer missing. Trying winget Git.Git..."
    Invoke-Winget -Name "Install Git for Windows" -ArgumentList @(
      "install", "--id", "Git.Git", "--exact",
      "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"
    ) | Out-Null
  } else {
    $tmp = Join-Path $env:TEMP "Git-2.54.0-64-bit.exe"
    if (Invoke-Download "https://github.com/git-for-windows/git/releases/download/v2.54.0.windows.1/Git-2.54.0-64-bit.exe" $tmp) {
      Invoke-External -FilePath $tmp -ArgumentList @("/VERYSILENT", "/NORESTART", "/NOCANCEL", "/SP-") -Name "Git online installer" | Out-Null
    } else {
      Write-Log "Git install failed: no offline asset, no winget, and online download failed." "WARN"
    }
  }
  Refresh-LocalPath
  if (Get-CommandText "git") {
    Write-Log "Git ready: $(& git --version 2>$null)"
  } else {
    Write-Log "Git is still not available." "WARN"
  }
}

function Configure-NpmProxy {
  Add-Section "npm network"
  Refresh-LocalPath
  if (-not (Get-CommandText "npm")) {
    Write-Log "npm command not available." "WARN"
    return
  }
  if ($ProxyUri) {
    Write-Log "npm will inherit the installer-scoped proxy $ProxyUri"
  } else {
    Write-Log "npm will use the current direct network connection."
  }
}

function Invoke-InstallScript {
  param([string]$Name, [string]$Url)
  Write-Log "Running official install script for $Name"
  $cmd = ""
  if ($ProxyUri) {
    $cmd = "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; `$env:HTTP_PROXY='$ProxyUri'; `$env:HTTPS_PROXY='$ProxyUri'; irm -Proxy '$ProxyUri' '$Url' | iex"
  } else {
    $cmd = "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; irm '$Url' | iex"
  }
  $p = Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $cmd) -Wait -PassThru -WindowStyle Normal
  Write-Log "$Name official script exited with code $($p.ExitCode)"
  return $p.ExitCode
}

function Install-ClaudeCode {
  Add-Section "Claude Code"
  Refresh-LocalPath
  if (Get-CommandText "claude") {
    Write-Log "Claude Code already available: $(& claude --version 2>$null)"
    return
  }
  $ok = $false
  try {
    $code = Invoke-InstallScript "Claude Code" "https://claude.ai/install.ps1"
    Refresh-LocalPath
    if (Get-CommandText "claude") { $ok = $true }
  } catch {
    Write-Log "Claude official script failed: $($_.Exception.Message)" "WARN"
  }
  if (-not $ok -and (Get-WingetPath)) {
    Write-Log "Trying winget Anthropic.ClaudeCode..."
    Invoke-Winget -Name "Install Claude Code" -ArgumentList @(
      "install", "--id", "Anthropic.ClaudeCode", "--exact",
      "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"
    ) | Out-Null
    Refresh-LocalPath
    if (Get-CommandText "claude") { $ok = $true }
  }
  if (-not $ok -and (Get-CommandText "npm")) {
    Configure-NpmProxy
    Write-Log "Trying npm install @anthropic-ai/claude-code..."
    npm install -g @anthropic-ai/claude-code@latest --registry https://registry.npmjs.org | Tee-Object -FilePath $Report -Append
    Refresh-LocalPath
    if (Get-CommandText "claude") { $ok = $true }
  }
  if ($ok) {
    Write-Log "Claude Code ready: $(& claude --version 2>$null)"
  } else {
    Write-Log "Claude Code install failed." "WARN"
  }
}

function Install-Codex {
  Add-Section "Codex"
  Refresh-LocalPath
  if (Get-WingetPath) {
    Write-Log "Installing Codex Windows App from the Microsoft Store source..."
    $appCode = Invoke-Winget -Name "Install Codex Windows App" -ArgumentList @(
      "install", "Codex", "--source", "msstore",
      "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"
    )
    if ($appCode -eq 0) {
      $script:CodexAppInstalled = $true
      Write-Log "Codex Windows App installation completed."
    } else {
      Write-Log "Codex Windows App install returned $appCode. CLI fallback will continue." "WARN"
    }
  } else {
    Write-Log "winget missing; Codex Windows App install skipped." "WARN"
  }

  if (Get-CommandText "codex") {
    Write-Log "Codex CLI already available: $(& codex --version 2>$null)"
    $script:CodexCliInstalled = $true
    return
  }
  $ok = $false
  try {
    $code = Invoke-InstallScript "Codex CLI" "https://chatgpt.com/codex/install.ps1"
    Refresh-LocalPath
    if (Get-CommandText "codex") { $ok = $true }
  } catch {
    Write-Log "Codex official script failed: $($_.Exception.Message)" "WARN"
  }
  if (-not $ok -and (Get-CommandText "npm")) {
    Configure-NpmProxy
    Write-Log "Trying npm install @openai/codex..."
    npm install -g @openai/codex@latest --registry https://registry.npmjs.org | Tee-Object -FilePath $Report -Append
    Refresh-LocalPath
    if (Get-CommandText "codex") { $ok = $true }
  }
  if ($ok) {
    $script:CodexCliInstalled = $true
    Write-Log "Codex CLI ready: $(& codex --version 2>$null)"
  } else {
    Write-Log "Codex CLI install failed. If this is Windows 10 with missing system components, use the report for diagnosis." "WARN"
  }

  if ($StorePackageReady) {
    try {
      Start-Process "ms-windows-store://pdp/?ProductId=9PLM9XGG6VKS"
      Write-Log "Opened the Codex product page in Microsoft Store."
    } catch {
      Write-Log "Could not open Microsoft Store UI: $($_.Exception.Message)" "WARN"
    }
  }
}

function Write-SystemReport {
  Add-Section "System check"
  $script:WindowsBuild = Get-WindowsBuild
  try {
    $os = Get-CimInstance Win32_OperatingSystem
    Write-Log "OS: $($os.Caption) build $($os.BuildNumber) architecture $($os.OSArchitecture)"
    if ($os.OSArchitecture -notmatch "64") {
      $script:ArchitectureSupported = $false
      Write-Log "This package contains x64 dependencies and cannot install on 32-bit Windows." "ERROR"
    }
    if ([int]$os.BuildNumber -lt 17763) {
      Write-Log "Windows build is older than 1809. Codex on Windows is not recommended." "WARN"
    }
  } catch {
    Write-Log "OS check failed: $($_.Exception.Message)" "WARN"
  }
  Write-Log "PowerShell: $($PSVersionTable.PSVersion)"
  Write-Log "Admin: $(Test-Admin)"
  Write-Log "winget: $(if (Get-WingetPath) { 'OK' } else { 'MISSING' })"
  Write-Log "node: $(if (Get-CommandText 'node') { & node --version 2>$null } else { 'MISSING' })"
  Write-Log "npm: $(if (Get-CommandText 'npm') { & npm --version 2>$null } else { 'MISSING' })"
  Write-Log "git: $(if (Get-CommandText 'git') { & git --version 2>$null } else { 'MISSING' })"
  try {
    $store = Get-AppxPackage Microsoft.WindowsStore -ErrorAction SilentlyContinue
    $installer = Get-AppxPackage Microsoft.DesktopAppInstaller -ErrorAction SilentlyContinue
    Write-Log "Microsoft Store package: $(if ($store) { 'OK' } else { 'MISSING' })"
    Write-Log "App Installer package: $(if ($installer) { 'OK' } else { 'MISSING' })"
  } catch {
    Write-Log "AppX check failed: $($_.Exception.Message)" "WARN"
  }
}

function Assert-PackageLayout {
  Add-Section "Package layout"
  $required = @(
    (Join-Path $AssetsDir "v2rayN-windows-64-desktop-portable.zip"),
    (Join-Path $AssetsDir "node-v24.16.0-x64.msi"),
    (Join-Path $AssetsDir "Git-2.54.0-64-bit.exe"),
    (Join-Path $AssetsDir "VC_redist.x64.exe"),
    (Join-Path $AssetsDir "VC_redist.x86.exe"),
    (Join-Path $AppInstallerDir "Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle"),
    (Join-Path $AppInstallerDir "Dependencies\x64\Microsoft.WindowsAppRuntime.1.8_8000.616.304.0_x64.appx")
  )
  $missing = @()
  foreach ($path in $required) {
    if (Test-Path $path) {
      $item = Get-Item $path
      Write-Log "[OK] $($item.Name) size=$($item.Length)"
    } else {
      $missing += $path
      Write-Log "[MISSING] $path" "ERROR"
    }
  }
  if ($missing.Count -gt 0) {
    Write-Log "The package is incomplete. Extract the whole ZIP folder first; do not run a single file from inside the ZIP." "ERROR"
    Write-Log "The folder can be on Desktop, D:, E:, Downloads, or any other disk." "ERROR"
    exit 20
  }
}

function Write-FinalSummary {
  Add-Section "Final summary"
  Refresh-LocalPath
  Write-Log "Proxy used: $(if ($ProxyUri) { $ProxyUri } else { 'none' })"
  Write-Log "Node: $(if (Get-CommandText 'node') { & node --version 2>$null } else { 'MISSING' })"
  Write-Log "npm: $(if (Get-CommandText 'npm') { & npm --version 2>$null } else { 'MISSING' })"
  Write-Log "Git: $(if (Get-CommandText 'git') { & git --version 2>$null } else { 'MISSING' })"
  Write-Log "Claude: $(if (Get-CommandText 'claude') { & claude --version 2>$null } else { 'MISSING' })"
  Write-Log "Codex: $(if (Get-CommandText 'codex') { & codex --version 2>$null } else { 'MISSING' })"
  Write-Log "Microsoft Store UI package: $(if ($StorePackageReady) { 'READY' } else { 'MISSING/UNAVAILABLE' })"
  Write-Log "winget/App Installer: $(if ($WingetReady) { 'READY' } else { 'FAILED' })"
  Write-Log "Codex Windows App: $(if ($CodexAppInstalled) { 'INSTALLED' } else { 'NOT CONFIRMED' })"
  Write-Log "Codex CLI fallback: $(if ($CodexCliInstalled) { 'READY' } else { 'FAILED' })"
  if (-not $StorePackageReady -and $WingetReady) {
    Write-Log "Result: Store UI is missing, but winget can still install apps from the Microsoft Store source." "WARN"
  }
  if (-not $WingetReady -and -not $CodexCliInstalled) {
    Write-Log "Result: Windows servicing/AppX is too damaged for automatic repair. Use an official Windows 10/11 ISO for an in-place repair install." "ERROR"
  }
  Write-Log "Report path: $Report"
}

New-Item -ItemType Directory -Path $WorkRoot -Force | Out-Null
"Codex + Claude Code OneClick Report" | Set-Content -Path $Report -Encoding UTF8
Add-Content -Path $Report -Value ("Date: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")) -Encoding UTF8
Add-Content -Path $Report -Value ("InstallDir: " + $InstallDir) -Encoding UTF8

Assert-PackageLayout

if (-not (Test-Admin)) {
  Write-Log "This installer must run as administrator." "ERROR"
  exit 5
}

Enable-ModernTls
Refresh-LocalPath
Write-SystemReport
if ($WindowsBuild -lt 17763) {
  Write-Log "Stopping: Windows 10 1809/build 17763 or newer is required." "ERROR"
  exit 6
}
if (-not $ArchitectureSupported) {
  Write-Log "Stopping: this offline package supports x64 Windows only." "ERROR"
  exit 7
}
Start-BaselineServices
Find-Proxy | Out-Null
Apply-ProxyForInstall
Test-Network
Repair-MicrosoftStore | Out-Null
Install-VC
Install-Node
Refresh-LocalPath
Install-Git
Refresh-LocalPath
Configure-NpmProxy
Install-ClaudeCode
Install-Codex
Write-FinalSummary

Write-Host ""
Write-Host "完成。报告已生成：$Report"
if ($CodexAppInstalled -or $CodexCliInstalled) {
  exit 0
}
exit 10
