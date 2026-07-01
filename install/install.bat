@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

title Claude Code Installer

echo.
echo  ================================================
echo   Claude Code Windows Installer  v1.0.0
echo  ================================================
echo.

:: ----- Admin check -----
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] Please run as Administrator!
    echo.
    echo      Right-click this file and choose "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo  [OK] Running as administrator
echo.

:: ----- Network check -----
echo  [..] Checking network connection...
call :curl_test https://registry.npmjs.org/
if %errorLevel% neq 0 (
    echo.
    echo  [!] Cannot reach npm server. Check your proxy settings.
    echo.
    set /p PROXY_PORT="     Proxy port (common: 7890 / 1080 / 10809, Enter to skip): "
    if not "!PROXY_PORT!"=="" (
        set HTTPS_PROXY=http://127.0.0.1:!PROXY_PORT!
        set HTTP_PROXY=http://127.0.0.1:!PROXY_PORT!
        echo  [..] Proxy set to port: !PROXY_PORT!
        echo  [..] Retrying connection...
        call :curl_test https://registry.npmjs.org/
        if !errorLevel! neq 0 (
            echo  [!] Still cannot connect. Check your proxy port and try again.
            pause
            exit /b 1
        )
        echo  [OK] Network OK
    ) else (
        echo  [!] Skipping proxy, continuing anyway...
    )
) else (
    echo  [OK] Network OK
)

echo.

:: ----- Node.js check -----
echo  [..] Checking Node.js...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] Node.js not found. Downloading...
    call :install_nodejs
    if !errorLevel! neq 0 (
        echo  [!] Node.js install failed. Download manually from https://nodejs.org
        pause
        exit /b 1
    )
) else (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do set NODE_VER=%%v
    echo  [OK] Node.js !NODE_VER! found

    for /f "tokens=1 delims=." %%m in ("!NODE_VER:v=!") do set NODE_MAJOR=%%m
    if !NODE_MAJOR! lss 18 (
        echo  [!] Node.js version too old (need v18+). Upgrading...
        call :install_nodejs
    )
)

echo.

:: ----- Install Claude Code -----
echo  [..] Installing Claude Code...
echo  [..] This may take 1-3 minutes, please wait...
echo.

call :install_claude_mirror https://registry.npmmirror.com

if %errorLevel% neq 0 (
    echo.
    echo  [!] Install failed. Possible reasons:
    echo      - Network interrupted (check proxy)
    echo      - npm permission issue
    echo.
    echo  [..] Trying official npm registry...
    call :install_claude_official https://registry.npmjs.org
    if !errorLevel! neq 0 (
        echo  [!] Install still failed. See errors above.
        pause
        exit /b 1
    )
)

echo.

:: ----- Verify -----
echo  [..] Verifying installation...
claude --version >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] Verification failed: claude command not found
    echo  [*] Please open a new terminal window and run: claude --version
) else (
    for /f "tokens=*" %%v in ('claude --version 2^>nul') do set CLAUDE_VER=%%v
    echo  [OK] Claude Code !CLAUDE_VER! installed successfully!
)

echo.
echo  ================================================
echo   Install complete!
echo  ================================================
echo   Next steps:
echo   1. Close this window
echo   2. Open a new PowerShell window
echo   3. Type: claude
echo  ================================================
echo.
pause
exit /b 0

:: =====================================================
:: Subroutine: install Node.js
:: =====================================================
:install_nodejs
echo.
echo  [..] Downloading Node.js LTS...

set NODE_VERSION=22.13.1
set NODE_URL=https://registry.npmmirror.com/-/binary/node/v%NODE_VERSION%/node-v%NODE_VERSION%-x64.msi
set NODE_URL_ALT=https://npmmirror.com/mirrors/node/v%NODE_VERSION%/node-v%NODE_VERSION%-x64.msi
set NODE_URL_FALLBACK=https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-x64.msi
set NODE_MSI=%TEMP%\node-install.msi

