/**
 * Electron Main Process エントリポイント
 * らくらく給与明細α
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { app, BrowserWindow, ipcMain } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// stdout/stderr のパイプが閉じている際の EPIPE で落とさない（開発時にターミナル切断等で発生）
function ignoreEpipe(stream: NodeJS.WriteStream): void {
  stream.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE') return;
    throw err;
  });
}
ignoreEpipe(process.stdout);
ignoreEpipe(process.stderr);

// メインプロセスの未補足例外でアプリを即時終了させない（EPIPE 等の無害な例外を握りつぶす）
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') return;
  console.error('[main] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason);
});

// 環境変数の読み込み:
// - 開発版: プロジェクトルートの .env
// - 配布版: .env は同梱しないため、userData 配下の .env を読む
//   (例: %APPDATA%\rakuraku-kyuuyo-alpha\.env に DATABASE_URL を記載)
const envPath = app.isPackaged
  ? path.join(app.getPath('userData'), '.env')
  : path.resolve(__dirname, '../../../.env');
loadEnv({ path: envPath });
import { getDb, closeDb } from './db/connection.js';
import { registerEmployeeHandlers } from './ipc/employee.ipc.js';
import { registerPayslipHandlers } from './ipc/payslip.ipc.js';
import { registerCompanyHandlers } from './ipc/company.ipc.js';
import { registerAttendanceHandlers } from './ipc/attendance.ipc.js';
import { registerExportHandlers } from './ipc/export.ipc.js';
import { registerMailHandlers } from './ipc/mail.ipc.js';
import { registerBackupHandlers } from './ipc/backup.ipc.js';
import { registerInsuranceRateHandlers } from './ipc/insurance-rates.ipc.js';
import { autoBackupDaily } from './services/backup.service.js';
import { setupAutoUpdater } from './updater.js';
import { IPC } from '../shared/ipc-channels.js';

let mainWindow: BrowserWindow | null = null;

/** 開発時: Vite が立つまで待ってから画面を読む（未起動だと真っ白になる） */
async function waitForRenderer(url: string, timeoutMs = 30000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch {
      // Vite 未起動
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    title: 'らくらく給与明細α',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, '../../preload.cjs'),
    },
  });

  if (!app.isPackaged) {
    const rendererUrl = 'http://localhost:5173';
    void waitForRenderer(rendererUrl).then((ok) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (!ok) {
        console.error(
          '[main] Vite (http://localhost:5173) に接続できません。別ターミナルで npm run dev:renderer を先に起動してください。',
        );
      }
      void mainWindow.loadURL(rendererUrl);
    });
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 多重起動防止（本番で同一アプリの2重起動を抑止し、DB同時アクセスを防ぐ）
// 開発版は配布版と userData/単一起動ロックを分離する。
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'rakuraku-kyuuyo-alpha-dev'));
}
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    getDb();

    registerEmployeeHandlers();
    registerPayslipHandlers();
    registerCompanyHandlers();
    registerAttendanceHandlers();
    registerExportHandlers();
    registerMailHandlers();
    registerBackupHandlers();
    registerInsuranceRateHandlers();

    // アプリの現在バージョン（画面表示用）
    ipcMain.handle(IPC.APP.GET_VERSION, () => app.getVersion());

    // 起動時に1日1回の自動バックアップ（非同期・失敗は握りつぶす）
    void autoBackupDaily();

    createWindow();

    // 配布版のみ自動更新を確認（開発時は無効）
    if (app.isPackaged && mainWindow) {
      setupAutoUpdater(mainWindow);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    closeDb();
  });
}
