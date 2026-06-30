import { getSql, sendError, setCorsHeaders } from '../_db.js';

function parseCancelBody(body) {
  const parsed = typeof body === 'string' ? JSON.parse(body) : body;
  if (typeof parsed !== 'object' || parsed === null) return null;

  if (
    typeof parsed.employeeId !== 'number' ||
    typeof parsed.start !== 'string' ||
    typeof parsed.end !== 'string'
  ) {
    return null;
  }

  return {
    punchId: typeof parsed.punchId === 'string' ? parsed.punchId : undefined,
    employeeId: parsed.employeeId,
    start: parsed.start,
    end: parsed.end,
  };
}

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
    const body = parseCancelBody(req.body);
    if (!body) {
      sendError(res, 400, 'Invalid request body');
      return;
    }

    const sql = getSql();
    const rows = body.punchId
      ? await sql`
          update punch_records
          set cancelled = true
          where id = ${body.punchId}::uuid
            and employee_id = ${body.employeeId}
            and cancelled = false
          returning id, employee_id, employee_name, punch_type, punched_at, device, cancelled, created_at
        `
      : await sql`
          update punch_records
          set cancelled = true
          where id = (
            select id
            from punch_records
            where employee_id = ${body.employeeId}
              and cancelled = false
              and punched_at >= ${body.start}::timestamptz
              and punched_at <= ${body.end}::timestamptz
            order by punched_at desc
            limit 1
          )
          returning id, employee_id, employee_name, punch_type, punched_at, device, cancelled, created_at
        `;

    res.status(200).json({ punch: rows[0] ?? null });
  } catch (err) {
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error');
  }
}
