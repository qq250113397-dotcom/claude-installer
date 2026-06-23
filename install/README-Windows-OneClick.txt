Codex + Claude Code Windows 一键安装包
=====================================

适用场景
--------
1. Windows 10/11 64 位。
2. 系统能运行 PowerShell。
3. 客户不会手动配置 npm / PowerShell / 代理，希望尽量一键完成。

使用方法
--------
1. ZIP 版必须先解压整个文件夹，不要只拖出单个 cmd 文件。
   可以解压到桌面、D盘、E盘、下载目录等任意位置；不要求必须在桌面。
   但不能在 ZIP 压缩包预览窗口里直接双击运行。
   Windows 出于安全原因不会允许 ZIP “解压后无确认自动执行”。
   解压后双击 START-HERE.cmd 即可。
2. EXE 版是单文件自解压安装器，双击并同意管理员权限后会自动释放文件并启动。
3. 如需先验证、不实际安装，双击 VERIFY-WINDOWS-ONLY.cmd。
   它不会安装软件，也不会修改代理设置，只会生成桌面报告：
   Codex-Claude-Verify-Report.txt。
4. 确认验证报告没明显失败后，右键“一键安装-Codex-Claude-Code.cmd”，选择“以管理员身份运行”。
   如果解压后中文文件名显示异常，右键 START-ONECLICK.cmd 运行，效果相同。
5. 安装器会自动：
   - 检测 Windows 版本、PowerShell、TLS、证书/网络基础状态。
   - 启动或寻找 v2rayN 本地代理端口。
   - 只让当前安装进程的 PowerShell、npm、winget 使用 v2rayN，不永久覆盖系统代理。
   - 启动 AppX、Store、Windows Update 相关服务。
   - 重注册现有 Microsoft Store / Store Purchase / App Installer。
   - 离线安装或修复 App Installer 与 winget。
   - 重置 winget 源，并通过 Microsoft Store 源安装 Codex Windows App。
   - 安装 VC++ 运行库、Node.js、Git。
   - 安装 Claude Code。
   - 安装 Codex CLI，作为 Windows App 无法安装时的兜底。
   - 在桌面生成 Codex-Claude-OneClick-Report.txt。
6. 客户把桌面报告发回来，即可判断是否成功或卡在哪一步。

重要说明
--------
1. 不能承诺“任何阉割系统 100% 成功”。如果 AppX 命令、AppXSvc、ClipSVC、
   StateRepository 或 WinSxS 组件仓库被物理删除，普通依赖包无法重建 Windows 底座，
   必须使用微软官方 Windows ISO 执行保留应用和文件的就地修复安装。
2. Claude Code 官方推荐 Windows 原生安装器；npm 安装作为兜底。
3. Codex App 官方推荐 Windows 11。Win10 是 best effort；Codex CLI 可作为兜底。
4. Windows 10 必须至少是 1809/build 17763，且建议完整更新。
5. 新版安装器不会永久修改 Windows 系统代理。旧包造成断网时仍可运行
   “紧急恢复网络-关闭Windows代理.cmd”恢复。

资产说明
--------
assets\v2rayN-windows-64-desktop-portable.zip   预置 v2rayN 便携包和分流规则
assets\node-v24.16.0-x64.msi                    Node.js 离线安装包
assets\Git-2.54.0-64-bit.exe                    Git for Windows x64 离线安装包
assets\VC_redist.x64.exe                        VC++ x64 运行库
assets\VC_redist.x86.exe                        VC++ x86 运行库
assets\AppInstaller\*.msixbundle                微软官方 App Installer / winget 离线包
assets\AppInstaller\Dependencies\x64\*.appx     App Installer x64 官方依赖

Git 安装包来自 git-for-windows 官方 GitHub release，并写入 SHA256SUMS.txt。
