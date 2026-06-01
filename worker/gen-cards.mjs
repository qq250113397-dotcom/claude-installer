#!/usr/bin/env node
/**
 * 批量生成卡密并写入 Cloudflare KV
 *
 * 用法：
 *   node gen-cards.mjs 20 --dry-run
 *   node gen-cards.mjs 20 --out cards.csv --dry-run
 *   node gen-cards.mjs 20 --namespace-id <KV_NAMESPACE_ID>
 *
 * 环境变量：
 *   CC_CARDS_NAMESPACE_ID  可覆盖默认 KV namespace id
 */

import { spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_NAMESPACE_ID = '8e50844dd20c43f8aa34e3c05efedce0';
const DEFAULT_COUNT = 10;
const DEFAULT_SEGMENTS = 3;
const DEFAULT_SEGMENT_LENGTH = 4;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆的 0/O/1/I
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

const { options, positionals } = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

const count = parsePositiveInt(positionals[0] ?? options.count ?? DEFAULT_COUNT, 'count');
const segments = parsePositiveInt(options.segments ?? DEFAULT_SEGMENTS, 'segments');
const segmentLength = parsePositiveInt(options.segmentLength ?? DEFAULT_SEGMENT_LENGTH, 'segment-length');
const namespaceId = options.namespaceId || process.env.CC_CARDS_NAMESPACE_ID || DEFAULT_NAMESPACE_ID;
const prefix = normalizePrefix(options.prefix || '');
const dryRun = Boolean(options.dryRun);
const force = Boolean(options.force);
const generatedAt = new Date().toISOString();

if (!dryRun && !namespaceId) {
  fail('缺少 KV namespace id。请传入 --namespace-id 或设置 CC_CARDS_NAMESPACE_ID。');
}

const cards = generateUniqueCards(count, { prefix, segments, segmentLength });
const rows = cards.map(card => ({
  card,
  kvKey: `card:${card}`,
  generatedAt,
}));

if (options.out) {
  const outPath = resolve(process.cwd(), options.out);
  writeFileSync(outPath, toCsv(rows), 'utf8');
  console.log(`已导出 CSV: ${outPath}`);
}

if (dryRun) {
  console.log('--- DRY RUN：只生成，不写入 KV ---');
  cards.forEach(card => console.log(card));
  process.exit(0);
}

console.log(`准备写入 ${count} 张卡密到 KV namespace: ${namespaceId}`);
console.log(force ? '模式：强制覆盖已有 key' : '模式：跳过已存在 key');

let ok = 0;
let skipped = 0;
let failed = 0;

for (const card of cards) {
  const key = `card:${card}`;

  try {
    if (!force && keyExists(namespaceId, key)) {
      console.log(`- ${card} 已存在，跳过`);
      skipped++;
      continue;
    }

    const value = JSON.stringify({
      used: false,
      source: 'manual',
      generatedAt,
    });

    runWrangler(['kv', 'key', 'put', key, value, '--namespace-id', namespaceId]);
    console.log(`✓ ${card}`);
    ok++;
  } catch (error) {
    console.error(`✗ ${card}  ${formatError(error)}`);
    failed++;
  }
}

console.log(`\n完成：${ok} 写入成功，${skipped} 跳过，${failed} 失败`);
if (failed > 0) process.exit(1);

function generateUniqueCards(total, format) {
  const seen = new Set();
  const maxAttempts = total * 20 + 100;
  let attempts = 0;

  while (seen.size < total) {
    if (attempts++ > maxAttempts) {
      fail('生成卡密时重复过多，请增加 segments 或 segment-length。');
    }
    seen.add(generateCard(format));
  }

  return [...seen];
}

function generateCard({ prefix: cardPrefix, segments: segmentCount, segmentLength: partLength }) {
  const parts = [];
  if (cardPrefix) parts.push(cardPrefix);

  for (let i = 0; i < segmentCount; i++) {
    parts.push(randomSegment(partLength));
  }

  return parts.join('-');
}

function randomSegment(length) {
  let segment = '';
  for (let i = 0; i < length; i++) {
    segment += ALPHABET[randomInt(ALPHABET.length)];
  }
  return segment;
}

function keyExists(namespaceId, key) {
  const result = runWrangler(
    ['kv', 'key', 'get', key, '--namespace-id', namespaceId],
    { allowFailure: true }
  );

  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  if (result.status !== 0) {
    if (/not found|does not exist|no value/i.test(output)) return false;
    throw new Error(output || `wrangler exited with status ${result.status}`);
  }

  return output.length > 0 && !/not found|does not exist|no value/i.test(output);
}

function runWrangler(args, { allowFailure = false } = {}) {
  const result = spawnSync('npx', ['--yes', 'wrangler', ...args, '--remote'], {
    cwd: SCRIPT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${result.stderr || result.stdout || ''}`.trim());
  }

  return result;
}

function parseArgs(argv) {
  const parsedOptions = {};
  const parsedPositionals = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (!arg.startsWith('--')) {
      parsedPositionals.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
    const key = toCamelCase(rawKey);

    if (['dryRun', 'force', 'help'].includes(key)) {
      parsedOptions[key] = true;
      continue;
    }

    const value = inlineValue !== undefined ? inlineValue : argv[++i];
    if (value === undefined || value.startsWith('--')) {
      fail(`参数 --${rawKey} 缺少值。`);
    }
    parsedOptions[key] = value;
  }

  return { options: parsedOptions, positionals: parsedPositionals };
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    fail(`${name} 必须是正整数。`);
  }
  return parsed;
}

function normalizePrefix(value) {
  const normalized = String(value).trim().toUpperCase().replace(/^-+|-+$/g, '');
  if (!normalized) return '';
  if (!/^[A-Z0-9-]+$/.test(normalized)) {
    fail('prefix 只能包含英文字母、数字和连字符。');
  }
  return normalized;
}

function toCsv(records) {
  const header = ['card', 'kv_key', 'generated_at'];
  const lines = records.map(record => [
    record.card,
    record.kvKey,
    record.generatedAt,
  ].map(csvCell).join(','));
  return `${header.join(',')}\n${lines.join('\n')}\n`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function fail(message) {
  console.error(`错误：${message}`);
  process.exit(1);
}

function printHelp() {
  console.log(`用法：
  node gen-cards.mjs [count] [options]

选项：
  --dry-run                 只生成并打印，不写入 KV
  --force                   覆盖已存在的 KV key
  --namespace-id <id>       Cloudflare KV namespace id
  --out <file.csv>          导出生成结果到 CSV
  --prefix <text>           给卡密加前缀，例如 CC-ABCD-EFGH-IJKL
  --segments <n>            卡密段数，默认 3
  --segment-length <n>      每段长度，默认 4
  --help                    显示帮助

示例：
  node gen-cards.mjs 20 --dry-run
  node gen-cards.mjs 20 --out cards.csv --dry-run
  CC_CARDS_NAMESPACE_ID=xxx node gen-cards.mjs 20`);
}
