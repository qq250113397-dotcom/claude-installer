export default {
  async fetch(request, env) {
    // 只放行来自网站的请求（换域名时在此数组添加新域名即可）
    const ALLOWED_DOMAINS = [
      'claude.lbenben.cc.cd',
      'codex.lbenben.cc.cd',
      'claudecode-eut.pages.dev',
      // 新域名占位，买好后填入：
      // 'example.com',
    ];
    const referer = request.headers.get('Referer') || '';
    if (!ALLOWED_DOMAINS.some(d => referer.includes(d))) {
      return new Response('403 Forbidden', {
        status: 403,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }

    const url = new URL(request.url);
    // 解码 URL（支持中文文件名）
    const key = decodeURIComponent(url.pathname.slice(1));

    if (!key) {
      return new Response('Not Found', { status: 404 });
    }

    // 解析 Range 请求头（视频拖动进度条需要）
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
      return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('accept-ranges', 'bytes');
    headers.set('cache-control', 'public, max-age=86400');

    // 分片响应（206）
    if (rangeOption && object.range) {
      const { offset, length } = object.range;
      headers.set(
        'content-range',
        `bytes ${offset}-${offset + length - 1}/${object.size}`
      );
      headers.set('content-length', String(length));
      return new Response(object.body, { status: 206, headers });
    }

    if (object.size) {
      headers.set('content-length', String(object.size));
    }

    return new Response(object.body, { status: 200, headers });
  },
};
