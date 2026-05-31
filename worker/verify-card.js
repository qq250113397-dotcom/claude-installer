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
 *   body: { "card": "XXXX-XXXX", "token": "<stored token or null>" }
 *   ok:   { "ok": true,  "token": "...", "expiry": 1234567890000 }
 *   err:  { "ok": false, "error": "..." }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
    body = await request.json();
  } catch {
    return json({ ok: false, error: '请求格式错误' }, 400);
  }

  const rawCard = body.card;
  const clientToken = body.token || null;

  if (!rawCard || typeof rawCard !== 'string' || rawCard.trim() === '') {
    return json({ ok: false, error: '请输入卡密' });
  }

  const cardKey = rawCard.trim().toUpperCase();
  const stored = await env.CC_CARDS.get(`card:${cardKey}`, { type: 'json' });

  if (stored === null) {
    return json({ ok: false, error: '卡密无效，请检查输入后重试' });
  }

  // 未使用 → 首次激活
  if (!stored.used) {
    const token = randomHex(32);
    const expiry = Date.now() + SEVEN_DAYS_MS;
    await env.CC_CARDS.put(`card:${cardKey}`, JSON.stringify({ used: true, token, expiry }));
    return json({ ok: true, token, expiry });
  }

  // 已使用 → 同一设备凭 token 重新放行
  if (clientToken && clientToken === stored.token && stored.expiry > Date.now()) {
    return json({ ok: true, token: stored.token, expiry: stored.expiry });
  }

  // token 不符或已过期
  return json({ ok: false, error: '该卡密已被使用，如有问题请联系客服' });
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
