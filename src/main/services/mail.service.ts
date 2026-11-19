/**
 * メール送信サービス（Gmail API / OAuth2）
 *
 * - 認証情報は Electron safeStorage で暗号化し userData 配下に保存する
 * - 送信スコープは gmail.send（最小権限）
 * - OAuth はデスクトップアプリ向けのループバック方式（127.0.0.1 の一時サーバ）
 * - 添付付き MIME は依存追加を避けるため自前で生成する
 */
import { app, safeStorage, shell } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { getSqlite } from '../db/connection.js';
import type {
  MailConfigStatus,
  MailConfigUpdate,
  MailMessageInput,
  MailScheduleRequest,
  MailSendResult,
  ScheduledMail,
} from '../../shared/types.js';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

interface MailConfigData {
  senderName: string;
  senderAddress: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

const emptyConfig: MailConfigData = {
  senderName: '',
  senderAddress: '',
  clientId: '',
  clientSecret: '',
  refreshToken: '',
};

function configFilePath(): string {
  return path.join(app.getPath('userData'), 'mail-config.enc');
}

async function loadConfig(): Promise<MailConfigData> {
  try {
    const raw = await readFile(configFilePath());
    let json: string;
    if (safeStorage.isEncryptionAvailable()) {
      json = safeStorage.decryptString(raw);
    } else {
      // 暗号化不可環境では base64 平文フォールバック（注意ログのみ）
      json = Buffer.from(raw.toString('utf8'), 'base64').toString('utf8');
    }
    const parsed = JSON.parse(json) as Partial<MailConfigData>;
    return { ...emptyConfig, ...parsed };
  } catch {
    return { ...emptyConfig };
  }
}

async function saveConfig(config: MailConfigData): Promise<void> {
  const dir = path.dirname(configFilePath());
  await mkdir(dir, { recursive: true });
  const json = JSON.stringify(config);
  let buf: Buffer;
  if (safeStorage.isEncryptionAvailable()) {
    buf = safeStorage.encryptString(json);
  } else {
    buf = Buffer.from(Buffer.from(json, 'utf8').toString('base64'), 'utf8');
  }
  await writeFile(configFilePath(), buf);
}

export async function getMailConfigStatus(): Promise<MailConfigStatus> {
  const c = await loadConfig();
  return {
    senderName: c.senderName,
    senderAddress: c.senderAddress,
    clientId: c.clientId,
    hasClientSecret: c.clientSecret.length > 0,
    authorized: c.refreshToken.length > 0,
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
  };
}

export async function setMailConfig(update: MailConfigUpdate): Promise<MailConfigStatus> {
  const current = await loadConfig();
  const senderChanged =
    update.senderAddress.trim() !== current.senderAddress ||
    update.clientId.trim() !== current.clientId;
  const next: MailConfigData = {
    ...current,
    senderName: update.senderName.trim(),
    senderAddress: update.senderAddress.trim(),
    clientId: update.clientId.trim(),
    // シークレットは未指定なら据え置き
    clientSecret:
      update.clientSecret !== undefined && update.clientSecret.length > 0
        ? update.clientSecret.trim()
        : current.clientSecret,
    // 送信元やクライアントIDが変わった場合は既存トークンを無効化
    refreshToken: senderChanged ? '' : current.refreshToken,
  };
  await saveConfig(next);
  return getMailConfigStatus();
}

/**
 * OAuth 同意フロー（ループバック）。ブラウザで同意後、リフレッシュトークンを保存する。
 */
export async function authorize(): Promise<{ authorized: boolean; email: string }> {
  const config = await loadConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error('クライアントIDとクライアントシークレットを先に保存してください');
  }

  const { code, redirectUri } = await runLoopbackAuth(config.clientId);

  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error('[mail] token exchange failed:', tokenRes.status, text);
    throw new Error(`トークン取得に失敗しました: ${text}`);
  }

  const token = (await tokenRes.json()) as {
    refresh_token?: string;
    access_token?: string;
  };

  if (!token.refresh_token) {
    console.error('[mail] refresh_token missing in token response');
    throw new Error(
      'リフレッシュトークンを取得できませんでした。Googleアカウントの「アプリのアクセス権」から本アプリを一度削除し、再度連携してください。',
    );
  }

  console.log('[mail] authorize success: refresh_token stored');

  await saveConfig({ ...config, refreshToken: token.refresh_token });

  return { authorized: true, email: config.senderAddress };
}

