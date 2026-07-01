#requires -Version 5.1
$ErrorActionPreference = "Continue"

$Desktop = [Environment]::GetFolderPath("Desktop")
$Report = Join-Path $Desktop "v2rayN-repair-report.txt"
$Lines = New-Object System.Collections.Generic.List[string]
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = Split-Path -Parent $ScriptDir
$AssetsDir = Join-Path $InstallDir "assets"
$WorkRoot = Join-Path $env:LOCALAPPDATA "CodexClaudeOneClick\v2rayNRepair"

function Log {
  param([string]$Message)
  $Line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Write-Host $Line
  [void]$Lines.Add($Line)
}

function Run {
  param([string]$FilePath, [string[]]$Arguments)
  try {
    $p = Start-Process -FilePath $FilePath -ArgumentList $Arguments -Wait -PassThru -NoNewWindow
    Log "$FilePath exited with code $($p.ExitCode)"
  } catch {
    Log "WARN: $FilePath failed: $($_.Exception.Message)"
  }
}

function Find-V2rayN {
  $Candidates = @(
    (Join-Path $env:USERPROFILE "Desktop\v2rayN\v2rayN.exe"),
    (Join-Path $env:USERPROFILE "Desktop\v2rayN.exe"),
    (Join-Path $env:USERPROFILE "Downloads\v2rayN\v2rayN.exe"),
    (Join-Path $env:LOCALAPPDATA "v2rayN\v2rayN.exe"),
    (Join-Path $WorkRoot "v2rayN.exe"),
    (Join-Path $env:ProgramFiles "v2rayN\v2rayN.exe")
  )

  if (${env:ProgramFiles(x86)}) {
    $Candidates += (Join-Path ${env:ProgramFiles(x86)} "v2rayN\v2rayN.exe")
  }

  foreach ($Candidate in $Candidates) {
    if ($Candidate -and (Test-Path $Candidate)) {
      return (Resolve-Path $Candidate).Path
    }
  }

  try {
    $Shell = New-Object -ComObject WScript.Shell
    $Links = Get-ChildItem -Path $Desktop -Filter "*.lnk" -File -ErrorAction SilentlyContinue
    foreach ($Link in $Links) {
      $Target = $Shell.CreateShortcut($Link.FullName).TargetPath
      if ($Target -and (Split-Path $Target -Leaf) -ieq "v2rayN.exe" -and (Test-Path $Target)) {
        return (Resolve-Path $Target).Path
      }
    }
  } catch {}

  $SearchRoots = @(
    (Join-Path $env:USERPROFILE "Desktop"),
    (Join-Path $env:USERPROFILE "Downloads"),
    $InstallDir,
    $WorkRoot
  )

  if (Test-Path "D:\") { $SearchRoots += "D:\Downloads" }
  if (Test-Path "E:\") { $SearchRoots += "E:\Downloads" }

  foreach ($Root in $SearchRoots) {
    if (-not (Test-Path $Root)) { continue }
    try {
      $Found = Get-ChildItem -Path $Root -Filter "v2rayN.exe" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($Found) { return $Found.FullName }
    } catch {}
  }

  return $null
}

function Expand-BundledV2rayN {
  $Zip = Join-Path $AssetsDir "v2rayN-windows-64-desktop-portable.zip"
  if (-not (Test-Path $Zip)) {
    Log "WARN: bundled v2rayN zip was not found: $Zip"
    return $null
  }

  New-Item -ItemType Directory -Path $WorkRoot -Force | Out-Null
  $Existing = Get-ChildItem -Path $WorkRoot -Filter "v2rayN.exe" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($Existing) { return $Existing.FullName }

  try {
    Log "Extracting bundled v2rayN..."
    Expand-Archive -Path $Zip -DestinationPath $WorkRoot -Force
  } catch {
    Log "WARN: extracting bundled v2rayN failed: $($_.Exception.Message)"
    return $null
  }

  $Found = Get-ChildItem -Path $WorkRoot -Filter "v2rayN.exe" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($Found) { return $Found.FullName }

  Log "WARN: bundled v2rayN was extracted, but v2rayN.exe was not found."
  return $null
}

function Open-ProxySettingsRefresh {
  try {
    Add-Type -Namespace WinINet -Name Native -MemberDefinition '[DllImport("wininet.dll", SetLastError=true)] public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);'
    [WinINet.Native]::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0) | Out-Null
    [WinINet.Native]::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0) | Out-Null
    Log "Windows proxy refresh notification sent."
  } catch {
    Log "WARN: proxy refresh notification failed: $($_.Exception.Message)"
  }
}

