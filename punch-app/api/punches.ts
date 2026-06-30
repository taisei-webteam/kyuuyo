import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSql, sendError, setCorsHeaders } from './_db';
import type { PunchCreateBody, PunchRecord } from './_types';

function getQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseCreateBody(body: unknown): PunchCreateBody | null {
  const parsed = typeof body === 'string' ? JSON.parse(body) as unknown : body;
  if (typeof parsed !== 'object' || parsed === null) return null;

  const candidate = parsed as Partial<PunchCreateBody>;
  if (
    typeof candidate.employeeId !== 'number' ||
    typeof candidate.employeeName !== 'string' ||
    (candidate.punchType !== 'clock_in' && candidate.punchType !== 'clock_out')
  ) {
    return null;
  }

  return {
    employeeId: candidate.employeeId,
    employeeName: candidate.employeeName,
    punchType: candidate.punchType,
    punchedAt: typeof candidate.punchedAt === 'string' ? candidate.punchedAt : undefined,
  };
}

async function handleGet(req: VercelRequest, res: VercelResponse): Promise<void> {
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
      ` as PunchRecord[]
    : await sql`
        select id, employee_id, employee_name, punch_type, punched_at, device, cancelled, created_at
        from punch_records
        where punched_at >= ${start}::timestamptz
          and punched_at <= ${end}::timestamptz
        order by punched_at asc
      ` as PunchRecord[];

  res.status(200).json({ punches });
}

async function handlePost(req: VercelRequest, res: VercelResponse): Promise<void> {
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
  ` as PunchRecord[];

  res.status(201).json({ punch: rows[0] ?? null });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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
