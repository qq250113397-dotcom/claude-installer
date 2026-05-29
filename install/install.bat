@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: =====================================================
:: Claude Code Windows 一键安装程序
:: 版本: 1.0.0
:: =====================================================

title Claude Code 安装程序

echo.
echo  ╔═══════════════════════════════════════════════╗
echo  ║       Claude Code Windows 一键安装程序        ║
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

:: ----- 网络连通性检查 -----
echo  [*] 正在检测网络连接...
curl -s --max-time 10 https://registry.npmjs.org/ >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  [!] 无法连接到 npm 服务器，请检查网络代理设置。
    echo.
    echo      解决方法：
    echo      1. 确认代理工具已启动
    echo      2. 开启系统代理 / 全局模式
    echo      3. 或手动设置代理端口后重试：
    echo.
    set /p PROXY_PORT="     请输入代理端口（常用: 7890 / 1080 / 10809，回车跳过）: "
    if not "!PROXY_PORT!"=="" (
        set HTTPS_PROXY=http://127.0.0.1:!PROXY_PORT!
        set HTTP_PROXY=http://127.0.0.1:!PROXY_PORT!
        echo  [*] 已设置代理端口: !PROXY_PORT!
        echo  [*] 重新测试连接...
        curl -s --max-time 10 https://registry.npmjs.org/ >nul 2>&1
        if !errorLevel! neq 0 (
            echo  [!] 仍然无法连接，请确认代理端口是否正确后重试。
            pause
            exit /b 1
        )
        echo  [✓] 网络连接正常
    ) else (
        echo  [!] 跳过代理设置，继续尝试安装...
    )
) else (
    echo  [✓] 网络连接正常
)

echo.

:: ----- 检测 Node.js -----
echo  [*] 正在检测 Node.js...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] 未检测到 Node.js，准备自动下载安装...
    call :install_nodejs
    if !errorLevel! neq 0 (
        echo  [!] Node.js 安装失败，请手动从 https://nodejs.org 下载安装后重试。
        pause
        exit /b 1
    )
) else (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do set NODE_VER=%%v
    echo  [✓] 检测到 Node.js !NODE_VER!

    :: 检查版本是否 >= 18
    for /f "tokens=1 delims=." %%m in ("!NODE_VER:v=!") do set NODE_MAJOR=%%m
    if !NODE_MAJOR! lss 18 (
        echo  [!] Node.js 版本过低（需要 v18+），准备更新...
        call :install_nodejs
    )
)

echo.

:: ----- 安装 Claude Code -----
echo  [*] 正在安装 Claude Code...
echo  [*] 这可能需要 1-3 分钟，请耐心等待...
echo.

npm install -g @anthropic-ai/claude-code --registry https://registry.npmjs.org

if %errorLevel% neq 0 (
    echo.
    echo  [!] 安装失败！可能的原因：
    echo      - 网络连接中断（请检查代理）
    echo      - npm 权限问题
    echo.
    echo  [*] 尝试使用备用方法安装...
    npm install -g @anthropic-ai/claude-code --registry https://registry.npmjs.org --prefer-online
    if !errorLevel! neq 0 (
        echo  [!] 安装仍然失败，请查看上方错误信息排查问题。
        echo  [*] 更多帮助请访问 FAQ 页面。
        pause
        exit /b 1
    )
)

echo.

:: ----- 验证安装 -----
echo  [*] 正在验证安装...
claude --version >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] 验证失败：claude 命令未找到
    echo  [*] 请重启终端后再试，或重启电脑后运行 claude
) else (
    for /f "tokens=*" %%v in ('claude --version 2^>nul') do set CLAUDE_VER=%%v
    echo  [✓] Claude Code !CLAUDE_VER! 安装成功！
)

echo.
echo  ╔═══════════════════════════════════════════════╗
echo  ║              ✅ 安装完成！                    ║
echo  ╠═══════════════════════════════════════════════╣
echo  ║  下一步：                                     ║
echo  ║  1. 关闭此窗口，打开新的 PowerShell          ║
echo  ║  2. 输入 claude 启动并完成登录               ║
echo  ║  3. 开始使用 AI 编程助手！                   ║
echo  ╚═══════════════════════════════════════════════╝
echo.
pause
exit /b 0

:: =====================================================
:: 子程序：安装 Node.js
:: =====================================================
:install_nodejs
echo.
echo  [*] 正在下载 Node.js LTS...

set NODE_VERSION=22.13.1
set NODE_URL=https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-x64.msi
set NODE_MSI=%TEMP%\node-install.msi

echo  [*] 下载地址: %NODE_URL%
curl -L --progress-bar -o "%NODE_MSI%" "%NODE_URL%"

if %errorLevel% neq 0 (
    echo  [!] Node.js 下载失败，请检查网络连接。
    exit /b 1
)

echo  [*] 正在静默安装 Node.js，请稍候...
msiexec /i "%NODE_MSI%" /quiet /norestart ADDLOCAL=ALL

if %errorLevel% neq 0 (
    echo  [!] Node.js 安装失败。
    del "%NODE_MSI%" >nul 2>&1
    exit /b 1
)

del "%NODE_MSI%" >nul 2>&1

:: 刷新 PATH
call RefreshEnv.cmd >nul 2>&1
:: 手动添加 Node.js 到当前会话 PATH
for /f "tokens=*" %%p in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\node.exe" /ve 2^>nul ^| find "REG_SZ"') do (
    for %%d in ("%%~dpp") do set NODE_DIR=%%~fd
)
if not "!NODE_DIR!"=="" set PATH=!NODE_DIR!;!PATH!

:: 尝试通过常用路径找到 node
if not exist "%ProgramFiles%\nodejs\node.exe" (
    if not exist "%ProgramFiles(x86)%\nodejs\node.exe" (
        echo  [!] Node.js 安装位置未找到，请重启终端后继续。
        exit /b 0
    ) else (
        set PATH=%ProgramFiles(x86)%\nodejs;!PATH!
    )
) else (
    set PATH=%ProgramFiles%\nodejs;!PATH!
)

echo  [✓] Node.js 安装完成
exit /b 0
