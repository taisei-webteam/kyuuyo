import { getSql, ensureEmailVerificationTable } from './_db.js';

/**
 * メール到達確認エンドポイント（公開リンク）
 *
 * GET  /api/verify-email?token=... → 確認ページを表示（「確認する」ボタン）
 * POST /api/verify-email?token=... → 確認を確定し status を verified にする
 *
 * GET では確定しない。キャリアメールや迷惑メールフィルタのリンク先自動取得
 * （プレフェッチ）で誤って確認済みになるのを防ぐため、確定は POST のみとする。
 * 端末トークン認証は行わない（従業員がメールから直接開くため）。
 */

function getQueryValue(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** トークン形式（64桁の16進文字列）を検証する。 */
function isValidToken(token) {
  return typeof token === 'string' && /^[0-9a-f]{64}$/.test(token);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** リンクを共有された第三者にアドレス全体が見えないよう伏せる。 */
function maskEmail(email) {
  const at = String(email).indexOf('@');
  if (at <= 0) return '***';
  const local = String(email).slice(0, at);
  const domain = String(email).slice(at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'*'.repeat(Math.max(1, local.length - head.length))}${domain}`;
}

function renderPage({ title, heading, message, badge, badgeColor, token }) {
  const form = token
    ? `<form method="post" action="/api/verify-email?token=${escapeHtml(token)}">
        <button type="submit" class="btn">確認する</button>
      </form>`
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px 16px;
    font-family: -apple-system, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
    background: #f4f4f5; color: #18181b;
    -webkit-text-size-adjust: 100%;
  }
  .card {
    max-width: 480px; margin: 0 auto; padding: 28px 20px;
    background: #fff; border-radius: 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,.1);
    text-align: center;
  }
  .badge {
    display: inline-block; margin-bottom: 16px;
    padding: 5px 14px; border-radius: 999px;
    font-size: 13px; font-weight: 700; color: #fff;
  }
  h1 { margin: 0 0 12px; font-size: 20px; line-height: 1.5; }
  p { margin: 0 0 8px; font-size: 15px; line-height: 1.8; color: #52525b; }
  .btn {
    display: block; width: 100%; margin-top: 24px; padding: 16px;
    font-size: 17px; font-weight: 700; color: #fff;
    background: #2563eb; border: none; border-radius: 10px;
    cursor: pointer; -webkit-appearance: none;
  }
  .btn:active { background: #1d4ed8; }
  .note { margin-top: 20px; font-size: 13px; color: #71717a; }
</style>
</head>
<body>
  <div class="card">
    <span class="badge" style="background:${escapeHtml(badgeColor)}">${escapeHtml(badge)}</span>
    <h1>${escapeHtml(heading)}</h1>
    <p>${message}</p>
    ${form}
    <p class="note">このページは給与明細メールが正しく届くかを確認するためのものです。</p>
  </div>
</body>
</html>`;
}

function sendHtml(res, status, html) {
  res.status(status);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
}

function sendInvalid(res) {
  sendHtml(
    res,
    404,
    renderPage({
      title: 'リンクが無効です',
      heading: 'このリンクは無効です',
      message:
        '確認用リンクの有効期限が切れているか、URLが正しく開かれていない可能性があります。<br>お手数ですが担当者にお知らせください。',
      badge: '無効',
      badgeColor: '#71717a',
      token: null,
    }),
  );
}

function sendVerified(res, email) {
  sendHtml(
    res,
    200,
    renderPage({
      title: '確認が完了しました',
      heading: '受信確認が完了しました',
      message: `<strong>${escapeHtml(maskEmail(email))}</strong> でメールを受信できることを確認しました。<br>このページを閉じてください。`,
      badge: '確認済み',
      badgeColor: '#16a34a',
      token: null,
    }),
  );
}

async function handleGet(res, sql, token) {
  const rows = await sql`
    select token, email, status from email_verifications where token = ${token} limit 1
  `;
  const row = rows[0] ?? null;
  if (!row) {
    sendInvalid(res);
    return;
  }

  if (row.status === 'verified') {
    sendVerified(res, row.email);
    return;
  }

  sendHtml(
    res,
    200,
    renderPage({
      title: 'メール受信確認',
      heading: 'メールが届きました',
      message: `<strong>${escapeHtml(maskEmail(row.email))}</strong> にメールが届いていることを確認します。<br>下のボタンを押してください。`,
      badge: '確認待ち',
      badgeColor: '#2563eb',
      token: row.token,
    }),
  );
}

async function handlePost(req, res, sql, token) {
  const uaHeader = req.headers['user-agent'];
  const userAgent = (Array.isArray(uaHeader) ? uaHeader[0] : uaHeader ?? '').slice(0, 300);

  const rows = await sql`
    update email_verifications
    set status = 'verified',
        verified_at = coalesce(verified_at, now()),
        user_agent = coalesce(user_agent, ${userAgent})
    where token = ${token}
    returning email
  `;
  const row = rows[0] ?? null;
  if (!row) {
    sendInvalid(res);
    return;
  }

  sendVerified(res, row.email);
}

export default async function handler(req, res) {
  const token = getQueryValue(req.query?.token);

  if (!isValidToken(token)) {
    sendInvalid(res);
    return;
  }

  try {
    const sql = getSql();
    await ensureEmailVerificationTable(sql);

    if (req.method === 'GET') {
      await handleGet(res, sql, token);
      return;
    }

    if (req.method === 'POST') {
      await handlePost(req, res, sql, token);
      return;
    }

    res.status(405);
    res.setHeader('Allow', 'GET, POST');
    res.send('Method not allowed');
  } catch (err) {
    sendHtml(
      res,
      500,
      renderPage({
        title: 'エラー',
        heading: '確認処理に失敗しました',
        message:
          '時間をおいて再度お試しください。<br>解決しない場合は担当者にお知らせください。',
        badge: 'エラー',
        badgeColor: '#dc2626',
        token: null,
      }),
    );
    console.error('verify-email failed:', err);
  }
}
