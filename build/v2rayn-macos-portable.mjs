#!/usr/bin/env node
import { mkdtemp, rm, writeFile, copyFile, mkdir, stat } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { optimizePortablePackage } from './portable-package-optimize.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_OUT_DIR = join(ROOT, 'dist');
const DEFAULT_WORK_DIR = join(tmpdir(), 'v2rayn-macos-portable-build');
const DEFAULT_MOUNTED_VOLUME = '/Volumes/v2rayN Installer';
const DEFAULT_DMG_CANDIDATES = [
  join(process.env.HOME || process.env.USERPROFILE || '', 'Desktop', 'Claude网络环境搭建指南', '软件', 'v2rayN-macos-arm64.dmg'),
  join(process.env.HOME || process.env.USERPROFILE || '', 'Desktop', '软件', 'v2rayN-macos-arm64.dmg'),
];
const DEFAULT_CONFIG_DIR = join(process.env.HOME || process.env.USERPROFILE || '', 'Library', 'Application Support', 'v2rayN', 'guiConfigs');
const ROUTING_FILE = join(ROOT, 'website', 'v2rayn-routing.json');

const args = parseArgs(process.argv.slice(2));
const outDir = args['out-dir'] || DEFAULT_OUT_DIR;
const workDir = args.workdir || DEFAULT_WORK_DIR;
const packageName = args.name || 'v2rayN-macos-arm64-portable';
const launcherName = args.launcher || 'start-v2rayN.command';
const sourceConfigDir = resolve(args['source-config'] || DEFAULT_CONFIG_DIR);
const keepWork = args['keep-work'] === 'true';

const dmgCandidate = args.dmg || findExistingDmg();
if (!dmgCandidate) {
  throw new Error('No DMG found. Use --dmg to point at v2rayN-macos-arm64.dmg');
}
const dmgPath = resolve(dmgCandidate);

await mkdir(outDir, { recursive: true });
await mkdir(workDir, { recursive: true });

const scratch = await mkdtemp(join(workDir, '/'));
const mountPoint = join(scratch, 'mount');
const stagingRoot = join(scratch, packageName);
const appDest = join(stagingRoot, 'v2rayN.app');
let mountedHere = false;

try {
  const appSource = await resolveAppSource(dmgPath, mountPoint);
  await ensureFileExists(appSource, 'v2rayN.app inside the DMG');

  await mkdir(stagingRoot, { recursive: true });
  await copyBundle(appSource, appDest);

  await mkdir(join(stagingRoot, 'guiConfigs'), { recursive: true });
  await copyOptionalConfig(sourceConfigDir, join(stagingRoot, 'guiConfigs'));
  await copyFile(ROUTING_FILE, join(stagingRoot, 'ai-abroad-proxy-cn-direct.json'));
  await writeFile(join(stagingRoot, 'README.txt'), buildReadme(), 'utf8');
  await writeFile(join(stagingRoot, launcherName), buildLauncher({ launcherName }), { mode: 0o755 });
  const optimizeResult = await optimizePortablePackage(stagingRoot, { minLatencyMs: 400, probeTimeoutMs: 1200, limit: 24 });
  if (optimizeResult.selected) {
    process.stdout.write(`Auto-selected US node: ${optimizeResult.selected.remarks} ${optimizeResult.selected.address}:${optimizeResult.selected.port} (${optimizeResult.selected.latency} ms)\n`);
  }

  const outZip = join(outDir, `${packageName}.zip`);
  await removeIfExists(outZip);
  await zipDirectory(stagingRoot, outZip);
  process.stdout.write(`Created ${outZip}\n`);
} finally {
  if (mountedHere) {
    await unmountDmg(mountPoint).catch(() => {});
  }
  if (!keepWork) {
    await rm(scratch, { recursive: true, force: true });
  } else {
    process.stdout.write(`Kept workdir at ${scratch}\n`);
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const [key, inlineValue] = arg.slice(2).split('=');
    const value = inlineValue ?? argv[i + 1];
    if (inlineValue === undefined && value && !value.startsWith('--')) {
      i += 1;
    }
    out[key] = inlineValue ?? (value && !value.startsWith('--') ? value : 'true');
  }
  return out;
}