function Get-ListeningProxyPorts {
  $Result = New-Object System.Collections.Generic.List[int]
  foreach ($Port in @(10808, 10809, 7890, 1080, 7897, 8080)) {
    try {
      $Conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -First 1
      if ($Conn) { [void]$Result.Add($Port) }
    } catch {}
  }
  return $Result.ToArray()
}

function Wait-ProxyPorts {
  for ($i = 1; $i -le 20; $i++) {
    $Ports = Get-ListeningProxyPorts
    if ($Ports.Count -gt 0) { return $Ports }
    Start-Sleep -Seconds 1
  }
  return @()
}

Log "v2rayN repair started."
Log "This tool resets local proxy and Windows network stack. It does not edit subscriptions or nodes."

$V2rayN = Find-V2rayN
if ($V2rayN) {
  Log "Found v2rayN: $V2rayN"
} else {
  Log "WARN: v2rayN.exe was not found. The bundled portable copy will be used if available."
  $V2rayN = Expand-BundledV2rayN
  if ($V2rayN) {
    Log "Bundled v2rayN ready: $V2rayN"
  }
}

Log "Step 1: stop v2rayN"
try {
  Get-Process -Name "v2rayN" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Log "v2rayN stop command completed."
} catch {
  Log "WARN: stopping v2rayN failed: $($_.Exception.Message)"
}

Log "Step 2: reset WinHTTP proxy"
Run "netsh.exe" @("winhttp", "reset", "proxy")

Log "Step 3: disable Windows user proxy"
try {
  $ProxyKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
  Set-ItemProperty -Path $ProxyKey -Name ProxyEnable -Type DWord -Value 0 -Force
  Remove-ItemProperty -Path $ProxyKey -Name AutoConfigURL -ErrorAction SilentlyContinue
  Log "Windows user proxy disabled."
} catch {
  Log "WARN: Windows user proxy update failed: $($_.Exception.Message)"
}
Open-ProxySettingsRefresh

Log "Step 4: flush DNS"
Run "ipconfig.exe" @("/flushdns")

Log "Step 5: reset Winsock"
Run "netsh.exe" @("winsock", "reset")

Log "Step 6: reset IP stack"
Run "netsh.exe" @("int", "ip", "reset")

Log "Step 7: restart v2rayN"
if ($V2rayN -and (Test-Path $V2rayN)) {
  try {
    Start-Process -FilePath $V2rayN | Out-Null
    Log "v2rayN started."
  } catch {
    Log "WARN: starting v2rayN failed: $($_.Exception.Message)"
  }
} else {
  Log "WARN: skipped v2rayN restart because v2rayN.exe was not found."
}

$Ports = Wait-ProxyPorts
if ($Ports.Count -gt 0) {
  Log "Detected local proxy ports: $($Ports -join ', ')"
} else {
  Log "WARN: no common local proxy port was detected."
}

Log "Repair completed. Reboot Windows once before testing again."
Log "If v2rayN still says invalid subscription content, the subscription URL or upstream server is the problem."
Log "If network tests still time out, the selected node/proxy route is not actually reaching overseas services."

try {
  $Lines | Set-Content -Path $Report -Encoding UTF8
  Write-Host ""
  Write-Host "Report: $Report"
} catch {
  Write-Host ""
  Write-Host "WARN: could not write report: $($_.Exception.Message)"
}
