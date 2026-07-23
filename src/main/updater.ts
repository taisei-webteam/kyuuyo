/**
 * 自動更新 (electron-updater + GitHub Releases)
 *
 * アプリ起動時に最新バージョンを確認し、あればバックグラウンドでダウンロード。
 * ダウンロード完了後、次回終了時に自動インストールされる。
 * 進捗は IPC で Renderer に通知し、画面上に表示する（裏の処理を可視化）。
 * electron-updater は CommonJS のため default import 経由で named を取り出す。
 */
import { ipcMain, type BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import { IPC } from '../shared/ipc-channels.js';
import type { UpdaterEvent } from '../shared/types.js';

const { autoUpdater } = electronUpdater;

// 購読前に発生したイベントの取りこぼし対策として直近の状態を保持する。
let lastEvent: UpdaterEvent | null = null;

export function setupAutoUpdater(win: BrowserWindow): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const notify = (event: UpdaterEvent): void => {
    lastEvent = event;
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.UPDATER.EVENT, event);
    }
  };

  // Renderer が購読直後に現在状態を同期取得できるようにする
  ipcMain.handle(IPC.UPDATER.GET_STATE, () => lastEvent);

  // 今すぐ更新を適用して再起動
  ipcMain.handle(IPC.UPDATER.QUIT_AND_INSTALL, () => {
    // isSilent=false（インストーラ表示）, isForceRunAfter=true（更新後に再起動）
    autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err);
    notify({ status: 'error', message: err instanceof Error ? err.message : String(err) });
  });
  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checking for update...');
    notify({ status: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    console.log('[updater] update available:', info.version);
    notify({ status: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    console.log('[updater] no update available');
    notify({ status: 'not-available' });
  });
  autoUpdater.on('download-progress', (p) => {
    console.log(`[updater] downloading: ${Math.round(p.percent)}%`);
    notify({ status: 'progress', percent: Math.round(p.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] downloaded:', info.version, '(次回起動時に適用)');
    notify({ status: 'downloaded', version: info.version });
  });

  // 更新確認 + ダウンロード完了時にOS通知。失敗してもアプリ動作には影響させない。
  void autoUpdater.checkForUpdatesAndNotify();
}
