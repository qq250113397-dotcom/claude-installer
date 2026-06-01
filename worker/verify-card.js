/**
 * Cloudflare Worker — 卡密验证
 *
 * KV 命名空间绑定: CC_CARDS
 *
 * KV key 格式:  card:{CARDKEY}
 * KV value (JSON):
 *   未使用:   { "used": false }
 *   已使用:   { "used": true, "token": "<hex64>", "expiry": <ms timestamp> }
 *
 * POST /verify
 *   body: { "card": "XXXX-XXXX", "token": "<stored token or null>", "mode": "activate|check" }
 *   ok:   { "ok": true,  "card": "XXXX-XXXX", "token": "...", "expiry": 1234567890000 }
 *   err:  { "ok": false, "error": "..." }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 16 * 1024;
const TOKEN_BYTES = 32;

class PayloadTooLargeError extends Error {}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'POST') {
      return handleVerify(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleVerify(request, env) {
  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return json({ ok: false, error: '请求过大' }, 413);
    }
    return json({ ok: false, error: '请求格式错误' }, 400);
  }

  const rawCard = body?.card;
  const clientToken = typeof body?.token === 'string' ? body.token.trim() : '';
  const mode = body?.mode === 'check' ? 'check' : 'activate';

  if (!rawCard || typeof rawCard !== 'string' || rawCard.trim() === '') {
    return json({ ok: false, error: '请输入卡密' });
  }

  const cardKey = normalizeCard(rawCard);
  if (!isValidCardKey(cardKey)) {
    return json({ ok: false, error: '卡密格式错误，请检查输入后重试' });
  }

  const stored = await env.CC_CARDS.get(`card:${cardKey}`, { type: 'json' });

  if (stored === null) {
    return json({ ok: false, error: '卡密无效，请检查输入后重试' });
  }

  if (mode === 'check') {
    if (!stored.used) {
      return json({ ok: false, error: '访问记录无效，请重新输入卡密' });
    }
    return validateExistingCard(stored, cardKey, clientToken);
  }

  // 未使用 → 首次激活
  if (!stored.used) {
    const token = randomHex(TOKEN_BYTES);
    const expiry = Date.now() + SEVEN_DAYS_MS;
    await env.CC_CARDS.put(`card:${cardKey}`, JSON.stringify({
      ...stored,
      used: true,
      token,
      expiry,
      activatedAt: new Date().toISOString(),
    }));
    return json({ ok: true, card: cardKey, token, expiry });
  }

  return validateExistingCard(stored, cardKey, clientToken);
}

async function validateExistingCard(stored, cardKey, clientToken) {
  if (!stored.expiry || stored.expiry <= Date.now()) {
    return json({ ok: false, error: '卡密已过期，请联系客服处理' });
  }

  if (clientToken && stored.token && await constantTimeEqual(clientToken, stored.token)) {
    return json({ ok: true, card: cardKey, token: stored.token, expiry: stored.expiry });
  }

  // token 不符或已过期
  return json({ ok: false, error: '该卡密已被使用，如有问题请联系客服' });
}

function normalizeCard(value) {
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\s+/g, '');
}

function isValidCardKey(value) {
  return /^[A-Z0-9-]{6,80}$/.test(value);
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) {
    throw new PayloadTooLargeError();
  }

  if (!request.body) return {};

  const reader = request.body.getReader();
  const chunks = [];
  let totalLength = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    totalLength += value.byteLength;

    if (totalLength > MAX_BODY_BYTES) {
      throw new PayloadTooLargeError();
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(bytes));
}

async function constantTimeEqual(left, right) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);

  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let diff = 0;

  for (let i = 0; i < leftBytes.length; i++) {
    diff |= leftBytes[i] ^ rightBytes[i];
  }

  return diff === 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