interface LoopbackResult {
  code: string;
  redirectUri: string;
}

function runLoopbackAuth(clientId: string): Promise<LoopbackResult> {
  return new Promise<LoopbackResult>((resolve, reject) => {
    // ポート(リダイレクトURI)は listen 時に確定し、close 後も参照できるよう保持する
    let redirectUri = '';

    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        // favicon 等のノイズ要求は無視して認可リクエストを待つ
        if (!url.searchParams.has('code') && !url.searchParams.has('error')) {
          res.writeHead(204);
          res.end();
          return;
        }
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;text-align:center;padding:48px">` +
            `<h2>${code ? '連携が完了しました' : '連携に失敗しました'}</h2>` +
            `<p>このタブを閉じてアプリに戻ってください。</p></body>`,
        );
        server.close();
        if (error) {
          reject(new Error(`認可が拒否されました: ${error}`));
          return;
        }
        if (!code) {
          reject(new Error('認可コードを取得できませんでした'));
          return;
        }
        resolve({ code, redirectUri });
      } catch (err) {
        server.close();
        reject(err instanceof Error ? err : new Error('認可処理でエラーが発生しました'));
      }
    });

    server.on('error', (err) => reject(err));

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      redirectUri = `http://127.0.0.1:${addr.port}`;
      const authUrl =
        `${AUTH_ENDPOINT}?` +
        new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: GMAIL_SCOPE,
          access_type: 'offline',
          prompt: 'consent',
        }).toString();
      void shell.openExternal(authUrl);
    });

    // 5分でタイムアウト
    setTimeout(() => {
      server.close();
      reject(new Error('連携がタイムアウトしました。もう一度お試しください。'));
    }, 5 * 60 * 1000);
  });
}

async function getAccessToken(config: MailConfigData): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    // invalid_grant はトークンの失効・取り消し。利用者が取るべき行動を示す
    if (text.includes('invalid_grant')) {
      throw new Error(
        'Googleとの連携の有効期限が切れています。設定 →「メール」から「Googleと連携」をやり直してください。',
      );
    }
    throw new Error(`アクセストークンの更新に失敗しました: ${text}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error('アクセストークンを取得できませんでした');
  }
  return json.access_token;
}

/** RFC2047 (UTF-8 Bエンコード) でヘッダ値をエンコード */
function encodeHeader(value: string): string {
  // ASCII のみならそのまま
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function chunk76(base64: string): string {
  return base64.replace(/.{76}/g, '$&\r\n');
}

function makeBoundary(tag: string): string {
  return `=_rk_${tag}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

/** html 未指定時に text からごく簡単な HTML を生成する */
function textToHtml(text: string): string {
  const escaped = text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', '<br>');
  return (
    `<div style="font-family:'Hiragino Sans','Yu Gothic',Meiryo,sans-serif;font-size:14px;color:#1f2937;line-height:1.8;">` +
    escaped +
    `</div>`
  );
}

function buildMimeMessage(
  from: { name: string; address: string },
  msg: MailMessageInput,
): string {
  const mixedBoundary = makeBoundary('mix');
  const altBoundary = makeBoundary('alt');
  const fromHeader = from.name
    ? `${encodeHeader(from.name)} <${from.address}>`
    : from.address;
  const html = msg.html && msg.html.length > 0 ? msg.html : textToHtml(msg.body);

  const lines: string[] = [];
  lines.push(`From: ${fromHeader}`);
  lines.push(`To: ${msg.to}`);
  // 返信先を送信元（監視中の受信箱）に明示。no-reply を避け正規メールらしさを高める。
  lines.push(`Reply-To: ${fromHeader}`);
  lines.push(`Subject: ${encodeHeader(msg.subject)}`);
  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
  lines.push('');

  // 本文（text と html の併送: multipart/alternative）
  lines.push(`--${mixedBoundary}`);
  lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
  lines.push('');

  lines.push(`--${altBoundary}`);
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  lines.push(chunk76(Buffer.from(msg.body, 'utf8').toString('base64')));

  lines.push(`--${altBoundary}`);
  lines.push('Content-Type: text/html; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  lines.push(chunk76(Buffer.from(html, 'utf8').toString('base64')));

  lines.push(`--${altBoundary}--`);

  // 添付
  for (const att of msg.attachments) {
    const filename = encodeHeader(att.filename);
    lines.push(`--${mixedBoundary}`);
    lines.push(`Content-Type: ${att.mimeType ?? 'application/pdf'}; name="${filename}"`);
    lines.push('Content-Transfer-Encoding: base64');
    lines.push(`Content-Disposition: attachment; filename="${filename}"`);
    lines.push('');
    lines.push(chunk76(att.contentBase64.replace(/\r?\n/g, '')));
  }

  lines.push(`--${mixedBoundary}--`);
  lines.push('');

  return lines.join('\r\n');
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * 複数メッセージを順次送信する。1件ごとの成否を返す。
 */
export async function sendMail(messages: MailMessageInput[]): Promise<MailSendResult[]> {
  const config = await loadConfig();
  if (!config.refreshToken) {
    throw new Error('Googleとの連携が未完了です。設定画面から連携してください。');
  }

  const accessToken = await getAccessToken(config);
  const from = { name: config.senderName, address: config.senderAddress };

  const results: MailSendResult[] = [];
  for (const msg of messages) {
    try {
      const mime = buildMimeMessage(from, msg);
      const res = await fetch(SEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: toBase64Url(mime) }),
      });
      if (!res.ok) {
        const text = await res.text();
        results.push({ to: msg.to, refId: msg.refId, success: false, error: text });
      } else {
        results.push({ to: msg.to, refId: msg.refId, success: true });
      }
    } catch (err) {
      results.push({
        to: msg.to,
        refId: msg.refId,
        success: false,
        error: err instanceof Error ? err.message : '送信に失敗しました',
      });
    }
  }
  return results;
}

