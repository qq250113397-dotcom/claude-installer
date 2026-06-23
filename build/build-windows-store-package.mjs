#!/usr/bin/env node
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const installDir = join(root, 'install');
const distDir = join(root, 'dist');
const packageName = 'Codex-Windows-Store-OneClick';
const stageDir = join(distDir, packageName);
const zipPath = join(distDir, `${packageName}.zip`);
const exePath = join(distDir, `${packageName}.exe`);
const desktopPackageDir = join(
  process.env.HOME || '',
  'Desktop',
  '📦 安装包',
);

const topLevelFiles = [
  'START-HERE.cmd',
  'START-ONECLICK.cmd',
  '一键安装-Codex-Claude-Code.cmd',
  'VERIFY-WINDOWS-ONLY.cmd',
  'EMERGENCY-PROXY-RESET.cmd',
  '紧急恢复网络-关闭Windows代理.cmd',
  'README-Windows-OneClick.txt',
];

const requiredAssets = [
  'assets/v2rayN-windows-64-desktop-portable.zip',
  'assets/node-v24.16.0-x64.msi',
  'assets/Git-2.54.0-64-bit.exe',
  'assets/VC_redist.x64.exe',
  'assets/VC_redist.x86.exe',
  'assets/AppInstaller/README.txt',
  'assets/AppInstaller/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle',
  'assets/AppInstaller/Dependencies/x64/Microsoft.VCLibs.140.00_14.0.33519.0_x64.appx',
  'assets/AppInstaller/Dependencies/x64/Microsoft.VCLibs.140.00.UWPDesktop_14.0.33728.0_x64.appx',
  'assets/AppInstaller/Dependencies/x64/Microsoft.WindowsAppRuntime.1.8_8000.616.304.0_x64.appx',
];

await assertFiles([
  ...topLevelFiles.map(file => join(installDir, file)),
  join(installDir, 'lib/oneclick-windows.ps1'),
  join(installDir, 'lib/verify-windows-only.ps1'),
  ...requiredAssets.map(file => join(installDir, file)),
]);

await rm(stageDir, { recursive: true, force: true });
await rm(zipPath, { force: true });
await rm(exePath, { force: true });
await mkdir(stageDir, { recursive: true });

for (const file of topLevelFiles) {
  await copy(join(installDir, file), join(stageDir, file));
}
await copy(join(installDir, 'lib'), join(stageDir, 'lib'));
for (const asset of requiredAssets) {
  await copy(join(installDir, asset), join(stageDir, asset));
}

const manifest = await buildManifest(stageDir);
await writeFile(join(stageDir, 'SHA256SUMS.txt'), manifest, 'utf8');

run('ditto', ['-c', '-k', '--keepParent', '--sequesterRsrc', stageDir, zipPath]);
await copyToDesktop(zipPath);

const makensis = findCommand('makensis');
if (makensis) {
  run(makensis, [join(root, 'build', 'codex-store-oneclick.nsi')]);
  if (await exists(exePath)) {
    await copyToDesktop(exePath);
  }
} else {
  process.stdout.write('makensis not found; ZIP created, EXE build skipped.\n');
}

process.stdout.write(`Created ${zipPath}\n`);
if (await exists(exePath)) process.stdout.write(`Created ${exePath}\n`);

async function copy(source, target) {
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true, force: true });
}

async function assertFiles(paths) {
  const missing = [];
  for (const path of paths) {
    if (!(await exists(path))) missing.push(path);
  }
  if (missing.length) {
    throw new Error(`Package inputs are incomplete:\n${missing.join('\n')}`);
  }
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function buildManifest(directory) {
  const output = spawnSync('find', [directory, '-type', 'f', '-print0']);
  if (output.status !== 0) throw new Error('find failed while building manifest');
  const files = output.stdout
    .toString()
    .split('\0')
    .filter(Boolean)
    .filter(path => basename(path) !== 'SHA256SUMS.txt')
    .sort();

  const lines = [];
  for (const path of files) {
    const data = await readFile(path);
    const digest = createHash('sha256').update(data).digest('hex');
    const relative = path.slice(directory.length + 1).replaceAll('\\', '/');
    lines.push(`${digest}  ${relative}`);
  }
  return `${lines.join('\n')}\n`;
}

async function copyToDesktop(path) {
  if (!process.env.HOME) return;
  await mkdir(desktopPackageDir, { recursive: true });
  await cp(path, join(desktopPackageDir, basename(path)), { force: true });
}

function findCommand(command) {
  const result = spawnSync('/bin/sh', ['-c', `command -v ${command}`], {
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}`);
  }
}
