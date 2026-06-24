/**
 * PDF出力 IPC ハンドラ
 *
 * 現在表示中のウィンドウを printToPDF でPDF化し、一時ファイルへ保存して
 * 既定のPDFビューアで開く。Electron 標準印刷ダイアログのプレビュー非対応を
 * 回避し、確実なプレビュー＋印刷を提供する。
 */
import { ipcMain, BrowserWindow, shell, app } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IPC } from '../../shared/ipc-channels.js';
import type { IpcResult } from '../../shared/types.js';

function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

export function registerExportHandlers(): void {
  ipcMain.handle(
    IPC.EXPORT.PDF,
    async (
      event,
      params: { fileName?: string; pageSize?: 'A4' | 'A3'; landscape?: boolean },
    ): Promise<IpcResult<{ path: string }>> => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) {
          return { success: false, error: '対象ウィンドウが見つかりません' };
        }

        const pdfData = await win.webContents.printToPDF({
          pageSize: params?.pageSize ?? 'A4',
          landscape: params?.landscape ?? false,
          printBackground: true,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });

        const base = sanitizeFileName(params?.fileName ?? 'payslip');
        const filePath = path.join(app.getPath('temp'), `${base}_${Date.now()}.pdf`);
        await writeFile(filePath, pdfData);

        const openError = await shell.openPath(filePath);
        if (openError) {
          return { success: false, error: `PDFを開けませんでした: ${openError}` };
        }

        return { success: true, data: { path: filePath } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'PDF出力に失敗しました' };
      }
    },
  );
}
