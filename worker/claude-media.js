const ALLOWED_DOMAINS = [
  'claude.lbenben.cc.cd',
  'codex.lbenben.cc.cd',
  'claudecode-eut.pages.dev',
];

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': 'Range, Content-Type',
  'access-control-expose-headers': 'Content-Range, Content-Length, Accept-Ranges',
};

export default {
  async fetch(request, env) {
    // OPTIONS 预检请求直接放行
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 防盗链：只放行来自指定域名的 Referer
    const referer = request.headers.get('Referer') || '';
    const allowed = ALLOWED_DOMAINS.some(d => referer.includes(d));
    if (!allowed) {
      return new Response('403 Forbidden', {
        status: 403,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          ...CORS_HEADERS,
        },
      });
    }

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.slice(1));

    if (!key) {
      return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
    }

    // 解析 Range 请求头（拖动进度条必须）
    const rangeHeader = request.headers.get('Range');
    let rangeOption;

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const offset = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : undefined;
        rangeOption = {
          offset,
          length: end !== undefined ? end - offset + 1 : undefined,
        };
      }
    }

    const object = await env.BUCKET.get(
      key,
      rangeOption ? { range: rangeOption } : undefined
    );

    if (!object) {
      return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
    }

    const headers = new Headers(CORS_HEADERS);
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('accept-ranges', 'bytes');
    headers.set('cache-control', 'public, max-age=86400');

    // 分片响应 206
    if (rangeOption && object.range) {
      const { offset, length } = object.range;
      headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
      headers.set('content-length', String(length));
      return new Response(object.body, { status: 206, headers });
    }

    if (object.size) {
      headers.set('content-length', String(object.size));
    }

    return new Response(object.body, { status: 200, headers });
  },
};
