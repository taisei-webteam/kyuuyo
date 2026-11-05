import {
  getSql,
  sendError,
  setCorsHeaders,
  getDeviceFromRequest,
  ensurePunchClientId,
} from './_db.js';

const PUNCH_TYPES = new Set(['clock_in', 'clock_out', 'go_out', 'go_return']);

/** 端末が再送してきた打刻時刻として受け付ける過去方向の上限（通信障害が長引いた場合を想定）。 */
const MAX_PUNCHED_AT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** 端末時計の進みとして許容する未来方向の上限。これを超える場合はサーバー時刻にする。 */
const MAX_PUNCHED_AT_SKEW_MS = 2 * 60 * 1000;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function getQueryValue(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * 端末が送ってきた打刻時刻を検証し、採用できれば ISO 文字列、できなければ null を返す。
 * 端末は登録済み（デバイストークン認証）なので、通信失敗時に端末側で保持していた
 * 「実際に押した時刻」を、過去7日以内・未来2分以内の範囲で受け付ける。
 * これにより再送しても打刻時刻がずれない。範囲外・不正な値はサーバー時刻にする。
 */
function normalizePunchedAt(value, now = Date.now()) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  if (ms > now + MAX_PUNCHED_AT_SKEW_MS) return null;
  if (ms < now - MAX_PUNCHED_AT_AGE_MS) return null;
  return new Date(ms).toISOString();
}

function parseCreateBody(body) {
  const parsed = typeof body === 'string' ? JSON.parse(body) : body;
  if (typeof parsed !== 'object' || parsed === null) return null;

  if (
    typeof parsed.employeeId !== 'number' ||
    typeof parsed.employeeName !== 'string' ||
    !PUNCH_TYPES.has(parsed.punchType)
  ) {
    return null;
  }

  // device: 'ipad'=ボタンを押した時刻、'manual'=打刻画面の長押しで時刻を指定した手動打刻
  const device = parsed.device === 'manual' ? 'manual' : 'ipad';
  const punchedAt = normalizePunchedAt(parsed.punchedAt);

  // 手動打刻は指定時刻そのものが内容なので、時刻が不正・範囲外なら受け付けない
  // （サーバー時刻で黙って置き換えると、意図しない時刻の打刻になる）
  if (device === 'manual' && !punchedAt) return null;

  return {
    employeeId: parsed.employeeId,
    employeeName: parsed.employeeName,
    punchType: parsed.punchType,
    // 端末が採番した再送重複防止キー（旧バージョンの端末は送ってこない）
    clientId:
      typeof parsed.clientId === 'string' && CLIENT_ID_PATTERN.test(parsed.clientId)
        ? parsed.clientId
        : null,
    punchedAt,
    device,
  };
}

async function handleGet(req, res, sql) {
  const start = getQueryValue(req.query.start);
  const end = getQueryValue(req.query.end);
  const employeeIdRaw = getQueryValue(req.query.employeeId);

  if (!start || !end) {
    sendError(res, 400, 'start and end are required');
    return;
  }

  const employeeId = employeeIdRaw ? Number(employeeIdRaw) : null;

  await ensurePunchClientId(sql);

  const punches = employeeId
    ? await sql`
        select id, employee_id, employee_name, punch_type, punched_at, device, cancelled, created_at, client_id
        from punch_records
        where employee_id = ${employeeId}
          and punched_at >= ${start}::timestamptz
          and punched_at <= ${end}::timestamptz
        order by punched_at asc
      `
    : await sql`
        select id, employee_id, employee_name, punch_type, punched_at, device, cancelled, created_at, client_id
        from punch_records
        where punched_at >= ${start}::timestamptz
          and punched_at <= ${end}::timestamptz
        order by punched_at asc
      `;

  res.status(200).json({ punches });
}

async function handlePost(req, res, sql) {
  const body = parseCreateBody(req.body);
  if (!body) {
    sendError(res, 400, 'Invalid request body');
    return;
  }

  await ensurePunchClientId(sql);

  // punched_at は原則サーバー時刻。端末が再送用に保持していた時刻は
  // normalizePunchedAt で検証済みの場合のみ採用する。
  if (body.clientId) {
    // 同じ client_id の再送は新規行を作らず、既存行をそのまま返す（冪等）。
    // 応答だけが端末に届かなかったケースで二重打刻になるのを防ぐ。
    const inserted = await sql`
      insert into punch_records (employee_id, employee_name, punch_type, punched_at, device, client_id)
      values (
        ${body.employeeId},
        ${body.employeeName},
        ${body.punchType},
        coalesce(${body.punchedAt}::timestamptz, now()),
        ${body.device},
        ${body.clientId}
      )
      on conflict (client_id) do nothing
      returning id, employee_id, employee_name, punch_type, punched_at, device, cancelled, created_at, client_id
    `;
    if (inserted[0]) {
      res.status(201).json({ punch: inserted[0], duplicate: false });
      return;
    }
    const existing = await sql`
      select id, employee_id, employee_name, punch_type, punched_at, device, cancelled, created_at, client_id
      from punch_records
      where client_id = ${body.clientId}
      limit 1
    `;
    res.status(200).json({ punch: existing[0] ?? null, duplicate: true });
    return;
  }

  const rows = await sql`
    insert into punch_records (employee_id, employee_name, punch_type, punched_at, device)
    values (
      ${body.employeeId},
      ${body.employeeName},
      ${body.punchType},
      coalesce(${body.punchedAt}::timestamptz, now()),
      ${body.device}
    )
    returning id, employee_id, employee_name, punch_type, punched_at, device, cancelled, created_at, client_id
  `;

  res.status(201).json({ punch: rows[0] ?? null, duplicate: false });
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const sql = getSql();

    // 登録済み端末のみ許可（未登録ブラウザからの打刻・閲覧を弾く）
    const device = await getDeviceFromRequest(req, sql);
    if (!device) {
      sendError(res, 401, 'この端末は打刻を許可されていません');
      return;
    }

    if (req.method === 'GET') {
      await handleGet(req, res, sql);
      return;
    }

    if (req.method === 'POST') {
      await handlePost(req, res, sql);
      return;
    }

    sendError(res, 405, 'Method not allowed');
  } catch (err) {
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error');
  }
}
