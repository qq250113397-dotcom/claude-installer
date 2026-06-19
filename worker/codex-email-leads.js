const ALLOWED_ORIGINS = [
  'https://codex.lbenben.cc.cd',
  'https://claude.lbenben.cc.cd',
  'https://claudecode-eut.pages.dev',
];

const MAX_BODY_BYTES = 16 * 1024;
const LEAD_PREFIX = 'lead:';
const DEFAULT_RECIPIENT = 'qq250113397@gmail.com';

class PayloadTooLargeError extends Error {}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405, request);
    }

    const originError = assertOrigin(request);
    if (originError) return originError;

    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return json({ ok: false, error: 'payload_too_large' }, 413, request);
      }
      return json({ ok: false, error: 'invalid_json' }, 400, request);
    }

    const email = normalizeEmail(body?.email);
    if (!isValidEmail(email)) {
      return json({ ok: false, error: 'invalid_email' }, 400, request);
    }

    const createdAt = new Date().toISOString();
    const sourcePage = normalizeText(body?.sourcePage) || 'unknown';
    const key = `${LEAD_PREFIX}${new Date().toISOString().slice(0, 10)}:${createdAt}:${crypto.randomUUID()}`;
    await env.CODEX_EMAIL_LEADS.put(
      key,
      JSON.stringify({
        email,
        sourcePage,
        createdAt,
      }),
    );

    return json({ ok: true }, 200, request);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(sendDailyDigest(env, controller.cron));
  },
};

async function sendDailyDigest(env, cron) {
  const recipient = normalizeEmail(env.ALERT_TO_EMAIL) || DEFAULT_RECIPIENT;
  const sender = normalizeEmail(env.ALERT_FROM_EMAIL) || `codex@${normalizeText(env.DOMAIN) || 'lbenben.cc.cd'}`;

  const rows = await listAllLeads(env.CODEX_EMAIL_LEADS);
  if (rows.length === 0) {
    console.log(JSON.stringify({ message: 'codex_email_digest_empty', cron }));
    return;
  }

  rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  const csv = buildCsv(rows);
  const text = buildText(rows, cron);
  const subject = `Codex 邮箱汇总 ${new Date().toISOString().slice(0, 10)}`;

  await env.EMAIL.send({
    to: recipient,
    from: sender,
    subject,
    text,
    html: buildHtml(rows, cron),
    attachments: [
      {
        filename: `codex-emails-${new Date().toISOString().slice(0, 10)}.csv`,
        content: Buffer.from(csv, 'utf8').toString('base64'),
        type: 'text/csv; charset=utf-8',
        disposition: 'attachment',
      },
    ],
  });

  await Promise.all(rows.map(row => env.CODEX_EMAIL_LEADS.delete(row.key)));
  console.log(JSON.stringify({ message: 'codex_email_digest_sent', count: rows.length, cron, recipient }));
}

async function listAllLeads(kv) {
  const rows = [];
  let cursor;
  do {
    const result = await kv.list({ prefix: LEAD_PREFIX, cursor });
    for (const item of result.keys) {
      const value = await kv.get(item.name, { type: 'json' });
      if (value && isValidEmail(value.email)) {
        rows.push({
          key: item.name,
          email: normalizeEmail(value.email),
          sourcePage: normalizeText(value.sourcePage) || 'unknown',
          createdAt: normalizeText(value.createdAt) || '',
        });
      }
    }
    cursor = result.cursor;
    if (result.list_complete) break;
  } while (cursor);

  return rows;
}

function buildCsv(rows) {
  const lines = ['email,created_at,source_page'];
  for (const row of rows) {
    lines.push([
      csvEscape(row.email),
      csvEscape(row.createdAt),
      csvEscape(row.sourcePage),
    ].join(','));
  }
  return lines.join('\n');
}

function buildText(rows, cron) {
  const lines = [
    `Codex 邮箱每日汇总`,
    `触发时间: ${new Date().toISOString()}`,
    `Cron: ${cron || 'manual'}`,
    `总数: ${rows.length}`,
    '',
    'email\tcreated_at\tsource_page',
  ];
  for (const row of rows) {
    lines.push(`${row.email}\t${row.createdAt}\t${row.sourcePage}`);
  }
  return lines.join('\n');
}

function buildHtml(rows, cron) {
  const tableRows = rows
    .map(
      row => `<tr><td>${escapeHtml(row.email)}</td><td>${escapeHtml(row.createdAt)}</td><td>${escapeHtml(row.sourcePage)}</td></tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;background:#fafaf8;color:#1c1917;padding:24px;">
    <div style="max-width:900px;margin:0 auto;background:#fff;border:1px solid #e8e0d5;border-radius:14px;padding:24px;">
      <h1 style="margin:0 0 8px;">Codex 邮箱每日汇总</h1>
      <p style="margin:0 0 16px;color:#78716c;">Cron: ${escapeHtml(cron || 'manual')} | 总数: ${rows.length}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #e8e0d5;">Email</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #e8e0d5;">Created At</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #e8e0d5;">Source Page</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </body>
</html>`;
}

function assertOrigin(request) {
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  const allowed = ALLOWED_ORIGINS.some(value => origin.startsWith(value) || referer.startsWith(value));
  if (!allowed) {
    return json({ ok: false, error: 'forbidden_origin' }, 403, request);
  }
  return null;
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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || '').trim();
}

function csvEscape(value) {
  const text = String(value || '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function corsHeaders(request) {
  const origin = request.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.find(value => origin.startsWith(value)) || ALLOWED_ORIGINS[0];
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
  };
}

function json(payload, status = 200, request) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(request ? corsHeaders(request) : {}),
    },
  });
}
