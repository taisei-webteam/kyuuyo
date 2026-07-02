import { getSql, sendError, setCorsHeaders, getDeviceFromRequest } from './_db.js';

const PUNCH_TYPES = new Set(['clock_in', 'clock_out', 'go_out', 'go_return']);

function getQueryValue(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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

  // 打刻時刻はサーバー側で確定する（クライアント送信の punchedAt は改ざん防止のため無視）。
  return {
    employeeId: parsed.employeeId,
    employeeName: parsed.employeeName,
    punchType: parsed.punchType,
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

  const punches = employeeId
    ? await sql`
        select id, employee_id, employee_name, punch_type, punched_at, device, cancelled, created_at
        from punch_records
        where employee_id = ${employeeId}
          and punched_at >= ${start}::timestamptz
          and punched_at <= ${end}::timestamptz
        order by punched_at asc
      `
    : await sql`
        select id, employee_id, employee_name, punch_type, punched_at, device, cancelled, created_at
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

  // punched_at はサーバー時刻(now())で確定する。
  const rows = await sql`
    insert into punch_records (employee_id, employee_name, punch_type, punched_at, device)
    values (${body.employeeId}, ${body.employeeName}, ${body.punchType}, now(), 'ipad')
    returning id, employee_id, employee_name, punch_type, punched_at, device, cancelled, created_at
  `;

  res.status(201).json({ punch: rows[0] ?? null });
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
