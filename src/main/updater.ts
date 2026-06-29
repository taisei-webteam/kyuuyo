/**
 * 自動更新 (electron-updater + GitHub Releases)
 *
 * アプリ起動時に最新バージョンを確認し、あればバックグラウンドでダウンロード。
 * ダウンロード完了後、次回終了時に自動インストールされる。
 * electron-updater は CommonJS のため default import 経由で named を取り出す。
 */
import electronUpdater from 'electron-updater';

const { autoUpdater } = electronUpdater;

export function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err);
  });
  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checking for update...');
  });
  autoUpdater.on('update-available', (info) => {
    console.log('[updater] update available:', info.version);
  });
  autoUpdater.on('update-not-available', () => {
    console.log('[updater] no update available');
  });
  autoUpdater.on('download-progress', (p) => {
    console.log(`[updater] downloading: ${Math.round(p.percent)}%`);
  });
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] downloaded:', info.version, '(次回起動時に適用)');
  });

  // 更新確認 + ダウンロード完了時にOS通知。失敗してもアプリ動作には影響させない。
  void autoUpdater.checkForUpdatesAndNotify();
}
