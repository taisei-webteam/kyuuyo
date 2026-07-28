/**
 * メール送信（Gmail API）IPC ハンドラ
 */
import { ipcMain } from 'electron';
import { eq } from 'drizzle-orm';
import { IPC } from '../../shared/ipc-channels.js';
import { getDb, getSqlite } from '../db/connection.js';
import { companies, employees } from '../db/schema.js';
import {
  getMailConfigStatus,
  setMailConfig,
  authorize,
  sendMail,
  sendTestMail,
} from '../services/mail.service.js';
import {
  sendVerificationMail,
  fetchVerificationState,
} from '../services/email-verify.service.js';
import type {
  IpcResult,
  MailConfigStatus,
  MailConfigUpdate,
  MailMessageInput,
  MailSendResult,
  EmailLog,
  EmailLogInput,
  EmailVerifyState,
  EmailVerifyStatus,
} from '../../shared/types.js';

function validateConfigUpdate(params: unknown): MailConfigUpdate {
  const p = params as Partial<MailConfigUpdate> | null;
  if (!p || typeof p.senderAddress !== 'string' || typeof p.clientId !== 'string') {
    throw new Error('メール設定の入力値が不正です');
  }
  return {
    senderName: typeof p.senderName === 'string' ? p.senderName : '',
    senderAddress: p.senderAddress,
    clientId: p.clientId,
    clientSecret: typeof p.clientSecret === 'string' ? p.clientSecret : undefined,
  };
}

function validateMessages(params: unknown): MailMessageInput[] {
  const p = params as { messages?: unknown } | null;
  if (!p || !Array.isArray(p.messages)) {
    throw new Error('送信メッセージが不正です');
  }
  return p.messages.map((m): MailMessageInput => {
    const msg = m as Partial<MailMessageInput>;
    if (typeof msg.to !== 'string' || msg.to.length === 0) {
      throw new Error('宛先メールアドレスが不正です');
    }
    return {
      to: msg.to,
      subject: typeof msg.subject === 'string' ? msg.subject : '',
      body: typeof msg.body === 'string' ? msg.body : '',
      html: typeof msg.html === 'string' ? msg.html : undefined,
      attachments: Array.isArray(msg.attachments)
        ? msg.attachments.map((a) => ({
            filename: String(a.filename ?? 'attachment.pdf'),
            contentBase64: String(a.contentBase64 ?? ''),
            mimeType: typeof a.mimeType === 'string' ? a.mimeType : undefined,
          }))
        : [],
      refId: typeof msg.refId === 'number' ? msg.refId : undefined,
    };
  });
}

/** DB の他カラムと同じ 'YYYY-MM-DD HH:MM:SS'（端末のローカル時刻）に整形する。 */
function toLocalDateTime(value: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return (
    `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())} ` +
    `${p(value.getHours())}:${p(value.getMinutes())}:${p(value.getSeconds())}`
  );
}

interface VerifyTargetRow {
  id: number;
  name: string;
  email: string;
  emailVerifyStatus: string;
  emailVerifyToken: string | null;
  emailVerifySentAt: string | null;
  emailVerifiedAt: string | null;
}