echo  [..] Trying CN mirror (no proxy needed)...
call :curl_download_direct "%NODE_URL%" "%NODE_MSI%"
if %errorLevel% neq 0 (
    echo  [!] Mirror 1 failed, trying mirror 2...
    call :curl_download_direct "%NODE_URL_ALT%" "%NODE_MSI%"
)

if %errorLevel% neq 0 (
    echo  [!] Mirror 2 failed, trying official source...
    curl -L --retry 5 --retry-all-errors --connect-timeout 15 --progress-bar -o "%NODE_MSI%" "%NODE_URL_FALLBACK%"
)

if %errorLevel% neq 0 (
    echo  [!] Node.js download failed. Check your network.
    exit /b 1
)

echo  [..] Installing Node.js silently...
msiexec /i "%NODE_MSI%" /quiet /norestart ADDLOCAL=ALL

if %errorLevel% neq 0 (
    echo  [!] Node.js install failed.
    del "%NODE_MSI%" >nul 2>&1
    exit /b 1
)

del "%NODE_MSI%" >nul 2>&1

:: Refresh PATH in current session
call RefreshEnv.cmd >nul 2>&1
for /f "tokens=*" %%p in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\node.exe" /ve 2^>nul ^| find "REG_SZ"') do (
    for %%d in ("%%~dpp") do set NODE_DIR=%%~fd
)
if not "!NODE_DIR!"=="" set PATH=!NODE_DIR!;!PATH!

if not exist "%ProgramFiles%\nodejs\node.exe" (
    if not exist "%ProgramFiles(x86)%\nodejs\node.exe" (
        echo  [!] Node.js install path not found. Please restart your terminal.
        exit /b 0
    ) else (
        set PATH=%ProgramFiles(x86)%\nodejs;!PATH!
    )
) else (
    set PATH=%ProgramFiles%\nodejs;!PATH!
)

echo  [OK] Node.js installed
exit /b 0

:: =====================================================
:: Subroutine: download without proxy
:: =====================================================
:curl_download_direct
setlocal
set "DOWNLOAD_URL=%~1"
set "DOWNLOAD_OUT=%~2"
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "http_proxy="
set "https_proxy="
set "ALL_PROXY="
set "all_proxy="
curl -L --retry 5 --retry-all-errors --connect-timeout 15 --progress-bar -o "%DOWNLOAD_OUT%" "%DOWNLOAD_URL%"
set "RC=%errorLevel%"
endlocal & exit /b %RC%

:: =====================================================
:: Subroutine: test connection (keep current proxy)
:: =====================================================
:curl_test
curl -s --max-time 10 --retry 3 --retry-all-errors --connect-timeout 10 "%~1" >nul 2>&1
exit /b %errorLevel%

:: =====================================================
:: Subroutine: install via CN mirror (clear proxy)
:: =====================================================
:install_claude_mirror
set "NPM_REGISTRY=%~1"
set "NPM_CONFIG_FETCH_RETRIES=5"
set "NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=2000"
set "NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=10000"
set "npm_config_fetch_retries=5"
set "npm_config_fetch_retry_mintimeout=2000"
set "npm_config_fetch_retry_maxtimeout=10000"
setlocal
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "http_proxy="
set "https_proxy="
set "ALL_PROXY="
set "all_proxy="
echo  [..] Using registry: %NPM_REGISTRY%
npm install -g @anthropic-ai/claude-code --registry %NPM_REGISTRY%
set "RC=%errorLevel%"
endlocal & exit /b %RC%

:: =====================================================
:: Subroutine: install via official registry (keep proxy)
:: =====================================================
:install_claude_official
set "NPM_REGISTRY=%~1"
set "NPM_CONFIG_FETCH_RETRIES=5"
set "NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=2000"
set "NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=10000"
set "npm_config_fetch_retries=5"
set "npm_config_fetch_retry_mintimeout=2000"
set "npm_config_fetch_retry_maxtimeout=10000"
echo  [..] Using registry: %NPM_REGISTRY%
npm install -g @anthropic-ai/claude-code --registry %NPM_REGISTRY%
exit /b %errorLevel%
