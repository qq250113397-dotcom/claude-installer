; ============================================================
; Claude Code Windows 安装程序 — NSIS 配置
; ============================================================
;
; 【编译方法】
;   方法 A：右键此文件 > "Compile NSIS Script"
;   方法 B：命令行
;     makensis installer.nsi
;   方法 C：PowerShell（NSIS 在 PATH 中）
;     cd build && makensis installer.nsi
;
;   下载 NSIS: https://nsis.sourceforge.io/Download
;   输出: ../dist/claude-code-setup.exe
;
; 【发布前必改项】
;   - APP_URL      : 替换为实际网站地址
;   - MUI_ICON     : 如有 .ico 文件，修改路径
; ============================================================

; ── 引入插件 ─────────────────────────────────────────────────
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

; ── 常量定义 ─────────────────────────────────────────────────
!define APPNAME     "Claude Code 安装助手"
!define APPVERSION  "2.0.0"
!define PUBLISHER   "Claude Code 安装助手"
!define APP_URL     "https://example.com"
!define INSTDIR_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClaudeCodeInstaller"

; ── 基础设置 ─────────────────────────────────────────────────
Name            "${APPNAME}"
OutFile         "..\dist\claude-code-setup.exe"
InstallDir      "$PROGRAMFILES64\Claude Code Installer"
InstallDirRegKey HKLM "${INSTDIR_KEY}" "InstallDir"
RequestExecutionLevel admin
Unicode         True
ManifestDPIAware True
ManifestSupportedOS Win10

; ── MUI 界面设置 ─────────────────────────────────────────────
; 图标（NSIS 自带图标，如有自定义 .ico 替换路径）
!define MUI_ICON    "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON  "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

; 欢迎页
!define MUI_WELCOMEPAGE_TITLE   "欢迎使用 Claude Code 安装向导"
!define MUI_WELCOMEPAGE_TEXT    \
    "此向导将在你的电脑上安装 Claude Code 安装助手。$\r$\n$\r$\n\
    安装完成后，向导会启动 Codex + Claude Code 一键安装程序。$\r$\n\
    程序会自动检测依赖、启动 v2rayN、注入代理并安装所需工具。$\r$\n$\r$\n\
    点击「下一步」继续。"

; 完成页
!define MUI_FINISHPAGE_TITLE    "安装完成"
!define MUI_FINISHPAGE_TEXT     \
    "Claude Code 安装助手已安装完成。$\r$\n$\r$\n\
    勾选下方选项并点击「完成」，将自动打开一键安装程序（命令行窗口）。$\r$\n\
    安装完成后，桌面会生成 Codex-Claude-OneClick-Report.txt。"

; 完成页「立即运行」选项（默认勾选）
!define MUI_FINISHPAGE_RUN          "$INSTDIR\一键安装-Codex-Claude-Code.cmd"
!define MUI_FINISHPAGE_RUN_TEXT     "立即运行 Codex + Claude Code 一键安装程序（推荐）"
; !define MUI_FINISHPAGE_RUN_NOTCHECKED  ; 取消注释 = 默认不勾选

; 中止警告
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "确定要退出安装向导吗？"

; ── 安装页面顺序 ─────────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; ── 卸载页面顺序 ─────────────────────────────────────────────
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; ── 语言（必须在页面定义之后） ───────────────────────────────
!insertmacro MUI_LANGUAGE "SimpChinese"

