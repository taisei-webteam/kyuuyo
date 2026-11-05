import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

let cachedSql = null;

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  cachedSql ??= neon(databaseUrl);
  return cachedSql;
}

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-token');
}

export function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

// ── 端末認証（デバイストークン）─────────────────────────

/** トークンを SHA-256 でハッシュ化する（DB には生トークンを保存しない）。 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/** タイミング攻撃に配慮した文字列比較。 */
export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

let deviceTableReady = false;

/** 端末登録テーブルを（無ければ）作成する。冪等。 */
export async function ensureDeviceTable(sql) {
  if (deviceTableReady) return;
  await sql`
    create table if not exists punch_devices (
      id text primary key,
      token_hash text not null unique,
      label text not null default '',
      created_at timestamptz not null default now(),
      last_used_at timestamptz,
      revoked boolean not null default false
    )
  `;
  deviceTableReady = true;
}

let punchClientIdReady = false;

/**
 * punch_records に再送重複防止用の client_id 列と unique index を（無ければ）用意する。冪等。
 * 正式には supabase/migrations/005_punch_client_id.sql で適用済みだが、
 * 未適用の環境でも打刻が落ちないよう API 側でも保証する。
 */
export async function ensurePunchClientId(sql) {
  if (punchClientIdReady) return;
  await sql`alter table punch_records add column if not exists client_id text`;
  await sql`create unique index if not exists punch_records_client_id_key on punch_records (client_id)`;
  punchClientIdReady = true;
}

let emailVerificationTableReady = false;

/**
 * メール到達確認テーブルを（無ければ）作成する。冪等。
 * employees_sync への外部キーは張らない（役員など同期対象外の従業員でも確認できるようにする）。
 */
export async function ensureEmailVerificationTable(sql) {
  if (emailVerificationTableReady) return;
  await sql`
    create table if not exists email_verifications (
      token text primary key,
      employee_id integer not null,
      email text not null,
      status text not null default 'pending' check (status in ('pending', 'verified')),
      sent_at timestamptz not null default now(),
      verified_at timestamptz,
      user_agent text
    )
  `;
  await sql`
    create index if not exists email_verifications_employee_id_idx
      on email_verifications (employee_id)
  `;
  emailVerificationTableReady = true;
}

/**
 * リクエストヘッダ x-device-token を検証し、有効な端末なら { id, label } を返す。
 * 未登録・失効・トークン無しの場合は null。
 */
export async function getDeviceFromRequest(req, sql) {
  const header = req.headers['x-device-token'];
  const token = Array.isArray(header) ? header[0] : header;
  if (!token) return null;

  await ensureDeviceTable(sql);
  const tokenHash = hashToken(token);
  const rows = await sql`
    select id, label
    from punch_devices
    where token_hash = ${tokenHash} and revoked = false
    limit 1
  `;
  const device = rows[0] ?? null;
  if (device) {
    await sql`update punch_devices set last_used_at = now() where id = ${device.id}`;
  }
  return device;
}
