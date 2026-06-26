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

        const base = sanitizeFileName(params?.fileName ?? 'payslip');

        // printToPDF は document.title を PDF の内部タイトル(/Title)として埋め込み、
        // 多くのビューアが保存ファイル名ではなくこのタイトルを既定名に使う。
        // 出力名と一致させるため、生成中だけページタイトルを差し替えて元に戻す。
        const originalTitle = win.webContents.getTitle();
        let pdfData: Buffer;
        try {
          await win.webContents.executeJavaScript(
            `document.title = ${JSON.stringify(base)};`,
          );
          pdfData = await win.webContents.printToPDF({
            pageSize: params?.pageSize ?? 'A4',
            landscape: params?.landscape ?? false,
            printBackground: true,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
          });
        } finally {
          await win.webContents.executeJavaScript(
            `document.title = ${JSON.stringify(originalTitle)};`,
          );
        }

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
}
