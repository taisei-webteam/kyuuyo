import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSql, sendError, setCorsHeaders } from '../_db';
import type { PunchCancelBody, PunchRecord } from '../_types';

function parseCancelBody(body: unknown): PunchCancelBody | null {
  const parsed = typeof body === 'string' ? JSON.parse(body) as unknown : body;
  if (typeof parsed !== 'object' || parsed === null) return null;

  const candidate = parsed as Partial<PunchCancelBody>;
  if (
    typeof candidate.employeeId !== 'number' ||
    typeof candidate.start !== 'string' ||
    typeof candidate.end !== 'string'
  ) {
    return null;
  }

  return {
    punchId: typeof candidate.punchId === 'string' ? candidate.punchId : undefined,
    employeeId: candidate.employeeId,
    start: candidate.start,
    end: candidate.end,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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
        ` as PunchRecord[]
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
        ` as PunchRecord[];

    res.status(200).json({ punch: rows[0] ?? null });
  } catch (err) {
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error');
  }
}
