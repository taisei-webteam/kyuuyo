import { getSql, sendError, setCorsHeaders, getDeviceFromRequest } from './_db.js';

export default async function handler(req, res) {
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

    // 登録済み端末のみ許可
    const device = await getDeviceFromRequest(req, sql);
    if (!device) {
      sendError(res, 401, 'この端末は打刻を許可されていません');
      return;
    }

    const employees = await sql`
      select id, name, name_kana, employee_type, display_order, is_active
      from employees_sync
      where is_active = true
        and employee_type != '役員'
      order by display_order asc, id asc
    `;

    res.status(200).json({ employees });
  } catch (err) {
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error');
  }
}
