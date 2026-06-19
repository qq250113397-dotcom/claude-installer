/**
 * 面包多订单验证 Worker
 * POST { order_no: "面包多订单号" }
 * -> { ok: true, expiry: ms_timestamp } | { ok: false, error: "..." }
 */
import { createHash } from 'node:crypto';

const MBD_APP_ID  = '6653106';
const MBD_APP_KEY = '6653106:1waQoP:KjbhdYz93zG4e2Gy5w3ai5KxfcaN48FwATxuXdZokBcjbhdYz93zG4e2Gy5w3ai5KxfcaN48Fw';
const MBD_API     = 'https://newapi.mbd.pub/release/main/search_order';

// 32天有效期，给月订阅续费留出缓冲
const MEMBER_DAYS = 32;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return new Response('Not Found', { status: 404 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: '请求格式错误' }, 400);
    }

    const orderNo = String(body?.order_no || '').trim();
    if (!orderNo) {
      return json({ ok: false, error: '请先输入订单号' });
    }

    // 签名：参数按ASCII排序 + &key=APP_KEY，取 MD5
    const params = { app_id: MBD_APP_ID, out_trade_no: orderNo };
    const signStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&') + `&key=${MBD_APP_KEY}`;
    const sign = createHash('md5').update(signStr).digest('hex');

    let mbdData;
    try {
      const resp = await fetch(MBD_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: MBD_APP_ID, out_trade_no: orderNo, sign }),
      });
      mbdData = await resp.json();
    } catch {
      return json({ ok: false, error: '查询失败，请稍后重试' });
    }

    if (mbdData.error) {
      return json({ ok: false, error: mbdData.error });
    }

    // state: 1=已支付 2=已结算
    const state = Number(mbdData.state);
    if (state !== 1 && state !== 2) {
      return json({ ok: false, error: '该订单未完成支付，请确认后重试' });
    }

    const expiry = Date.now() + MEMBER_DAYS * 24 * 60 * 60 * 1000;
    return json({ ok: true, expiry, desc: mbdData.description || '' });
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