; ============================================================
; 安装 Section
; ============================================================
Section "主程序" SecMain
  ; 仅支持 64 位系统
  ${If} ${RunningX64}
    SetRegView 64
  ${Else}
    MessageBox MB_OK|MB_ICONSTOP "Claude Code 仅支持 64 位 Windows，安装中止。"
    Abort
  ${EndIf}

  SetOutPath "$INSTDIR"

  ; 安装批处理文件和离线资产
  File "..\install\install.bat"
  File "..\install\update.bat"
  File "..\install\一键安装-Codex-Claude-Code.cmd"
  File "..\install\紧急恢复网络-关闭Windows代理.cmd"
  File "..\install\START-ONECLICK.cmd"
  File "..\install\EMERGENCY-PROXY-RESET.cmd"
  File "..\install\VERIFY-WINDOWS-ONLY.cmd"
  File "..\install\README-Windows-OneClick.txt"
  SetOutPath "$INSTDIR\lib"
  File "..\install\lib\oneclick-windows.ps1"
  File "..\install\lib\verify-windows-only.ps1"
  SetOutPath "$INSTDIR\assets"
  File /nonfatal "..\install\assets\v2rayN-windows-64-desktop-portable.zip"
  File /nonfatal "..\install\assets\node-v24.16.0-x64.msi"
  File /nonfatal "..\install\assets\VC_redist.x64.exe"
  File /nonfatal "..\install\assets\VC_redist.x86.exe"
  File /nonfatal "..\install\assets\Git-*-64-bit.exe"
  SetOutPath "$INSTDIR"

  ; 注册表：用于「程序和功能」中显示卸载条目
  WriteRegStr  HKLM "${INSTDIR_KEY}" "DisplayName"     "${APPNAME}"
  WriteRegStr  HKLM "${INSTDIR_KEY}" "DisplayVersion"  "${APPVERSION}"
  WriteRegStr  HKLM "${INSTDIR_KEY}" "Publisher"       "${PUBLISHER}"
  WriteRegStr  HKLM "${INSTDIR_KEY}" "URLInfoAbout"    "${APP_URL}"
  WriteRegStr  HKLM "${INSTDIR_KEY}" "InstallDir"      "$INSTDIR"
  WriteRegStr  HKLM "${INSTDIR_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr  HKLM "${INSTDIR_KEY}" "DisplayIcon"     "$SYSDIR\cmd.exe"
  WriteRegDWORD HKLM "${INSTDIR_KEY}" "NoModify"       1
  WriteRegDWORD HKLM "${INSTDIR_KEY}" "NoRepair"       1

  ; 生成卸载程序
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; 开始菜单快捷方式
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortcut  "$SMPROGRAMS\${APPNAME}\一键安装 Codex + Claude Code.lnk" \
                  "$INSTDIR\一键安装-Codex-Claude-Code.cmd" "" "$SYSDIR\cmd.exe" 0 \
                  SW_SHOWNORMAL "" "自动检测依赖、代理并安装 Codex 与 Claude Code"
  CreateShortcut  "$SMPROGRAMS\${APPNAME}\紧急恢复网络.lnk" \
                  "$INSTDIR\紧急恢复网络-关闭Windows代理.cmd" "" "$SYSDIR\cmd.exe" 0 \
                  SW_SHOWNORMAL "" "关闭 Windows 系统代理，恢复直连网络"
  CreateShortcut  "$SMPROGRAMS\${APPNAME}\更新 Claude Code.lnk" \
                  "$INSTDIR\update.bat" "" "$SYSDIR\cmd.exe" 0 \
                  SW_SHOWNORMAL "" "将 Claude Code 更新到最新版本"
  CreateShortcut  "$SMPROGRAMS\${APPNAME}\卸载.lnk" \
                  "$INSTDIR\uninstall.exe"

SectionEnd

; ============================================================
; 卸载 Section
; ============================================================
Section "Uninstall"
  SetRegView 64

  ; 删除安装文件
  Delete "$INSTDIR\install.bat"
  Delete "$INSTDIR\update.bat"
  Delete "$INSTDIR\一键安装-Codex-Claude-Code.cmd"
  Delete "$INSTDIR\紧急恢复网络-关闭Windows代理.cmd"
  Delete "$INSTDIR\START-ONECLICK.cmd"
  Delete "$INSTDIR\EMERGENCY-PROXY-RESET.cmd"
  Delete "$INSTDIR\VERIFY-WINDOWS-ONLY.cmd"
  Delete "$INSTDIR\README-Windows-OneClick.txt"
  Delete "$INSTDIR\lib\oneclick-windows.ps1"
  Delete "$INSTDIR\lib\verify-windows-only.ps1"
  RMDir  "$INSTDIR\lib"
  Delete "$INSTDIR\assets\v2rayN-windows-64-desktop-portable.zip"
  Delete "$INSTDIR\assets\node-v24.16.0-x64.msi"
  Delete "$INSTDIR\assets\VC_redist.x64.exe"
  Delete "$INSTDIR\assets\VC_redist.x86.exe"
  Delete "$INSTDIR\assets\Git-*-64-bit.exe"
  RMDir  "$INSTDIR\assets"
  Delete "$INSTDIR\uninstall.exe"
  RMDir  "$INSTDIR"

  ; 删除开始菜单
  Delete "$SMPROGRAMS\${APPNAME}\一键安装 Codex + Claude Code.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\紧急恢复网络.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\更新 Claude Code.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\卸载.lnk"
  RMDir  "$SMPROGRAMS\${APPNAME}"

  ; 删除桌面快捷方式（若用户手动创建也一并清除）
  Delete "$DESKTOP\更新 Claude Code.lnk"

  ; 清除注册表卸载条目
  DeleteRegKey HKLM "${INSTDIR_KEY}"

  MessageBox MB_OK \
    "Claude Code 安装助手已卸载。$\r$\n$\r$\n\
    注意：Claude Code 本身（npm 包）未被删除。$\r$\n\
    如需卸载，请在 PowerShell 中运行：$\r$\n\
    npm uninstall -g @anthropic-ai/claude-code"

SectionEnd
