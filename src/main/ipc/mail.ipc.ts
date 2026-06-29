/**
 * メール送信（Gmail API）IPC ハンドラ
 */
import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels.js';
import {
  getMailConfigStatus,
  setMailConfig,
  authorize,
  sendMail,
  sendTestMail,
} from '../services/mail.service.js';
import type {
  IpcResult,
  MailConfigStatus,
  MailConfigUpdate,
  MailMessageInput,
  MailSendResult,
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
}
