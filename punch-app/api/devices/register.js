import crypto from 'node:crypto';
import {
  getSql,
  sendError,
  setCorsHeaders,
  ensureDeviceTable,
  hashToken,
  safeEqual,
} from '../_db.js';

function parseBody(body) {
  const parsed = typeof body === 'string' ? JSON.parse(body) : body;
  if (typeof parsed !== 'object' || parsed === null) return null;
  if (typeof parsed.password !== 'string') return null;
  return {
    password: parsed.password,
    label: typeof parsed.label === 'string' ? parsed.label.slice(0, 100) : '',
  };
}

/**
 * 端末登録: 管理パスワードが正しければ新しいデバイストークンを発行する。
 * 発行したトークンはこの応答でのみ返し、DB にはハッシュだけを保存する。
 */
export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed');
    return;
  }

  try {
    const adminPassword = process.env.PUNCH_ADMIN_PASSWORD;
    if (!adminPassword) {
      sendError(res, 500, 'PUNCH_ADMIN_PASSWORD が設定されていません');
      return;
    }

    const body = parseBody(req.body);
    if (!body) {
      sendError(res, 400, 'Invalid request body');
      return;
    }

    if (!safeEqual(body.password, adminPassword)) {
      sendError(res, 401, '管理パスワードが違います');
      return;
    }

    const sql = getSql();
    await ensureDeviceTable(sql);

    const token = crypto.randomBytes(32).toString('hex');
    const id = crypto.randomUUID();
    const tokenHash = hashToken(token);

    await sql`
      insert into punch_devices (id, token_hash, label)
      values (${id}, ${tokenHash}, ${body.label})
    `;

    res.status(201).json({ token, id, label: body.label });
  } catch (err) {
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error');
  }
}
