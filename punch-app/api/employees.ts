import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSql, sendError, setCorsHeaders } from './_db';
import type { EmployeeSync } from './_types';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    sendError(res, 405, 'Method not allowed');
    return;
  }

  try {
    const sql = getSql();
    const employees = await sql`
      select id, name, name_kana, employee_type, display_order, is_active
      from employees_sync
      where is_active = true
      order by display_order asc, id asc
    ` as EmployeeSync[];

    res.status(200).json({ employees });
  } catch (err) {
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error');
  }
}
