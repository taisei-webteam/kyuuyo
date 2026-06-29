/**
 * データバックアップ IPC ハンドラ
 */
import { ipcMain, app } from 'electron';
import { IPC } from '../../shared/ipc-channels.js';
import type { IpcResult, BackupInfo } from '../../shared/types.js';
import {
  runBackup,
  listBackups,
  openBackupDir,
  restoreBackup,
} from '../services/backup.service.js';

export function registerBackupHandlers(): void {
  ipcMain.handle(IPC.BACKUP.RUN, async (): Promise<IpcResult<BackupInfo>> => {
    try {
      return { success: true, data: await runBackup() };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'バックアップに失敗しました' };
    }
  });

  ipcMain.handle(IPC.BACKUP.LIST, async (): Promise<IpcResult<BackupInfo[]>> => {
    try {
      return { success: true, data: listBackups() };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'バックアップ一覧の取得に失敗しました' };
    }
  });

  ipcMain.handle(IPC.BACKUP.OPEN_DIR, async (): Promise<IpcResult<{ opened: boolean }>> => {
    try {
      await openBackupDir();
      return { success: true, data: { opened: true } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'フォルダを開けませんでした' };
    }
  });

  ipcMain.handle(
    IPC.BACKUP.RESTORE,
    async (_event, params: { fileName?: unknown }): Promise<IpcResult<{ restored: boolean }>> => {
      try {
        if (!params || typeof params.fileName !== 'string') {
          throw new Error('復元対象のファイル名が不正です');
        }
        await restoreBackup(params.fileName);
        // Renderer のメモリキャッシュを一新するため、応答を返した直後に再起動する
        setTimeout(() => {
          app.relaunch();
          app.exit(0);
        }, 400);
        return { success: true, data: { restored: true } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '復元に失敗しました' };
      }
    },
  );
}
