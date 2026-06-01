/**
 * Cloudflare Worker — 面包多 Webhook 处理
 *
 * 环境变量（wrangler secret put）:
 *   MBD_APP_KEY  — 面包多后台的 App Key（用于签名验证）
 *
 * 可选环境变量（wrangler.toml [vars]，产品创建后再填写）:
 *   MBD_PRODUCT_ID / MBD_PRODUCT_IDS      允许发卡的商品 ID，多个用英文逗号分隔
 *   MBD_AMOUNT                           允许发卡的订单金额，按面包多 webhook 原值填写
 *   MBD_DESCRIPTION_KEYWORD              商品描述必须包含的关键词
 *
 * 面包多 POST JSON 结构（charge_succeeded）:
 * {
 *   "type": "charge_succeeded",
 *   "out_trade_no": "订单号",
 *   "amount": 100,
 *   "description": "商品名",
 *   "charge_id": "...",
 *   "payway": "wxpay",
 *   "sign": "md5签名"
 * }
 *
 * 逻辑：支付成功后以 out_trade_no 作为卡密写入 KV，
 * 买家在 unlock.html 输入订单号即可解锁教程。
 */

const MAX_BODY_BYTES = 64 * 1024;

class PayloadTooLargeError extends Error {}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    return handleWebhook(request, env);
  },
};

async function handleWebhook(request, env) {
  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return new Response('payload too large', { status: 413 });
    }
    return new Response('invalid json', { status: 400 });
  }

  // 验证签名
  if (!(await verifySign(body, env.MBD_APP_KEY))) {
    log('warn', 'mbd_sign_mismatch', {
      type: safeString(body?.type),
      orderNo: safeString(body?.out_trade_no),
      chargeId: safeString(body?.charge_id),
    });
    return new Response('sign error', { status: 403 });
  }

  // 只处理支付成功事件，其他事件直接回 success
  if (body.type !== 'charge_succeeded') {
    return new Response('success');
  }

  const orderNo = normalizeCardKey(body.out_trade_no);
  if (!orderNo) {
    return new Response('missing out_trade_no', { status: 400 });
  }

  const productCheck = validateProduct(body, env);
  if (!productCheck.ok) {
    log('warn', 'mbd_product_skipped', {
      reason: productCheck.reason,
      orderNo,
      productId: safeString(productCheck.productId),
      amount: safeString(body.amount),
    });
    return new Response('success');
  }

  // 幂等：已存在则跳过（防止面包多重复推送）
  const kvKey = `card:${orderNo}`;
  const existing = await env.CC_CARDS.get(kvKey);
  if (!existing) {
    await env.CC_CARDS.put(kvKey, JSON.stringify({
      used: false,
      source: 'mianbaoduo',
      orderNo,
      chargeId: safeString(body.charge_id),
      productId: productCheck.productId || null,
      amount: body.amount ?? null,
      createdAt: new Date().toISOString(),
    }));
  }

  return new Response('success');
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

function validateProduct(body, env) {
  const productId = pickFirst(body, [
    'product_id',
    'productId',
    'goods_id',
    'goodsId',
    'sku_id',
    'skuId',
    'plan_id',
    'planId',
  ]);
  const productIdText = productId === undefined ? '' : String(productId).trim();
  const expectedProductIds = splitCsv(env.MBD_PRODUCT_IDS || env.MBD_PRODUCT_ID);

  if (expectedProductIds.length > 0 && !expectedProductIds.includes(productIdText)) {
    return {
      ok: false,
      reason: productIdText ? 'product_id_mismatch' : 'missing_product_id',
      productId: productIdText,
    };
  }

  const expectedAmount = optionalString(env.MBD_AMOUNT);
  if (expectedAmount && String(body.amount ?? '').trim() !== expectedAmount) {
    return { ok: false, reason: 'amount_mismatch', productId: productIdText };
  }

  const keyword = optionalString(env.MBD_DESCRIPTION_KEYWORD);
  if (keyword) {
    const description = [
      body.description,
      body.product_name,
      body.productName,
      body.title,
      body.subject,
    ].map(value => optionalString(value)).find(Boolean) || '';

    if (!description.includes(keyword)) {
      return { ok: false, reason: 'description_keyword_mismatch', productId: productIdText };
    }
  }

  return { ok: true, productId: productIdText };
}

