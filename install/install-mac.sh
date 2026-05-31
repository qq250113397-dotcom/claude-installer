#!/bin/bash
# =====================================================
# Claude Code macOS 一键安装脚本
# 版本: 1.0.0
# =====================================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "  ${BLUE}[*]${NC} $1"; }
success() { echo -e "  ${GREEN}[✓]${NC} $1"; }
warning() { echo -e "  ${YELLOW}[!]${NC} $1"; }
error()   { echo -e "  ${RED}[✗]${NC} $1"; }

clear
echo ""
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║     Claude Code macOS 一键安装脚本           ║"
echo "  ║              版本 v1.0.0                      ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo ""
echo "  本脚本将自动完成以下操作："
echo "  1. 安装 Homebrew（macOS 包管理工具）"
echo "  2. 通过 Homebrew 安装 Node.js"
echo "  3. 安装 Claude Code"
echo ""
echo -n "  按回车键开始安装，按 Ctrl+C 取消..."
read

# ─────────────────────────────────────────────────────
# 第一步：检测 / 安装 Homebrew
# ─────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}▶ 第一步：检测 Homebrew${NC}"

if command -v brew &>/dev/null; then
    success "已检测到 Homebrew $(brew --version | head -1)"
else
    warning "未检测到 Homebrew，准备自动安装..."
    info "安装过程中可能需要输入系统密码（macOS 权限验证）"
    info "这可能需要 5-10 分钟，请保持网络通畅"
    echo ""

    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    if [ $? -ne 0 ]; then
        error "Homebrew 安装失败！"
        echo ""
        echo "  常见原因："
        echo "  - 网络未翻墙，无法访问 GitHub"
        echo "  - 请先确保代理已开启（参考步骤一），再重新运行本脚本"
        echo ""
        exit 1
    fi

    # Apple Silicon Mac 需要手动初始化 brew 路径
    if [[ $(uname -m) == "arm64" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        # 写入 shell 配置以便下次生效
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    fi

    success "Homebrew 安装完成"
fi

# ─────────────────────────────────────────────────────
# 第二步：检测 / 安装 Node.js
# ─────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}▶ 第二步：安装 Node.js${NC}"

if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)

    if [ "$NODE_MAJOR" -ge 18 ]; then
        success "已检测到 Node.js $NODE_VER（满足要求）"
    else
        warning "Node.js 版本过低（$NODE_VER，需要 v18+），准备升级..."
        brew install node
        if [ $? -ne 0 ]; then
            error "Node.js 升级失败，请检查网络连接"
            exit 1
        fi
        success "Node.js $(node --version) 升级完成"
    fi
else
    info "未检测到 Node.js，正在通过 Homebrew 安装..."
    brew install node

    if [ $? -ne 0 ]; then
        error "Node.js 安装失败！"
        echo ""
        echo "  请手动访问 https://nodejs.org 下载安装后重试"
        exit 1
    fi

    success "Node.js $(node --version) 安装完成"
fi

# ─────────────────────────────────────────────────────
# 第三步：检测网络连接
# ─────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}▶ 第三步：检测网络连接${NC}"
info "正在测试访问 npm 服务器..."

if curl -s --max-time 10 https://registry.npmjs.org/ &>/dev/null; then
    success "网络连接正常"
else
    warning "无法连接到 npm 服务器，请检查代理设置"
    echo ""
    echo "  请输入代理端口（常用值：7890 / 1080 / 10809）"
    echo -n "  代理端口（直接回车跳过）: "
    read PROXY_PORT

    if [ -n "$PROXY_PORT" ]; then
        export https_proxy="http://127.0.0.1:$PROXY_PORT"
        export http_proxy="http://127.0.0.1:$PROXY_PORT"
        info "已设置代理端口: $PROXY_PORT，重新测试连接..."

        if ! curl -s --max-time 10 https://registry.npmjs.org/ &>/dev/null; then
            error "仍然无法连接，请确认代理已开启且端口正确后重试"
            exit 1
        fi
        success "网络连接正常"
    else
        warning "跳过代理设置，继续尝试安装..."
    fi
fi

# ─────────────────────────────────────────────────────
# 第四步：安装 Claude Code
# ─────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}▶ 第四步：安装 Claude Code${NC}"
info "正在安装，这可能需要 1-3 分钟，请耐心等待..."
echo ""

npm install -g @anthropic-ai/claude-code --registry https://registry.npmjs.org

if [ $? -ne 0 ]; then
    warning "首次安装失败，尝试备用方式..."
    npm install -g @anthropic-ai/claude-code --registry https://registry.npmjs.org --prefer-online

    if [ $? -ne 0 ]; then
        error "安装失败！"
        echo ""
        echo "  常见原因及解决方法："
        echo "  - 网络代理未开启：请开启代理后重试"
        echo "  - 权限不足：尝试运行以下命令"
        echo "    sudo npm install -g @anthropic-ai/claude-code"
        echo ""
        exit 1
    fi
fi

# ─────────────────────────────────────────────────────
# 第五步：验证安装
# ─────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}▶ 第五步：验证安装${NC}"

# Apple Silicon 可能需要重新加载 brew 路径
if [[ $(uname -m) == "arm64" ]] && ! command -v claude &>/dev/null; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi

if command -v claude &>/dev/null; then
    CLAUDE_VER=$(claude --version 2>/dev/null)
    success "Claude Code $CLAUDE_VER 安装成功！"
else
    warning "claude 命令暂未找到（PATH 尚未刷新）"
    info "请关闭终端重新打开，再输入 claude 启动"
fi

echo ""
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║              ✅ 安装完成！                    ║"
echo "  ╠═══════════════════════════════════════════════╣"
echo "  ║  下一步：                                     ║"
echo "  ║  1. 关闭此终端，打开新的终端窗口             ║"
echo "  ║  2. 输入 claude 启动并完成登录               ║"
echo "  ║  3. 开始使用 AI 编程助手！                   ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo ""
