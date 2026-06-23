!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

!define APPNAME "Codex Windows 环境修复与安装"
!define APPVERSION "3.0.0"

Name "${APPNAME}"
OutFile "..\dist\Codex-Windows-Store-OneClick.exe"
InstallDir "$LOCALAPPDATA\Programs\Codex-Windows-Store-OneClick"
RequestExecutionLevel admin
Unicode True
ManifestDPIAware True
ManifestSupportedOS Win10
SetCompressor /SOLID lzma

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Codex Windows 一键环境修复"
!define MUI_WELCOMEPAGE_TEXT "程序将释放离线依赖，修复 App Installer/winget，并尝试通过 Microsoft Store 源安装 Codex。$\r$\n$\r$\n支持完整的 Windows 10 1809+ 和 Windows 11 x64。被深度删除 AppX/WinSxS 的精简系统仍可能需要微软官方 ISO 就地修复。"
!define MUI_FINISHPAGE_TITLE "文件已释放，安装程序已启动"
!define MUI_FINISHPAGE_TEXT "请不要关闭随后出现的命令行窗口。安装完成后，桌面会生成 Codex-Claude-OneClick-Report.txt。"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "SimpChinese"

Section "Install"
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "此离线包只支持 64 位 Windows 10/11。"
    Abort
  ${EndIf}

  SetOutPath "$INSTDIR"
  File /r "..\dist\Codex-Windows-Store-OneClick\*.*"
  Exec '"$INSTDIR\START-HERE.cmd"'
SectionEnd
