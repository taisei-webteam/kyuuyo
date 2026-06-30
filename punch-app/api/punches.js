import { getSql, sendError, setCorsHeaders } from './_db.js';

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

  return {
    employeeId: parsed.employeeId,
    employeeName: parsed.employeeName,
    punchType: parsed.punchType,
    punchedAt: typeof parsed.punchedAt === 'string' ? parsed.punchedAt : undefined,
  };
}

async function handleGet(req, res) {
  const start = getQueryValue(req.query.start);
  const end = getQueryValue(req.query.end);
  const employeeIdRaw = getQueryValue(req.query.employeeId);

  if (!start || !end) {
    sendError(res, 400, 'start and end are required');
    return;
  }

  const sql = getSql();
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

async function handlePost(req, res) {
  const body = parseCreateBody(req.body);
  if (!body) {
    sendError(res, 400, 'Invalid request body');
    return;
  }

  const sql = getSql();
  const punchedAt = body.punchedAt ?? new Date().toISOString();
  const rows = await sql`
    insert into punch_records (employee_id, employee_name, punch_type, punched_at, device)
    values (${body.employeeId}, ${body.employeeName}, ${body.punchType}, ${punchedAt}::timestamptz, 'ipad')
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
    if (req.method === 'GET') {
      await handleGet(req, res);
      return;
    }

    if (req.method === 'POST') {
      await handlePost(req, res);
      return;
    }

    sendError(res, 405, 'Method not allowed');
  } catch (err) {
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error');
  }
}
