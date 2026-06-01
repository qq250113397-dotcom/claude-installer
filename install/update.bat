@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: =====================================================
:: Claude Code Windows 一键更新程序
:: 版本: 1.0.0
:: =====================================================

title Claude Code 更新程序

echo.
echo  ╔═══════════════════════════════════════════════╗
echo  ║       Claude Code Windows 更新程序            ║
echo  ║            版本 v1.0.0                        ║
echo  ╚═══════════════════════════════════════════════╝
echo.

:: ----- 管理员权限检查 -----
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] 请以管理员身份运行此脚本！
    echo.
    echo      右键点击此文件，选择「以管理员身份运行」
    echo.
    pause
    exit /b 1
)

echo  [✓] 已获取管理员权限
echo.

:: ----- 检查当前版本 -----
echo  [*] 正在检查当前版本...
claude --version >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] 未检测到 Claude Code，请先运行 install.bat 进行安装。
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('claude --version 2^>nul') do set CURRENT_VER=%%v
echo  [✓] 当前版本：!CURRENT_VER!
echo.

:: ----- 网络连通性检查 -----
echo  [*] 正在检测网络连接...
call :curl_test https://registry.npmjs.org/
if %errorLevel% neq 0 (
    echo.
    echo  [!] 无法连接到 npm 服务器，请检查网络代理设置。
    echo.
    set /p PROXY_PORT="     请输入代理端口（常用: 7890 / 1080 / 10809，回车跳过）: "
    if not "!PROXY_PORT!"=="" (
        set HTTPS_PROXY=http://127.0.0.1:!PROXY_PORT!
        set HTTP_PROXY=http://127.0.0.1:!PROXY_PORT!
        echo  [*] 已设置代理端口: !PROXY_PORT!
        echo  [*] 重新测试连接...
        call :curl_test https://registry.npmjs.org/
        if !errorLevel! neq 0 (
            echo  [!] 仍然无法连接，请确认代理端口是否正确后重试。
            pause
            exit /b 1
        )
        echo  [✓] 网络连接正常
    ) else (
        echo  [!] 跳过代理设置，继续尝试更新...
    )
) else (
    echo  [✓] 网络连接正常
)

echo.

:: ----- 检查最新版本 -----
echo  [*] 正在查询最新版本...
for /f "tokens=*" %%v in ('npm view @anthropic-ai/claude-code version 2^>nul') do set LATEST_VER=%%v

if "!LATEST_VER!"=="" (
    echo  [!] 无法获取最新版本信息，将尝试强制更新...
) else (
    echo  [*] 最新版本：!LATEST_VER!
    if "!CURRENT_VER!"=="!LATEST_VER!" (
        echo.
        echo  [✓] 当前已是最新版本，无需更新。
        echo.
        pause
        exit /b 0
    )
    echo  [*] 发现新版本，准备更新...
)

echo.

:: ----- 执行更新 -----
echo  [*] 正在更新 Claude Code...
echo  [*] 这可能需要 1-3 分钟，请耐心等待...
echo.

call :npm_update_mirror https://registry.npmmirror.com

if %errorLevel% neq 0 (
    echo.
    echo  [!] 更新失败！可能的原因：
    echo      - 网络连接中断（请检查代理）
    echo      - npm 权限问题
    echo.
    echo  [*] 尝试使用强制安装方式更新...
    call :npm_install_official https://registry.npmjs.org
    if !errorLevel! neq 0 (
        echo  [!] 更新仍然失败，请查看上方错误信息排查问题。
        pause
        exit /b 1
    )
)

echo.

:: ----- 验证更新 -----
echo  [*] 正在验证更新...
for /f "tokens=*" %%v in ('claude --version 2^>nul') do set NEW_VER=%%v

if "!NEW_VER!"=="" (
    echo  [!] 验证失败，请重启终端后运行 claude --version 确认版本。
) else (
    echo  [✓] Claude Code 已更新至 !NEW_VER!
)

echo.
echo  ╔═══════════════════════════════════════════════╗
echo  ║              ✅ 更新完成！                    ║
echo  ╠═══════════════════════════════════════════════╣
echo  ║  请关闭此窗口，打开新的 PowerShell 使用。    ║
echo  ╚═══════════════════════════════════════════════╝
echo.
pause
exit /b 0

:: =====================================================
:: 子程序：测试连接
:: =====================================================
:curl_test
curl -s --max-time 10 --retry 3 --retry-all-errors --connect-timeout 10 "%~1" >nul 2>&1
exit /b %errorLevel%

:: =====================================================
:: 子程序：npm 更新（国内镜像，清代理）
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
:: 子程序：npm 安装（保留代理）
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
