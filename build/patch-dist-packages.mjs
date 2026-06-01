#!/usr/bin/env node
/**
 * Patches existing dist packages in-place:
 * - Removes empty subscriptions from guiNDB.db
 * - Updates README.txt and launcher script with speed-test guidance
 *
 * Usage: node build/patch-dist-packages.mjs
 */
import { mkdtemp, rm, writeFile, readFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

const PACKAGES = [
  {
    zip: join(DIST, 'v2rayN-macos-arm64-portable.zip'),
    dbEntry: 'v2rayN-macos-arm64-portable/guiConfigs/guiNDB.db',
    readmeEntry: 'v2rayN-macos-arm64-portable/README.txt',
    launcherEntry: 'v2rayN-macos-arm64-portable/start-v2rayN.command',
    newReadme: macReadme(),
    newLauncher: macLauncher(),
    launcherMode: '755',
  },
  {
    zip: join(DIST, 'v2rayN-windows-64-desktop-portable.zip'),
    dbEntry: 'v2rayN-windows-64-desktop-portable/guiConfigs/guiNDB.db',
    readmeEntry: 'v2rayN-windows-64-desktop-portable/README.txt',
    launcherEntry: 'v2rayN-windows-64-desktop-portable/start-v2rayN.bat',
    newReadme: winReadme(),
    newLauncher: winLauncher(),
    launcherMode: null,
  },
];

for (const pkg of PACKAGES) {
  process.stdout.write(`\nPatching ${basename(pkg.zip)}...\n`);
  const tmp = await mkdtemp(join(tmpdir(), 'patch-'));
  try {
    await patchPackage(pkg, tmp);
    process.stdout.write(`  Done.\n`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function patchPackage(pkg, tmp) {
  // Extract DB
  const dbLocal = join(tmp, 'guiNDB.db');
  const dbRaw = spawnSync('unzip', ['-p', pkg.zip, pkg.dbEntry], { encoding: 'buffer' });
  if (dbRaw.status !== 0) throw new Error(`unzip db failed: ${dbRaw.stderr?.toString()}`);
  await writeFile(dbLocal, dbRaw.stdout);

  // Patch DB — delete empty subscriptions
  const sqlResult = spawnSync('sqlite3', ['-batch', dbLocal,
    "BEGIN; DELETE FROM SubItem WHERE Url IS NULL OR TRIM(Url) = ''; COMMIT;"
  ], { encoding: 'utf8' });
  if (sqlResult.status !== 0) throw new Error(`sqlite3 failed: ${sqlResult.stderr}`);
  const deleted = sqlResult.stdout;
  process.stdout.write(`  Removed empty subscriptions.\n`);

  // Write updated README
  const readmeLocal = join(tmp, 'README.txt');
  await writeFile(readmeLocal, pkg.newReadme, 'utf8');

  // Write updated launcher
  const launcherLocal = join(tmp, basename(pkg.launcherEntry));
  await writeFile(launcherLocal, pkg.newLauncher, 'utf8');

  // Replace files in zip using zip -d + zip to add
  // Step 1: remove old entries
  const del = spawnSync('zip', ['-d', pkg.zip, pkg.dbEntry, pkg.readmeEntry, pkg.launcherEntry], {
    encoding: 'utf8',
    cwd: tmp,
  });
  // zip -d returns exit 12 if nothing matched — that's OK
  if (del.status !== 0 && del.status !== 12) {
    throw new Error(`zip -d failed (${del.status}): ${del.stderr}`);
  }

  // Step 2: add updated files back with correct internal paths
  const dirPrefix = dirname(pkg.dbEntry); // e.g. v2rayN-macos-arm64-portable/guiConfigs
  const rootPrefix = dirname(pkg.readmeEntry); // e.g. v2rayN-macos-arm64-portable

  // We need to add files at specific internal paths using a staging dir
  const stage = join(tmp, 'stage');
  const dbDir = join(stage, dirPrefix);
  const rootDir = join(stage, rootPrefix);
  await rm(stage, { recursive: true, force: true });
  await import('node:fs/promises').then(fs => fs.mkdir(dbDir, { recursive: true }));
  await import('node:fs/promises').then(fs => fs.mkdir(rootDir, { recursive: true }));

  await copyFile(dbLocal, join(stage, pkg.dbEntry));
  await copyFile(readmeLocal, join(stage, pkg.readmeEntry));
  await copyFile(launcherLocal, join(stage, pkg.launcherEntry));

  const addArgs = [pkg.zip, pkg.dbEntry, pkg.readmeEntry, pkg.launcherEntry];
  if (pkg.launcherMode) {
    // For executable files, use --fifo workaround or just add normally (permissions lost)
    // zip doesn't easily set Unix permissions from CLI; we handle it via ditto on macOS
  }

  const add = spawnSync('zip', [pkg.zip, pkg.dbEntry, pkg.readmeEntry, pkg.launcherEntry], {
    encoding: 'utf8',
    cwd: stage,
  });
  if (add.status !== 0) throw new Error(`zip add failed: ${add.stderr}`);

  // Restore execute bit for .command file via zipnote or python zipfile
  if (pkg.launcherMode === '755') {
    restoreExecuteBit(pkg.zip, pkg.launcherEntry);
  }
}

function restoreExecuteBit(zipPath, entry) {
  // Set Unix permission 0755 (rwxr-xr-x) = 0o755 << 16 | 0o8000 (regular file)
  // External attributes byte for mode 0755 = (0o100755) << 16
  const script = `
import zipfile, stat
with zipfile.ZipFile('${zipPath}', 'a') as z:
    for info in z.infolist():
        if info.filename == '${entry}':
            info.external_attr = (stat.S_IFREG | 0o755) << 16
            break
print('exec bit set')
`;
  const result = spawnSync('python3', ['-c', script], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(`Warning: could not set exec bit: ${result.stderr}\n`);
  }
}

function macReadme() {
  return `v2rayN macOS 便携包

使用步骤：
1. 双击 start-v2rayN.command 启动 v2rayN
2. 软件打开后分流规则已自动生效，直接点"连接"即可
3. 如果节点延迟显示 -1，点顶栏闪电图标(⚡)全部测速，再双击延迟低的节点

安全提示（首次运行必看）：
- macOS 会弹出"无法打开"提示 → 去"系统设置 → 隐私与安全性"点"仍要打开"
- 然后重新双击 start-v2rayN.command

说明：
- 分流规则已预置：AI工具/海外流量走代理，国内直连
- macOS 配置存放在 ~/Library/Application Support/v2rayN/guiConfigs
`;
}

function macLauncher() {
  return `#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_SUPPORT="$HOME/Library/Application Support/v2rayN/guiConfigs"
SEED_DIR="$ROOT/guiConfigs"
mkdir -p "$APP_SUPPORT"

if [ ! -f "$APP_SUPPORT/guiNDB.db" ] && [ -f "$SEED_DIR/guiNDB.db" ]; then
  cp "$SEED_DIR/guiNDB.db" "$APP_SUPPORT/guiNDB.db"
fi

if [ ! -f "$APP_SUPPORT/guiNConfig.json" ] && [ -f "$SEED_DIR/guiNConfig.json" ]; then
  cp "$SEED_DIR/guiNConfig.json" "$APP_SUPPORT/guiNConfig.json"
fi

open "$ROOT/v2rayN.app" 2>/dev/null || {
  echo ""
  echo "⚠️  macOS 安全提示：系统阻止了 v2rayN 启动。"
  echo "    请前往：系统设置 → 隐私与安全性 → 点击「仍要打开」"
  echo "    然后重新双击 start-v2rayN.command 启动。"
  read -r -p "按回车键退出..."
  exit 1
}
echo "v2rayN 已启动，分流规则和节点已预置好，直接点连接即可。"
echo ""
echo "如果节点延迟显示 -1，点软件顶部闪电图标(⚡)全部测速，再双击延迟低的节点切换。"
read -r -p "按回车键退出..."
`;
}

function winReadme() {
  return `v2rayN Windows 便携版使用说明

1. 双击"start-v2rayN.bat"启动 v2rayN。
2. 软件打开后分流规则已自动生效，直接点"连接"即可。
3. 如果节点延迟显示 -1，点顶栏闪电图标(⚡)全部测速，再双击延迟低的节点。
4. 分流规则：AI工具/海外流量走代理，国内直连（已预置，无需手动导入）。
`;
}

function winLauncher() {
  return `@echo off
setlocal
chcp 65001 >nul 2>&1
set "ROOT=%~dp0"
start "" "%ROOT%v2rayN.exe"

echo.
echo  [*] 便携版已启动，分流规则和节点已预置好，直接点连接即可。
echo  [*] 如果节点延迟显示 -1，点软件顶部闪电图标（⚡）全部测速，再双击延迟低的节点切换。
echo.
pause
`;
}
