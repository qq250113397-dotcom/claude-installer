#!/usr/bin/env node
import { mkdtemp, rm, writeFile, copyFile, mkdir, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { optimizePortablePackage } from './portable-package-optimize.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_OUT_DIR = join(ROOT, 'dist');
const DEFAULT_WORK_DIR = join(tmpdir(), 'v2rayn-portable-build');
const RELEASE_API = 'https://api.github.com/repos/2dust/v2rayN/releases/latest';
const ASSET_NAME = 'v2rayN-windows-64-desktop.zip';
const LOCAL_ZIP_CANDIDATES = [
  join(process.env.HOME || process.env.USERPROFILE || '', 'Desktop', 'Claude网络环境搭建指南', '软件', 'v2rayN-windows-64-desktop.zip'),
  join(process.env.HOME || process.env.USERPROFILE || '', 'Desktop', '软件', 'v2rayN-windows-64-desktop.zip'),
];
const DEFAULT_CONFIG_DIR = join(process.env.HOME || process.env.USERPROFILE || '', 'Library', 'Application Support', 'v2rayN', 'guiConfigs');
const ROUTING_FILE = join(ROOT, 'website', 'v2rayn-routing.json');

const args = parseArgs(process.argv.slice(2));
const outDir = args['out-dir'] || DEFAULT_OUT_DIR;
const workDir = args.workdir || DEFAULT_WORK_DIR;
const packageName = args.name || 'v2rayN-windows-64-desktop-portable';
const launcherName = args.launcher || 'start-v2rayN.bat';
const keepWork = args['keep-work'] === 'true';

await mkdir(outDir, { recursive: true });
await mkdir(workDir, { recursive: true });

const scratch = await mkdtemp(join(workDir, '/'));
const assetZip = join(scratch, 'v2rayN.zip');
const extractedRoot = join(scratch, 'extracted');
const stagingRoot = join(scratch, packageName);

try {
  const localZip = await findExistingLocalZip();
  if (localZip) {
    process.stdout.write(`Using local zip: ${localZip}\n`);
    await copyFile(localZip, assetZip);
  } else {
    const release = await fetchJson(RELEASE_API);
    const asset = pickAsset(release, ASSET_NAME);
    const downloadUrls = buildAssetUrls(release.tag_name, asset);

    process.stdout.write(`Downloading ${ASSET_NAME}...\n`);
    await downloadWithFallback(downloadUrls, assetZip);
  }

  await unzipArchive(assetZip, extractedRoot);
  const sourceRoot = await resolvePackageRoot(extractedRoot);

  await copyTree(sourceRoot, stagingRoot);
  await mkdir(join(stagingRoot, 'guiConfigs'), { recursive: true });
  await copyOptionalConfig(DEFAULT_CONFIG_DIR, join(stagingRoot, 'guiConfigs'));
  await copyFile(ROUTING_FILE, join(stagingRoot, 'ai-abroad-proxy-cn-direct.json'));
  await writeFile(join(stagingRoot, 'README.txt'), buildReadme(), 'utf8');
  await writeFile(join(stagingRoot, launcherName), buildLauncher(launcherName), 'utf8');
  const optimizeResult = await optimizePortablePackage(stagingRoot, { minLatencyMs: 400, probeTimeoutMs: 1200, limit: 24 });
  if (optimizeResult.selected) {
    process.stdout.write(`Auto-selected US node: ${optimizeResult.selected.remarks} ${optimizeResult.selected.address}:${optimizeResult.selected.port} (${optimizeResult.selected.latency} ms)\n`);
  }

  const outZip = join(outDir, `${packageName}.zip`);
  await removeIfExists(outZip);
  await zipDirectory(stagingRoot, outZip);
  process.stdout.write(`Created ${outZip}\n`);
} finally {
  if (!keepWork) {
    await rm(scratch, { recursive: true, force: true });
  } else {
    process.stdout.write(`Kept workdir at ${scratch}\n`);
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
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

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'claude-installer/portable-pack',
      'Accept': 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function pickAsset(release, name) {
  const asset = release?.assets?.find(item => item?.name === name);
  if (!asset) {
    throw new Error(`Release asset not found: ${name}`);
  }
  return asset;
}

function buildAssetUrls(tagName, asset) {
  const urls = [];
  if (asset?.browser_download_url) urls.push(asset.browser_download_url);
  if (tagName) {
    urls.push(`https://github.com/2dust/v2rayN/releases/download/${tagName}/${ASSET_NAME}`);
  }
  urls.push(`https://ghproxy.com/https://github.com/2dust/v2rayN/releases/download/${tagName || 'latest'}/${ASSET_NAME}`);
  urls.push(`https://mirror.ghproxy.com/https://github.com/2dust/v2rayN/releases/download/${tagName || 'latest'}/${ASSET_NAME}`);
  return [...new Set(urls)];
}

async function findExistingLocalZip() {
  for (const candidate of LOCAL_ZIP_CANDIDATES) {
    try {
      const stat = await import('node:fs/promises').then(fs => fs.stat(candidate));
      if (stat.isFile() && stat.size > 0) {
        return candidate;
      }
    } catch {
      // ignore missing candidate
    }
  }
  return null;
}

async function downloadWithFallback(urls, dest) {
  const errors = [];
  for (const url of urls) {
    try {
      await downloadFile(url, dest);
      return;
    } catch (error) {
      errors.push(`${url} -> ${error.message}`);
      await removeIfExists(dest);
    }
  }
  throw new Error(`All downloads failed:\n${errors.join('\n')}`);
}

async function downloadFile(url, dest) {
  await mkdir(dirname(dest), { recursive: true });

  const aria2 = spawnSync('aria2c', [
    '--allow-overwrite=true',
    '--auto-file-renaming=false',
    '--check-certificate=true',
    '--continue=true',
    '--retry-wait=5',
    '--max-tries=8',
    '--split=8',
    '--min-split-size=1M',
    '--timeout=30',
    '--user-agent=Mozilla/5.0',
    '--dir',
    dirname(dest),
    '--out',
    basename(dest),
    url,
  ], { stdio: 'inherit' });

  if (aria2.status === 0) {
    return;
  }

  const curl = spawnSync('curl', [
    '-L',
    '--fail',
    '--retry', '6',
    '--retry-all-errors',
    '--retry-delay', '5',
    '--connect-timeout', '20',
    '--output', dest,
    url,
  ], { stdio: 'inherit' });

  if (curl.status !== 0) {
    throw new Error('curl download failed after all fallbacks');
  }
}

async function unzipArchive(zipPath, targetDir) {
  await mkdir(targetDir, { recursive: true });
  const unzip = spawnSync('unzip', ['-q', zipPath, '-d', targetDir], { encoding: 'utf8' });
  if (unzip.status !== 0) {
    throw new Error(`unzip failed: ${unzip.stderr || unzip.stdout || 'unknown error'}`);
  }
}

async function resolvePackageRoot(extractedRoot) {
  const entries = await import('node:fs/promises').then(fs => fs.readdir(extractedRoot, { withFileTypes: true }));
  const dirs = entries.filter(entry => entry.isDirectory()).map(entry => join(extractedRoot, entry.name));
  if (dirs.length === 1) {
    return dirs[0];
  }
  return extractedRoot;
}

async function copyTree(source, target) {
  await mkdir(target, { recursive: true });
  const entries = await import('node:fs/promises').then(fs => fs.readdir(source, { withFileTypes: true }));
  for (const entry of entries) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else if (entry.isFile()) {
      await copyFile(from, to);
    }
  }
}

async function copyOptionalConfig(sourceConfigDir, destConfigDir) {
  const files = ['guiNConfig.json', 'guiNDB.db'];
  for (const file of files) {
    const source = join(sourceConfigDir, file);
    try {
      const stat = await import('node:fs/promises').then(fs => fs.stat(source));
      if (stat.isFile()) {
        await copyFile(source, join(destConfigDir, file));
      }
    } catch {
      // ignore missing local config; package still works with launcher + rules
    }
  }
}

function buildLauncher(launcherName) {
  return `@echo off
setlocal
chcp 65001 >nul 2>&1
set "ROOT=%~dp0"
start "" "%ROOT%v2rayN.exe"

echo.
echo  [*] 便携版已启动，初始节点已经预置在软件里。
echo  [*] 你可以直接点连接；后续要导入自己的订阅，再去配置项里替换即可。
echo.
pause
`;
}

function buildReadme() {
  return [
    'v2rayN 便携版使用说明',
    '',
    `1. 双击“${launcherName}”。`,
    '2. 程序会自动启动 v2rayN，初始节点已经预置好。',
    '3. 先确保外网能连通，再按后续步骤导入你自己的订阅和住宅 IP。',
    '4. “ai-abroad-proxy-cn-direct.json” 是现成的分流规则文件，导入后即可实现 AI / 国外走代理，国内直连。',
    '',
  ].join('\n');
}

async function zipDirectory(sourceDir, outZip) {
  const ditto = spawnSync('ditto', ['-c', '-k', '--keepParent', sourceDir, outZip], { encoding: 'utf8' });
  if (ditto.status === 0) return;

  const zip = spawnSync('zip', ['-qry', outZip, basename(sourceDir)], {
    cwd: dirname(sourceDir),
    encoding: 'utf8',
  });
  if (zip.status !== 0) {
    throw new Error(`zip failed: ${zip.stderr || zip.stdout || ditto.stderr || ditto.stdout || 'unknown error'}`);
  }
}

async function removeIfExists(target) {
  await rm(target, { force: true, recursive: true }).catch(() => {});
}
