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

npm_install_direct() {
    local package_name="$1"
    local registry_url="$2"
    env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy \
      npm install -g "$package_name" \
      --registry "$registry_url" \
      --fetch-retries=5 \
      --fetch-retry-mintimeout=2000 \
      --fetch-retry-maxtimeout=10000
}

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
read -r

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

    info "优先使用国内镜像安装，无需代理..."
    if /bin/bash -c "$(curl -fsSL https://gitee.com/cunkai/HomebrewCN/raw/master/Homebrew.sh)" <<< "1"; then
        success "Homebrew 通过国内镜像安装完成"
    else
        warning "国内镜像失败，尝试官方源（需代理）..."
        if ! /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; then
            error "Homebrew 安装失败！请确保代理已开启后重试"
            exit 1
        fi
    fi

    # Apple Silicon Mac 需要手动初始化 brew 路径
    if [[ $(uname -m) == "arm64" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        # 写入 shell 配置以便下次生效
        brew_shellenv_line="eval \"\$(/opt/homebrew/bin/brew shellenv)\""
        if ! grep -qxF "$brew_shellenv_line" "$HOME/.zprofile" 2>/dev/null; then
            printf '%s\n' "$brew_shellenv_line" >> "$HOME/.zprofile"
        fi
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
        if ! brew install node; then
            error "Node.js 升级失败，请检查网络连接"
            exit 1
        fi
        success "Node.js $(node --version) 升级完成"
    fi
else
    info "未检测到 Node.js，正在通过 Homebrew 安装..."
    if ! brew install node; then
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

if curl -s --max-time 10 --retry 3 --retry-all-errors --connect-timeout 10 https://registry.npmjs.org/ &>/dev/null; then
    success "网络连接正常"
else
    warning "无法连接到 npm 服务器，请检查代理设置"
    echo ""
    echo "  请输入代理端口（常用值：7890 / 1080 / 10809）"
    echo -n "  代理端口（直接回车跳过）: "
    read -r PROXY_PORT

    if [ -n "$PROXY_PORT" ]; then
        export https_proxy="http://127.0.0.1:$PROXY_PORT"
        export http_proxy="http://127.0.0.1:$PROXY_PORT"
        info "已设置代理端口: $PROXY_PORT，重新测试连接..."

        if ! curl -s --max-time 10 --retry 3 --retry-all-errors --connect-timeout 10 https://registry.npmjs.org/ &>/dev/null; then
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

if ! npm_install_direct "@anthropic-ai/claude-code" "https://registry.npmmirror.com"; then
    warning "首次安装失败，尝试备用方式..."
    if ! npm install -g @anthropic-ai/claude-code --registry https://registry.npmjs.org \
        --fetch-retries=5 --fetch-retry-mintimeout=2000 --fetch-retry-maxtimeout=10000 --prefer-online; then
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
