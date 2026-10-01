/**
 * 自動更新 (electron-updater + GitHub Releases)
 *
 * 起動中も一定間隔で確認し、あれば裏でダウンロードする。作業は止めない。
 * 完了後は画面から再起動でき、終了時にも自動で適用する。
 * electron-updater は CommonJS のため default import 経由で named を取り出す。
 */
import { ipcMain, type BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import { IPC } from '../shared/ipc-channels.js';
import type { UpdaterEvent } from '../shared/types.js';

const { autoUpdater } = electronUpdater;

/** 起動したまま新しいリリースを拾う間隔 */
const CHECK_INTERVAL_MS = 2 * 60 * 1000;
/** 連続確認を避ける最短間隔 */
const MIN_CHECK_GAP_MS = 60 * 1000;

type UpdatePhase = 'idle' | 'checking' | 'downloading' | 'ready';

// 購読前に発生したイベントの取りこぼし対策として直近の状態を保持する。
let lastEvent: UpdaterEvent | null = null;
let phase: UpdatePhase = 'idle';
let lastCheckAt = 0;
/** 「今すぐ」を押したあと、ダウンロード完了で再起動する */
let installWhenReady = false;

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

  const installNow = (): void => {
    installWhenReady = true;
    if (phase === 'ready') {
      autoUpdater.quitAndInstall(true, true);
    }
  };

  // ダウンロード済みならすぐ再起動。未完了なら完了次第再起動する。
  ipcMain.handle(IPC.UPDATER.QUIT_AND_INSTALL, () => {
    installNow();
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err);
    if (phase !== 'ready') phase = 'idle';
    notify({ status: 'error', message: err instanceof Error ? err.message : String(err) });
  });
  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checking for update...');
    notify({ status: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    console.log('[updater] update available:', info.version);
    phase = 'downloading';
    notify({ status: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    console.log('[updater] no update available');
    phase = 'idle';
    notify({ status: 'not-available' });
  });
  autoUpdater.on('download-progress', (p) => {
    console.log(`[updater] downloading: ${Math.round(p.percent)}%`);
    notify({ status: 'progress', percent: Math.round(p.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] downloaded:', info.version);
    phase = 'ready';
    notify({ status: 'downloaded', version: info.version });
    if (installWhenReady) {
      autoUpdater.quitAndInstall(true, true);
    }
  });

  const check = (): void => {
    if (phase !== 'idle') return;
    const now = Date.now();
    if (now - lastCheckAt < MIN_CHECK_GAP_MS) return;
    lastCheckAt = now;
    phase = 'checking';
    void autoUpdater.checkForUpdates().catch((err: unknown) => {
      console.error('[updater] check failed:', err);
      if (phase === 'checking') phase = 'idle';
    });
  };

  check();
  const timer = setInterval(check, CHECK_INTERVAL_MS);
  win.on('focus', check);
  win.on('closed', () => clearInterval(timer));
}
