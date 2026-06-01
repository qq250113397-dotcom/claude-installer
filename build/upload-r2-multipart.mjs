#!/usr/bin/env node
import { open, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const DEFAULT_PART_SIZE = 6 * 1024 * 1024;

const args = parseArgs(process.argv.slice(2));
const filePath = resolve(args.file || args._[0] || '');
const key = args.key || basename(filePath);
const workerUrl = normalizeWorkerUrl(args.worker || process.env.R2_UPLOAD_WORKER_URL || '');
const token = args.token || process.env.R2_UPLOAD_TOKEN || '';
const partSize = Number(args['part-size'] || DEFAULT_PART_SIZE);

if (!filePath || !workerUrl || !token) {
  printUsage();
  process.exit(1);
}

if (!Number.isInteger(partSize) || partSize < 5 * 1024 * 1024) {
  throw new Error('part-size must be at least 5 MiB');
}

const fileStat = await stat(filePath);
const totalParts = Math.ceil(fileStat.size / partSize);

console.log(`Uploading ${filePath}`);
console.log(`Destination key: ${key}`);
console.log(`Worker: ${workerUrl}`);
console.log(`Size: ${fileStat.size} bytes in ${totalParts} parts`);

const createRes = await fetch(`${workerUrl}/${encodeURIComponent(key)}?action=create`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': guessContentType(filePath),
  },
});

if (!createRes.ok) {
  throw new Error(`create failed: ${createRes.status} ${await createRes.text()}`);
}

const createBody = await createRes.json();
const uploadId = createBody.uploadId;
if (!uploadId) {
  throw new Error('create response missing uploadId');
}

const parts = [];
const fd = await open(filePath, 'r');

try {
  for (let partNumber = 1, offset = 0; offset < fileStat.size; partNumber += 1, offset += partSize) {
    const length = Math.min(partSize, fileStat.size - offset);
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await fd.read(buffer, 0, length, offset);
    const body = buffer.subarray(0, bytesRead);

    console.log(`Uploading part ${partNumber}/${totalParts} (${bytesRead} bytes)`);

    const partBody = await uploadPartWithRetry({
      workerUrl,
      key,
      uploadId,
      partNumber,
      token,
      body,
    });
    parts.push({ partNumber: partBody.partNumber, etag: partBody.etag });
  }
} catch (error) {
  await abortUpload(workerUrl, key, uploadId, token).catch(() => {});
  throw error;
} finally {
  await fd.close();
}

const completeRes = await fetch(
  `${workerUrl}/${encodeURIComponent(key)}?action=complete&uploadId=${encodeURIComponent(uploadId)}`,
  {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ parts }),
  },
);

if (!completeRes.ok) {
  await abortUpload(workerUrl, key, uploadId, token).catch(() => {});
  throw new Error(`complete failed: ${completeRes.status} ${await completeRes.text()}`);
}

const completeBody = await completeRes.json();
console.log(`Done: ${completeBody.key} (${completeBody.size} bytes)`);
console.log(`ETag: ${completeBody.etag}`);

async function abortUpload(workerUrl, key, uploadId, token) {
  await fetch(
    `${workerUrl}/${encodeURIComponent(key)}?action=abort&uploadId=${encodeURIComponent(uploadId)}`,
    {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
}

async function uploadPartWithRetry({ workerUrl, key, uploadId, partNumber, token, body }) {
  const attempts = 5;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const partRes = await fetch(
        `${workerUrl}/${encodeURIComponent(key)}?action=part&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
        {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/octet-stream',
          },
          body,
        },
      );

      if (!partRes.ok) {
        throw new Error(`part ${partNumber} failed: ${partRes.status} ${await partRes.text()}`);
      }

      return partRes.json();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }
      const delayMs = Math.min(15_000, 1000 * 2 ** (attempt - 1));
      console.warn(`Part ${partNumber} attempt ${attempt} failed: ${error.message}`);
      console.warn(`Retrying in ${delayMs} ms...`);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    const [key, inlineValue] = arg.slice(2).split('=');
    if (inlineValue !== undefined) {
      out[key] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = 'true';
    }
  }
  return out;
}

function normalizeWorkerUrl(url) {
  if (!url) return '';
  return url.replace(/\/+$/, '');
}

function printUsage() {
  console.error('Usage: node build/upload-r2-multipart.mjs --worker <url> --token <secret> --file <path> [--key <object-key>] [--part-size <bytes>]');
}

function guessContentType(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable';
  if (lower.endsWith('.dmg')) return 'application/x-apple-diskimage';
  return 'application/octet-stream';
}