/** 到達確認の対象従業員を取得する（未登録・アドレス未設定はエラー）。 */
function getVerifyTarget(employeeId: number): VerifyTargetRow {
  const db = getDb();
  const row = db
    .select({
      id: employees.id,
      name: employees.name,
      email: employees.email,
      emailVerifyStatus: employees.emailVerifyStatus,
      emailVerifyToken: employees.emailVerifyToken,
      emailVerifySentAt: employees.emailVerifySentAt,
      emailVerifiedAt: employees.emailVerifiedAt,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .get();

  if (!row) throw new Error('従業員が見つかりません');
  if (row.email.trim().length === 0) {
    throw new Error('メールアドレスが登録されていません');
  }
  return row;
}

function validateEmployeeId(params: unknown): number {
  const p = params as { employeeId?: unknown } | null;
  if (!p || typeof p.employeeId !== 'number' || !Number.isInteger(p.employeeId)) {
    throw new Error('従業員IDが不正です');
  }
  return p.employeeId;
}

export function registerMailHandlers(): void {
  ipcMain.handle(
    IPC.MAIL.GET_CONFIG,
    async (): Promise<IpcResult<MailConfigStatus>> => {
      try {
        return { success: true, data: await getMailConfigStatus() };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'メール設定の取得に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.MAIL.SET_CONFIG,
    async (_event, params: unknown): Promise<IpcResult<MailConfigStatus>> => {
      try {
        const update = validateConfigUpdate(params);
        return { success: true, data: await setMailConfig(update) };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'メール設定の保存に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.MAIL.AUTHORIZE,
    async (): Promise<IpcResult<{ authorized: boolean; email: string }>> => {
      try {
        return { success: true, data: await authorize() };
      } catch (err) {
        console.error('[mail] authorize handler error:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Google連携に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.MAIL.SEND,
    async (_event, params: unknown): Promise<IpcResult<MailSendResult[]>> => {
      try {
        const messages = validateMessages(params);
        return { success: true, data: await sendMail(messages) };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'メール送信に失敗しました' };
      }
    },
  );

  ipcMain.handle(
    IPC.MAIL.TEST,
    async (): Promise<IpcResult<MailSendResult>> => {
      try {
        return { success: true, data: await sendTestMail() };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'テスト送信に失敗しました' };
      }
    },
  );

  // メール送信履歴の取得（期間キー単位）
  ipcMain.handle(
    IPC.MAIL.LOG_LIST,
    async (_event, params: { type: string; periodKey: string }): Promise<IpcResult<EmailLog[]>> => {
      try {
        const raw = getSqlite();
        const rows = raw.prepare(`
          SELECT id,
                 employee_id AS employeeId,
                 type,
                 period_key AS periodKey,
                 to_address AS toAddress,
                 sent_at AS sentAt
          FROM email_logs
          WHERE type = ? AND period_key = ?
          ORDER BY employee_id
        `).all(params.type, params.periodKey) as EmailLog[];
        return { success: true, data: rows };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'メール送信履歴の取得に失敗しました' };
      }
    },
  );

  // メール送信記録の登録（同一従業員・種別・期間は二重登録しない）
  ipcMain.handle(
    IPC.MAIL.LOG_RECORD,
    async (_event, params: EmailLogInput): Promise<IpcResult<{ recorded: boolean }>> => {
      try {
        if (
          !params ||
          typeof params.employeeId !== 'number' ||
          typeof params.type !== 'string' ||
          typeof params.periodKey !== 'string'
        ) {
          throw new Error('送信記録の入力値が不正です');
        }
        const raw = getSqlite();
        raw.prepare(`
          INSERT INTO email_logs (employee_id, type, period_key, to_address)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(employee_id, type, period_key) DO NOTHING
        `).run(params.employeeId, params.type, params.periodKey, params.toAddress ?? null);
        return { success: true, data: { recorded: true } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'メール送信記録の保存に失敗しました' };
      }
    },
  );

  /**
   * 到達確認メールの送信。
   * 送信に成功したらローカルの従業員を「受信確認中(pending)」にする。
   */
  ipcMain.handle(
    IPC.MAIL.SEND_VERIFICATION,
    async (_event, params: unknown): Promise<IpcResult<EmailVerifyState>> => {
      try {
        const employeeId = validateEmployeeId(params);
        const target = getVerifyTarget(employeeId);
        const db = getDb();
        const company = db.select({ name: companies.name }).from(companies).get();

        const sent = await sendVerificationMail({
          employeeId,
          email: target.email,
          employeeName: target.name,
          companyName: company?.name ?? '',
        });

        const sentAt = toLocalDateTime(new Date());
        db.update(employees)
          .set({
            emailVerifyStatus: 'pending',
            emailVerifyToken: sent.token,
            emailVerifySentAt: sentAt,
            emailVerifiedAt: null,
          })
          .where(eq(employees.id, employeeId))
          .run();

        return {
          success: true,
          data: {
            employeeId,
            email: target.email,
            status: 'pending',
            token: sent.token,
            sentAt,
            verifiedAt: null,
          },
        };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '確認メールの送信に失敗しました' };
      }
    },
  );

  /**
   * 確認状態の更新（手動）。
   * Neon を照会し、受信者が確認ページで確定していればローカルを「確認済み」にする。
   */
  ipcMain.handle(
    IPC.MAIL.REFRESH_VERIFICATION,
    async (_event, params: unknown): Promise<IpcResult<EmailVerifyState>> => {
      try {
        const employeeId = validateEmployeeId(params);
        const target = getVerifyTarget(employeeId);
        const db = getDb();

        // 未送信なら照会するものが無いので現在値をそのまま返す
        if (!target.emailVerifyToken) {
          return {
            success: true,
            data: {
              employeeId,
              email: target.email,
              status: target.emailVerifyStatus as EmailVerifyStatus,
              token: null,
              sentAt: target.emailVerifySentAt,
              verifiedAt: target.emailVerifiedAt,
            },
          };
        }

        const remote = await fetchVerificationState({
          employeeId,
          token: target.emailVerifyToken,
        });

        // Neon 側に記録が無い（削除された等）場合は未確認に戻して再送を促す
        if (!remote) {
          db.update(employees)
            .set({
              emailVerifyStatus: 'unverified',
              emailVerifyToken: null,
              emailVerifySentAt: null,
              emailVerifiedAt: null,
            })
            .where(eq(employees.id, employeeId))
            .run();
          return {
            success: true,
            data: {
              employeeId,
              email: target.email,
              status: 'unverified',
              token: null,
              sentAt: null,
              verifiedAt: null,
            },
          };
        }

        if (remote.status !== 'verified') {
          return {
            success: true,
            data: {
              employeeId,
              email: target.email,
              status: 'pending',
              token: target.emailVerifyToken,
              sentAt: target.emailVerifySentAt,
              verifiedAt: null,
            },
          };
        }

        const verifiedAt = toLocalDateTime(
          remote.verifiedAt ? new Date(remote.verifiedAt) : new Date(),
        );
        db.update(employees)
          .set({ emailVerifyStatus: 'verified', emailVerifiedAt: verifiedAt })
          .where(eq(employees.id, employeeId))
          .run();

        return {
          success: true,
          data: {
            employeeId,
            email: target.email,
            status: 'verified',
            token: target.emailVerifyToken,
            sentAt: target.emailVerifySentAt,
            verifiedAt,
          },
        };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '確認状態の取得に失敗しました' };
      }
    },
  );
}
