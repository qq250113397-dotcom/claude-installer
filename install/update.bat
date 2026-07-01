@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

title Claude Code Updater

echo.
echo  ================================================
echo   Claude Code Windows Updater  v1.0.0
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

:: ----- Check current version -----
echo  [..] Checking current version...
claude --version >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] Claude Code not found. Please run install.bat first.
    echo.
    echo      If you just installed, open a NEW terminal window and try again.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('claude --version 2^>nul') do set CURRENT_VER=%%v
echo  [OK] Current version: !CURRENT_VER!
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

:: ----- Check latest version -----
echo  [..] Checking latest version...
for /f "tokens=*" %%v in ('npm view @anthropic-ai/claude-code version 2^>nul') do set LATEST_VER=%%v

if "!LATEST_VER!"=="" (
    echo  [!] Could not fetch latest version. Forcing update...
) else (
    echo  [..] Latest version: !LATEST_VER!
    if "!CURRENT_VER!"=="!LATEST_VER!" (
        echo.
        echo  [OK] Already up to date. No update needed.
        echo.
        pause
        exit /b 0
    )
    echo  [..] New version available. Updating...
)

echo.

:: ----- Update -----
echo  [..] Updating Claude Code...
echo  [..] This may take 1-3 minutes, please wait...
echo.

call :npm_update_mirror https://registry.npmmirror.com

if %errorLevel% neq 0 (
    echo.
    echo  [!] Update failed. Possible reasons:
    echo      - Network interrupted (check proxy)
    echo      - npm permission issue
    echo.
    echo  [..] Trying force reinstall via official registry...
    call :npm_install_official https://registry.npmjs.org
    if !errorLevel! neq 0 (
        echo  [!] Update still failed. See errors above.
        pause
        exit /b 1
    )
)

echo.

:: ----- Verify -----
echo  [..] Verifying update...
for /f "tokens=*" %%v in ('claude --version 2^>nul') do set NEW_VER=%%v

if "!NEW_VER!"=="" (
    echo  [!] Verification failed. Open a new terminal and run: claude --version
) else (
    echo  [OK] Claude Code updated to !NEW_VER!
)

echo.
echo  ================================================
echo   Update complete!
echo  ================================================
echo   Close this window and open a new PowerShell.
echo  ================================================
echo.
pause
exit /b 0

:: =====================================================
:: Subroutine: test connection
:: =====================================================
:curl_test
curl -s --max-time 10 --retry 3 --retry-all-errors --connect-timeout 10 "%~1" >nul 2>&1
exit /b %errorLevel%

:: =====================================================
:: Subroutine: npm update via CN mirror (clear proxy)
:: =====================================================
:npm_update_mirror
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
npm update -g @anthropic-ai/claude-code --registry %NPM_REGISTRY%
set "RC=%errorLevel%"
endlocal & exit /b %RC%

:: =====================================================
:: Subroutine: npm install via official registry (keep proxy)
:: =====================================================
:npm_install_official
set "NPM_REGISTRY=%~1"
set "NPM_CONFIG_FETCH_RETRIES=5"
set "NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=2000"
set "NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=10000"
set "npm_config_fetch_retries=5"
set "npm_config_fetch_retry_mintimeout=2000"
set "npm_config_fetch_retry_maxtimeout=10000"
npm install -g @anthropic-ai/claude-code@latest --registry %NPM_REGISTRY%
exit /b %errorLevel%
