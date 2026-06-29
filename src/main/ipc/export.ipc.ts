/**
 * PDF出力 IPC ハンドラ
 *
 * 現在表示中のウィンドウを printToPDF でPDF化し、一時ファイルへ保存して
 * 既定のPDFビューアで開く。Electron 標準印刷ダイアログのプレビュー非対応を
 * 回避し、確実なプレビュー＋印刷を提供する。
 */
import { ipcMain, BrowserWindow, shell, app } from 'electron';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { IPC } from '../../shared/ipc-channels.js';
import type { IpcResult } from '../../shared/types.js';

function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

/**
 * 現在表示中ウィンドウの内容を printToPDF でPDF化し Buffer を返す。
 * document.title を一時的に出力名へ差し替える点は EXPORT.PDF と同じ。
 */
async function renderWindowToPdf(
  event: Electron.IpcMainInvokeEvent,
  params: { fileName?: string; pageSize?: 'A4' | 'A3'; landscape?: boolean },
): Promise<Buffer> {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    throw new Error('対象ウィンドウが見つかりません');
  }
  const base = sanitizeFileName(params?.fileName ?? 'payslip');
  const originalTitle = win.webContents.getTitle();
  try {
    await win.webContents.executeJavaScript(`document.title = ${JSON.stringify(base)};`);
    return await win.webContents.printToPDF({
      pageSize: params?.pageSize ?? 'A4',
      landscape: params?.landscape ?? false,
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
  } finally {
    await win.webContents.executeJavaScript(`document.title = ${JSON.stringify(originalTitle)};`);
  }
}

export function registerExportHandlers(): void {
  ipcMain.handle(
    IPC.EXPORT.PDF,
    async (
      event,
      params: { fileName?: string; pageSize?: 'A4' | 'A3'; landscape?: boolean },
    ): Promise<IpcResult<{ path: string }>> => {
      try {
        const base = sanitizeFileName(params?.fileName ?? 'payslip');
        const pdfData = await renderWindowToPdf(event, params);

        // 同名PDFがビューアで開かれているとファイルがロックされ EBUSY になるため、
        // 出力ごとにユニークなサブフォルダへ書き出す（ファイル名は分かりやすいまま維持）。
        const outDir = path.join(app.getPath('temp'), 'rakuraku-pdf', String(Date.now()));
        await mkdir(outDir, { recursive: true });
        const filePath = path.join(outDir, `${base}.pdf`);
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

  // メール添付用：ファイル保存せず PDF を base64 で返す
  ipcMain.handle(
    IPC.EXPORT.PDF_BUFFER,
    async (
      event,
      params: { fileName?: string; pageSize?: 'A4' | 'A3'; landscape?: boolean },
    ): Promise<IpcResult<{ base64: string }>> => {
      try {
        const pdfData = await renderWindowToPdf(event, params);
        return { success: true, data: { base64: pdfData.toString('base64') } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'PDF生成に失敗しました' };
      }
    },
  );
}
