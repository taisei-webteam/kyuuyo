/**
 * メール到達確認サービス
 *
 * 従業員のメールアドレス（多くはキャリアアドレス）が迷惑メールに振り分けられて
 * いないかを確認する。
 *
 *   1. 送信確認: トークンを発行して Neon に status='pending' で登録し、
 *      確認URL付きのメールを Gmail API で送信する
 *   2. 従業員がメールに書かれたページを開き、「記録する」を押すと
 *      Vercel の /api/verify-email が status='verified' に更新する
 *   3. 状態更新: Neon を照会して結果を返す（ローカル DB への反映は IPC 側）
 *
 * 確認結果を Neon に置くのは、デスクトップアプリが公開URLを持てないため。
 * 打刻連携と同じ Neon / Vercel(punch-app) をそのまま利用する。
 */
import { randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { getMailConfigStatus, sendMail } from './mail.service.js';
import { getAppBaseUrl, getEffectiveDatabaseUrl } from './punch-config.service.js';
import type { EmailVerifyStatus, EmailVerifyState } from '../../shared/types.js';

interface VerificationRow {
  token: string;
  email: string;
  status: string;
  // timestamptz は Date として返る（pg-types によるパース）
  sent_at: string | Date;
  verified_at: string | Date | null;
}

function toIsoString(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

type SqlClient = ReturnType<typeof neon>;

function getSql(): SqlClient {
  const databaseUrl = getEffectiveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error(
      'メール確認の連携先が未設定です。設定 →「打刻連携」で接続文字列(DATABASE_URL)を登録してください。',
    );
  }
  return neon(databaseUrl);
}

/** テーブルを（無ければ）作成する。punch-app 側と同一定義。冪等。 */
async function ensureTable(sql: SqlClient): Promise<void> {
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
}

/** 確認ページのURL。punch-app の /api/verify-email が処理する。 */
function buildVerifyUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/api/verify-email?token=${token}`;
}

/**
 * 到達確認メールの文面を組み立てる。
 *
 * キャリアメールは「確認のご案内＋色付きの確認ボタン＋見知らぬURL」を
 * 詐欺メールとして落とす。次の形にする。
 *   - 件名は給与担当からの事務連絡（確認・要対応・【】を使わない）
 *   - 本文に押させるボタンを置かない。ページのURLは文章中の地の文として書く
 *   - 「心当たりがない場合」など、詐欺メールで定番の結語を使わない
 *   - 入力を求めないことと、返信先を書く
 */
function buildMailBody(params: {
  employeeName: string;
  companyName: string;
  verifyUrl: string;
  senderAddress: string;
}): { subject: string; body: string; html: string } {
  const { employeeName, companyName, verifyUrl, senderAddress } = params;
  const company = companyName.trim().length > 0 ? companyName.trim() : '給与担当';
  const subject = `${company} 給与明細の送付先についてのご連絡`;

  const replyLine =
    senderAddress.length > 0
      ? `このメールに覚えがないときは、${senderAddress} へ返信してください。`
      : 'このメールに覚えがないときは、給与担当へ返信してください。';

  const body = [
    `${employeeName} 様`,
    '',
    `${company}の給与担当です。`,
    'これから給与明細を、このメールアドレスへお送りします。',
    '届いたことを社内の記録に残すため、下のページを一度開き、表示に従って操作してください。',
    '氏名や番号の入力はありません。',
    '',
    verifyUrl,
    '',
    replyLine,
    '',
    `${company}`,
    '給与担当',
  ].join('\n');

  const url = escapeHtml(verifyUrl);
  const html = `<div style="font-family:'Hiragino Sans','Yu Gothic',Meiryo,sans-serif;font-size:14px;color:#1f2937;line-height:1.8;">
  <p>${escapeHtml(employeeName)} 様</p>
  <p>${escapeHtml(company)}の給与担当です。<br>
  これから給与明細を、このメールアドレスへお送りします。<br>
  届いたことを社内の記録に残すため、下のページを一度開き、表示に従って操作してください。<br>
  氏名や番号の入力はありません。</p>
  <p style="word-break:break-all;"><a href="${url}" style="color:#1f2937;text-decoration:underline;">${url}</a></p>
  <p>${escapeHtml(replyLine)}</p>
  <p>${escapeHtml(company)}<br>給与担当</p>
</div>`;

  return { subject, body, html };
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function toStatus(value: string): EmailVerifyStatus {
  return value === 'verified' ? 'verified' : 'pending';
}

/**
 * 確認メールを送信する。
 *
 * 先に Neon へ pending を登録してから送信する（送信済みなのに記録が無い状態を防ぐ）。
 * 同一従業員の未確認トークンは無効化し、常に最新の1件だけを有効にする。
 */
export async function sendVerificationMail(params: {
  employeeId: number;
  email: string;
  employeeName: string;
  companyName: string;
}): Promise<EmailVerifyState> {
  const { employeeId, email, employeeName, companyName } = params;
  const baseUrl = getAppBaseUrl();
  const sql = getSql();
  await ensureTable(sql);

  const token = randomBytes(32).toString('hex');

  // 同一従業員の古い未確認トークンは削除する（確認済みは監査用に残す）
  await sql`
    delete from email_verifications
    where employee_id = ${employeeId} and status = 'pending'
  `;
  await sql`
    insert into email_verifications (token, employee_id, email, status)
    values (${token}, ${employeeId}, ${email}, 'pending')
  `;

  const verifyUrl = buildVerifyUrl(baseUrl, token);
  const senderAddress = (await getMailConfigStatus()).senderAddress;
  const mail = buildMailBody({ employeeName, companyName, verifyUrl, senderAddress });

  // 送信できていないトークンは残さない（確認待ちのまま滞留させない）
  let results;
  try {
    results = await sendMail([
      {
        to: email,
        subject: mail.subject,
        body: mail.body,
        html: mail.html,
        attachments: [],
        refId: employeeId,
      },
    ]);
  } catch (err) {
    await sql`delete from email_verifications where token = ${token}`;
    throw err;
  }

  const result = results[0];
  if (!result || !result.success) {
    await sql`delete from email_verifications where token = ${token}`;
    throw new Error(result?.error ?? '確認メールの送信に失敗しました');
  }

  return {
    employeeId,
    email,
    status: 'pending',
    token,
    sentAt: new Date().toISOString(),
    verifiedAt: null,
  };
}

/**
 * トークンの確認状態を Neon から取得する。
 * トークンが見つからない場合（Neon 側で削除された等）は null を返す。
 */
export async function fetchVerificationState(params: {
  employeeId: number;
  token: string;
}): Promise<EmailVerifyState | null> {
  const sql = getSql();
  await ensureTable(sql);

  const rows = (await sql`
    select token, email, status, sent_at, verified_at
    from email_verifications
    where token = ${params.token}
    limit 1
  `) as VerificationRow[];

  const row = rows[0] ?? null;
  if (!row) return null;

  return {
    employeeId: params.employeeId,
    email: row.email,
    status: toStatus(row.status),
    token: row.token,
    sentAt: toIsoString(row.sent_at),
    verifiedAt: toIsoString(row.verified_at),
  };
}