function normalizeCardKey(value) {
  return String(value || '').trim().toUpperCase();
}

function pickFirst(source, keys) {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== '') {
      return source[key];
    }
  }
  return undefined;
}

function splitCsv(value) {
  return optionalString(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function optionalString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function safeString(value) {
  return optionalString(value).slice(0, 128);
}

function log(level, message, data = {}) {
  const line = JSON.stringify({ message, ...data });
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * 面包多签名算法：
 * 1. 取所有非空字段（排除 sign 字段本身）
 * 2. 按 key 字母升序排列
 * 3. 拼接为 k1=v1&k2=v2...&key=APP_KEY
 * 4. MD5 小写
 */
async function verifySign(body, appKey) {
  if (!appKey) return false;
  const receivedSign = optionalString(body.sign).toLowerCase();
  if (!receivedSign) return false;

  const params = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'sign') continue;
    if (v !== null && v !== undefined && v !== '') {
      params[k] = v;
    }
  }

  const signStr =
    Object.keys(params)
      .sort()
      .map(k => `${k}=${String(params[k])}`)
      .join('&') + `&key=${appKey}`;

  return constantTimeEqual(md5(signStr), receivedSign);
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

// ── 纯 JS MD5（Web Crypto 不支持 MD5，需内联实现）──────────────────────────

function md5(str) {
  function safeAdd(x, y) {
    const lsw = (x & 0xffff) + (y & 0xffff);
    return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff);
  }
  function bitRotateLeft(num, cnt) {
    return (num << cnt) | (num >>> (32 - cnt));
  }
  function md5cmn(q, a, b, x, s, t) {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function md5ff(a, b, c, d, x, s, t) { return md5cmn((b & c) | (~b & d), a, b, x, s, t); }
  function md5gg(a, b, c, d, x, s, t) { return md5cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function md5hh(a, b, c, d, x, s, t) { return md5cmn(b ^ c ^ d, a, b, x, s, t); }
  function md5ii(a, b, c, d, x, s, t) { return md5cmn(c ^ (b | ~d), a, b, x, s, t); }

  const utf8 = unescape(encodeURIComponent(str));
  const msgLen = utf8.length;
  const bytes = new Uint8Array(msgLen + 1 + ((msgLen % 64 < 56 ? 56 : 120) - (msgLen % 64)) + 8);
  for (let i = 0; i < msgLen; i++) bytes[i] = utf8.charCodeAt(i);
  bytes[msgLen] = 0x80;
  const bitLen = msgLen * 8;
  bytes[bytes.length - 8] = bitLen & 0xff;
  bytes[bytes.length - 7] = (bitLen >> 8) & 0xff;
  bytes[bytes.length - 6] = (bitLen >> 16) & 0xff;
  bytes[bytes.length - 5] = (bitLen >> 24) & 0xff;

  const M = new Int32Array(bytes.buffer);
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

  for (let i = 0; i < M.length; i += 16) {
    const [aa, bb, cc, dd] = [a, b, c, d];
    a = md5ff(a,b,c,d,M[i+0],7,-680876936); d=md5ff(d,a,b,c,M[i+1],12,-389564586); c=md5ff(c,d,a,b,M[i+2],17,606105819); b=md5ff(b,c,d,a,M[i+3],22,-1044525330);
    a = md5ff(a,b,c,d,M[i+4],7,-176418897); d=md5ff(d,a,b,c,M[i+5],12,1200080426); c=md5ff(c,d,a,b,M[i+6],17,-1473231341); b=md5ff(b,c,d,a,M[i+7],22,-45705983);
    a = md5ff(a,b,c,d,M[i+8],7,1770035416); d=md5ff(d,a,b,c,M[i+9],12,-1958414417); c=md5ff(c,d,a,b,M[i+10],17,-42063); b=md5ff(b,c,d,a,M[i+11],22,-1990404162);
    a = md5ff(a,b,c,d,M[i+12],7,1804603682); d=md5ff(d,a,b,c,M[i+13],12,-40341101); c=md5ff(c,d,a,b,M[i+14],17,-1502002290); b=md5ff(b,c,d,a,M[i+15],22,1236535329);
    a = md5gg(a,b,c,d,M[i+1],5,-165796510); d=md5gg(d,a,b,c,M[i+6],9,-1069501632); c=md5gg(c,d,a,b,M[i+11],14,643717713); b=md5gg(b,c,d,a,M[i+0],20,-373897302);
    a = md5gg(a,b,c,d,M[i+5],5,-701558691); d=md5gg(d,a,b,c,M[i+10],9,38016083); c=md5gg(c,d,a,b,M[i+15],14,-660478335); b=md5gg(b,c,d,a,M[i+4],20,-405537848);
    a = md5gg(a,b,c,d,M[i+9],5,568446438); d=md5gg(d,a,b,c,M[i+14],9,-1019803690); c=md5gg(c,d,a,b,M[i+3],14,-187363961); b=md5gg(b,c,d,a,M[i+8],20,1163531501);
    a = md5gg(a,b,c,d,M[i+13],5,-1444681467); d=md5gg(d,a,b,c,M[i+2],9,-51403784); c=md5gg(c,d,a,b,M[i+7],14,1735328473); b=md5gg(b,c,d,a,M[i+12],20,-1926607734);
    a = md5hh(a,b,c,d,M[i+5],4,-378558); d=md5hh(d,a,b,c,M[i+8],11,-2022574463); c=md5hh(c,d,a,b,M[i+11],16,1839030562); b=md5hh(b,c,d,a,M[i+14],23,-35309556);
    a = md5hh(a,b,c,d,M[i+1],4,-1530992060); d=md5hh(d,a,b,c,M[i+4],11,1272893353); c=md5hh(c,d,a,b,M[i+7],16,-155497632); b=md5hh(b,c,d,a,M[i+10],23,-1094730640);
    a = md5hh(a,b,c,d,M[i+13],4,681279174); d=md5hh(d,a,b,c,M[i+0],11,-358537222); c=md5hh(c,d,a,b,M[i+3],16,-722521979); b=md5hh(b,c,d,a,M[i+6],23,76029189);
    a = md5hh(a,b,c,d,M[i+9],4,-640364487); d=md5hh(d,a,b,c,M[i+12],11,-421815835); c=md5hh(c,d,a,b,M[i+15],16,530742520); b=md5hh(b,c,d,a,M[i+2],23,-995338651);
    a = md5ii(a,b,c,d,M[i+0],6,-198630844); d=md5ii(d,a,b,c,M[i+7],10,1126891415); c=md5ii(c,d,a,b,M[i+14],15,-1416354905); b=md5ii(b,c,d,a,M[i+5],21,-57434055);
    a = md5ii(a,b,c,d,M[i+12],6,1700485571); d=md5ii(d,a,b,c,M[i+3],10,-1894986606); c=md5ii(c,d,a,b,M[i+10],15,-1051523); b=md5ii(b,c,d,a,M[i+1],21,-2054922799);
    a = md5ii(a,b,c,d,M[i+8],6,1873313359); d=md5ii(d,a,b,c,M[i+15],10,-30611744); c=md5ii(c,d,a,b,M[i+6],15,-1560198380); b=md5ii(b,c,d,a,M[i+13],21,1309151649);
    a = md5ii(a,b,c,d,M[i+4],6,-145523070); d=md5ii(d,a,b,c,M[i+11],10,-1120210379); c=md5ii(c,d,a,b,M[i+2],15,718787259); b=md5ii(b,c,d,a,M[i+9],21,-343485551);
    a=safeAdd(a,aa); b=safeAdd(b,bb); c=safeAdd(c,cc); d=safeAdd(d,dd);
  }

  return [a, b, c, d]
    .map(n => (n >>> 0).toString(16).padStart(8, '0').match(/../g).reverse().join(''))
    .join('');
}