function findExistingDmg() {
  for (const candidate of DEFAULT_DMG_CANDIDATES) {
    try {
      if (candidate && requireStatSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return null;
}

function requireStatSync(path) {
  const s = statSync(path);
  return s.isFile() && s.size > 0;
}

async function mountDmg(dmgPath, mountPoint) {
  const result = spawnSync('hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mountPoint, dmgPath], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`hdiutil attach failed: ${result.stderr || result.stdout || 'unknown error'}`);
  }
}

async function resolveAppSource(dmgPath, mountPoint) {
  const existingApp = join(DEFAULT_MOUNTED_VOLUME, 'v2rayN.app');
  try {
    const existing = await stat(existingApp);
    if (existing.isDirectory()) {
      return existingApp;
    }
  } catch {
    // fall through to attach
  }

  await mkdir(mountPoint, { recursive: true });
  const result = spawnSync('hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mountPoint, dmgPath], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`hdiutil attach failed: ${result.stderr || result.stdout || 'unknown error'}`);
  }
  mountedHere = true;
  return join(mountPoint, 'v2rayN.app');
}

async function unmountDmg(mountPoint) {
  const result = spawnSync('hdiutil', ['detach', mountPoint], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`hdiutil detach failed: ${result.stderr || result.stdout || 'unknown error'}`);
  }
}

async function ensureFileExists(path, label) {
  try {
    const s = await stat(path);
    if (!s.isFile() && !s.isDirectory()) {
      throw new Error();
    }
  } catch {
    throw new Error(`Missing ${label}: ${path}`);
  }
}

async function copyOptionalConfig(sourceConfigDir, destConfigDir) {
  const files = ['guiNConfig.json', 'guiNDB.db'];
  for (const file of files) {
    const source = join(sourceConfigDir, file);
    try {
      const s = await stat(source);
      if (s.isFile()) {
        await copyFile(source, join(destConfigDir, file));
      }
    } catch {
      // ignore missing local config; package still works with launcher + rules
    }
  }
}

async function copyBundle(source, target) {
  const result = spawnSync('ditto', ['--rsrc', '--extattr', source, target], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`ditto failed: ${result.stderr || result.stdout || 'unknown error'}`);
  }
}

async function zipDirectory(sourceDir, outZip) {
  const result = spawnSync('ditto', ['-c', '-k', '--keepParent', '--sequesterRsrc', sourceDir, outZip], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`zip failed: ${result.stderr || result.stdout || 'unknown error'}`);
  }
}

async function removeIfExists(path) {
  try {
    await rm(path, { force: true });
  } catch {
    // ignore
  }
}

function buildLauncher({ launcherName }) {
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
  echo "    然后重新双击 ${launcherName} 启动。"
  read -r -p "按回车键退出..."
  exit 1
}
echo "v2rayN 已启动，分流规则和节点已预置好，直接点连接即可。"
echo ""
echo "如果节点延迟显示 -1，点软件顶部闪电图标(⚡)全部测速，再双击延迟低的节点切换。"
read -r -p "按回车键退出..."
`;
}

function buildReadme() {
  return `v2rayN macOS 便携包

使用步骤：
1. 双击 start-v2rayN.command 启动 v2rayN
2. 软件打开后分流规则已自动生效，直接点”连接”即可
3. 如果节点延迟显示 -1，点顶栏闪电图标(⚡)全部测速，再双击延迟低的节点

安全提示（首次运行必看）：
- macOS 会弹出”无法打开”提示 → 去”系统设置 → 隐私与安全性”点”仍要打开”
- 然后重新双击 start-v2rayN.command

说明：
- 分流规则已预置：AI工具/海外流量走代理，国内直连
- macOS 配置存放在 ~/Library/Application Support/v2rayN/guiConfigs
`;
}
