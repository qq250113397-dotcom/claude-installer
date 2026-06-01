import { timingSafeEqual } from 'node:crypto';

const DEFAULT_ALLOWED_ORIGINS = [
  'claude.lbenben.cc.cd',
  'codex.lbenben.cc.cd',
  'claudecode-eut.pages.dev',
];

export default {
  async fetch(request, env) {
    const authError = await assertAuthorized(request, env);
    if (authError) return authError;

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.slice(1));
    const action = (url.searchParams.get('action') || '').toLowerCase();

    if (!key) {
      return json({ error: 'missing_key' }, 404);
    }

    if (request.method === 'POST' && action === 'create') {
      return handleCreate(request, env, key);
    }

    if (request.method === 'PUT' && action === 'part') {
      return handlePart(request, env, key, url);
    }

    if (request.method === 'POST' && action === 'complete') {
      return handleComplete(request, env, key, url);
    }

    if (request.method === 'DELETE' && action === 'abort') {
      return handleAbort(env, key, url);
    }

    return json(
      {
        error: 'unsupported_request',
        expected: [
          'POST ?action=create',
          'PUT ?action=part',
          'POST ?action=complete',
          'DELETE ?action=abort',
        ],
      },
      405,
    );
  },
};

async function handleCreate(request, env, key) {
  const contentType = request.headers.get('content-type') || 'application/octet-stream';
  const multipart = await env.BUCKET.createMultipartUpload(key, {
    httpMetadata: { contentType },
  });

  return json({
    key,
    uploadId: multipart.uploadId,
  });
}

async function handlePart(request, env, key, url) {
  const uploadId = url.searchParams.get('uploadId');
  const partNumber = Number(url.searchParams.get('partNumber'));

  if (!uploadId) {
    return json({ error: 'missing_uploadId' }, 400);
  }

  if (!Number.isInteger(partNumber) || partNumber < 1) {
    return json({ error: 'invalid_partNumber' }, 400);
  }

  if (!request.body) {
    return json({ error: 'missing_body' }, 400);
  }

  const multipart = env.BUCKET.resumeMultipartUpload(key, uploadId);
  const uploadedPart = await multipart.uploadPart(partNumber, request.body);

  return json({
    key,
    uploadId,
    partNumber: uploadedPart.partNumber,
    etag: uploadedPart.etag,
  });
}

async function handleComplete(request, env, key, url) {
  const uploadId = url.searchParams.get('uploadId');
  if (!uploadId) {
    return json({ error: 'missing_uploadId' }, 400);
  }

  const body = await request.json().catch(() => null);
  const parts = body?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return json({ error: 'missing_parts' }, 400);
  }

  const multipart = env.BUCKET.resumeMultipartUpload(key, uploadId);
  const object = await multipart.complete(parts);

  return json({
    key: object.key,
    size: object.size,
    etag: object.httpEtag,
  });
}

async function handleAbort(env, key, url) {
  const uploadId = url.searchParams.get('uploadId');
  if (!uploadId) {
    return json({ error: 'missing_uploadId' }, 400);
  }

  const multipart = env.BUCKET.resumeMultipartUpload(key, uploadId);
  await multipart.abort();
  return json({ ok: true, key, uploadId });
}

async function assertAuthorized(request, env) {
  const expectedToken = env.R2_UPLOAD_TOKEN;
  if (!expectedToken) {
    return json({ error: 'server_misconfigured' }, 500);
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || !timingSafeEqualUtf8(token, expectedToken)) {
    return json({ error: 'unauthorized' }, 401, {
      'www-authenticate': 'Bearer realm="r2-upload"',
    });
  }

  const referer = request.headers.get('referer') || '';
  if (referer && !DEFAULT_ALLOWED_ORIGINS.some(origin => referer.includes(origin))) {
    return json({ error: 'forbidden_origin' }, 403);
  }

  return null;
}

function timingSafeEqualUtf8(a, b) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}
