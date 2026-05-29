; ============================================================
; Claude Code Windows 安装程序 — Inno Setup 配置
; ============================================================
;
; 【编译方法】
;   1. 下载安装 Inno Setup 6.x:
;      https://jrsoftware.org/isdl.php
;   2. 用 Inno Setup Compiler 打开此文件
;   3. 按 F9 或菜单 Build > Compile
;   4. 输出: ../dist/claude-code-setup.exe
;
; 【发布前必改项】
;   - AppId       : 用 Tools > Generate GUID 重新生成，不要使用示例值
;   - AppURL      : 替换为你的实际网站地址
;   - SetupIconFile: 如有图标文件(.ico)，取消注释并填写路径
; ============================================================

#define AppName      "Claude Code 安装助手"
#define AppVersion   "1.0.0"
#define AppPublisher "Claude Code 安装助手"
#define AppURL       "https://example.com"
#define AppExeName   "claude-code-setup.exe"

; ── 基础信息 ────────────────────────────────────────────────
[Setup]
; AppId 唯一标识此应用（用于卸载记录），更新版本时保持不变
; 发布前请用 Inno Setup IDE > Tools > Generate GUID 替换此值
AppId={{A3F7E2D1-9B4C-4F8A-BEC3-12345678ABCD}

AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} v{#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}/faq
AppUpdatesURL={#AppURL}

; 安装目录
DefaultDirName={autopf}\Claude Code Installer
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes

; 输出
OutputDir=..\dist
OutputBaseFilename=claude-code-setup
; SetupIconFile=..\assets\icon.ico  ; 有图标时取消注释

; 压缩（lzma2 最小体积）
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes

; UI 风格
WizardStyle=modern
WizardSizePercent=110
WizardResizable=no

; 权限：安装 Node.js 和 npm 全局包需要管理员
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

; 系统要求：Windows 10+，64 位
MinVersion=10.0
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64

; 卸载显示
UninstallDisplayName={#AppName}
UninstallDisplayIcon={sys}\cmd.exe

; ── 语言 ────────────────────────────────────────────────────
[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

; ── 安装任务（用户可选） ─────────────────────────────────────
[Tasks]
Name: desktopicon; \
    Description: "在桌面创建「更新 Claude Code」快捷方式"; \
    GroupDescription: "附加选项:"; \
    Flags: unchecked

; ── 安装文件 ─────────────────────────────────────────────────
[Files]
; install.bat — 首次安装 Node.js + Claude Code
Source: "..\install\install.bat"; DestDir: "{app}"; Flags: ignoreversion

; update.bat — 日后更新 Claude Code 用
Source: "..\install\update.bat"; DestDir: "{app}"; Flags: ignoreversion

; ── 快捷方式 ─────────────────────────────────────────────────
[Icons]
; 开始菜单
Name: "{group}\更新 Claude Code"; \
    Filename: "{app}\update.bat"; \
    Comment: "将 Claude Code 更新到最新版本"

Name: "{group}\卸载 {#AppName}"; \
    Filename: "{uninstallexe}"

; 桌面（仅在用户勾选 desktopicon 任务时创建）
Name: "{commondesktop}\更新 Claude Code"; \
    Filename: "{app}\update.bat"; \
    Tasks: desktopicon; \
    Comment: "将 Claude Code 更新到最新版本"

; ── 安装后运行 ───────────────────────────────────────────────
[Run]
; shellexec + nowait：在独立 cmd 窗口中运行，安装向导不阻塞
; 用户在「完成」页面看到勾选项，默认勾选，点击完成后启动
Filename: "{app}\install.bat"; \
    Description: "立即运行 Claude Code 安装程序（推荐）"; \
    Flags: postinstall shellexec nowait

; ── Pascal 脚本：自定义完成页文字 ────────────────────────────
[Code]
procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
  begin
    WizardForm.FinishedLabel.Caption :=
      '安装向导已完成。' + #13#10 + #13#10 +
      '如果你勾选了「立即运行 Claude Code 安装程序」，' + #13#10 +
      '一个黑色命令行窗口将自动打开并完成安装，请耐心等待。' + #13#10 + #13#10 +
      '安装完成后，打开新的 PowerShell 输入 claude 即可开始使用。' + #13#10 + #13#10 +
      '日后更新 Claude Code：' + #13#10 +
      '  开始菜单 > Claude Code 安装助手 > 更新 Claude Code';
  end;
end;