/** 連携確認用：送信元自身に短いテストメールを送る */
export async function sendTestMail(): Promise<MailSendResult> {
  const config = await loadConfig();
  if (!config.senderAddress) {
    throw new Error('送信元メールアドレスが未設定です');
  }
  const [result] = await sendMail([
    {
      to: config.senderAddress,
      subject: 'らくらく給与明細α メール連携テスト',
      body: 'このメールはメール連携の動作確認用です。受信できていれば設定は正常です。',
      attachments: [],
    },
  ]);
  return result;
}

function parseStoredMessage(payload: string): MailMessageInput | null {
  try {
    const msg = JSON.parse(payload) as Partial<MailMessageInput>;
    if (typeof msg.to !== 'string' || msg.to.length === 0 || !Array.isArray(msg.attachments)) {
      return null;
    }
    return {
      to: msg.to,
      subject: typeof msg.subject === 'string' ? msg.subject : '',
      body: typeof msg.body === 'string' ? msg.body : '',
      html: typeof msg.html === 'string' ? msg.html : undefined,
      attachments: msg.attachments.map((a) => ({
        filename: String(a.filename ?? 'attachment.pdf'),
        contentBase64: String(a.contentBase64 ?? ''),
        mimeType: typeof a.mimeType === 'string' ? a.mimeType : undefined,
      })),
      refId: typeof msg.refId === 'number' ? msg.refId : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 明細メールを指定時刻まで保存する。同一従業員・期間の未送信予約は置き換える。
 * sendAt は UTC の ISO 8601。画面側で日本時間から変換する。
 */
export function scheduleMails(req: MailScheduleRequest): ScheduledMail[] {
  const when = new Date(req.sendAt);
  if (Number.isNaN(when.getTime())) {
    throw new Error('送信日時が不正です');
  }
  if (when.getTime() <= Date.now()) {
    throw new Error('送信日時は現在より後を指定してください');
  }
  if (req.type !== 'payslip' && req.type !== 'bonus') {
    throw new Error('送信種別が不正です');
  }
  if (req.messages.length === 0) {
    throw new Error('予約するメールがありません');
  }

  const sendAt = when.toISOString();
  const raw = getSqlite();
  const deletePending = raw.prepare(`
    DELETE FROM scheduled_mails
    WHERE employee_id = ? AND type = ? AND period_key = ? AND status = 'pending'
  `);
  const insert = raw.prepare(`
    INSERT INTO scheduled_mails (
      employee_id, type, period_key, to_address, send_at, payload, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `);

  const saved: ScheduledMail[] = [];
  const write = raw.transaction((messages: MailMessageInput[]) => {
    for (const msg of messages) {
      if (typeof msg.refId !== 'number') {
        throw new Error('予約する明細に従業員IDがありません');
      }
      deletePending.run(msg.refId, req.type, req.periodKey);
      const info = insert.run(
        msg.refId,
        req.type,
        req.periodKey,
        msg.to,
        sendAt,
        JSON.stringify(msg),
      );
      saved.push({
        id: Number(info.lastInsertRowid),
        employeeId: msg.refId,
        type: req.type,
        periodKey: req.periodKey,
        toAddress: msg.to,
        sendAt,
        status: 'pending',
        error: null,
      });
    }
  });
  write(req.messages);
  return saved;
}

/** 指定期間の未送信予約を返す */
export function listScheduledMails(type: string, periodKey: string): ScheduledMail[] {
  const rows = getSqlite().prepare(`
    SELECT id,
           employee_id AS employeeId,
           type,
           period_key AS periodKey,
           to_address AS toAddress,
           send_at AS sendAt,
           status,
           error
    FROM scheduled_mails
    WHERE type = ? AND period_key = ? AND status = 'pending'
    ORDER BY employee_id
  `).all(type, periodKey) as ScheduledMail[];
  return rows;
}

interface DueScheduledRow {
  id: number;
  employee_id: number;
  type: string;
  period_key: string;
  to_address: string;
  payload: string;
}

/**
 * 期限を過ぎた予約を送信する。
 * 連携未完了のときは予約を残し、次回の確認で再送する。
 */
export async function processDueScheduledMails(): Promise<void> {
  const raw = getSqlite();
  const due = raw.prepare(`
    SELECT id, employee_id, type, period_key, to_address, payload
    FROM scheduled_mails
    WHERE status = 'pending' AND send_at <= ?
    ORDER BY send_at, id
  `).all(new Date().toISOString()) as DueScheduledRow[];

  const markFailed = raw.prepare(`
    UPDATE scheduled_mails SET status = 'failed', error = ? WHERE id = ?
  `);
  const markSent = raw.prepare(`
    UPDATE scheduled_mails SET status = 'sent', error = NULL WHERE id = ?
  `);
  const recordLog = raw.prepare(`
    INSERT INTO email_logs (employee_id, type, period_key, to_address)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(employee_id, type, period_key) DO NOTHING
  `);

  for (const row of due) {
    const msg = parseStoredMessage(row.payload);
    if (!msg) {
      markFailed.run('保存済みメールの内容を読めませんでした', row.id);
      continue;
    }
    try {
      const [result] = await sendMail([msg]);
      if (!result?.success) {
        const error = result?.error ?? '送信に失敗しました';
        if (error.includes('連携が未完了')) return;
        markFailed.run(error.slice(0, 500), row.id);
        continue;
      }
      recordLog.run(row.employee_id, row.type, row.period_key, row.to_address);
      markSent.run(row.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : '送信に失敗しました';
      if (message.includes('連携が未完了')) return;
      markFailed.run(message.slice(0, 500), row.id);
    }
  }
}

let workerStarted = false;
let processingScheduled = false;

/** 起動中、期限を過ぎた予約を定期的に送る。アプリが閉じていた分は次回起動時に送る。 */
export function startScheduledMailWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  const tick = (): void => {
    if (processingScheduled) return;
    processingScheduled = true;
    void processDueScheduledMails()
      .catch((err: unknown) => {
        console.error('[mail] scheduled send failed:', err);
      })
      .finally(() => {
        processingScheduled = false;
      });
  };
  tick();
  setInterval(tick, 15_000);
}
