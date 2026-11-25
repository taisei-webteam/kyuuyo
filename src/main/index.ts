/**
 * Electron Main Process エントリポイント
 * らくらく給与明細α
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';

// AnyDesk などでウィンドウが隠れたと判定されると、入力欄に文字が入らなくなる。
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// stdout/stderr のパイプが閉じている際の EPIPE で落とさない（開発時にターミナル切断等で発生）
/** 前面のウィンドウへキーボードを戻す。blur は使わない。 */
function restoreWindowKeyboard(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  const stick = win.isAlwaysOnTop();
  if (process.platform === 'win32' && !stick) {
    win.setAlwaysOnTop(true);
    win.setAlwaysOnTop(false);
  }
  win.focus();
  win.webContents.focus();
}

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
      backgroundThrottling: false,
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

  const focusPage = (): void => {
    const win = mainWindow;
    if (!win || win.isDestroyed()) return;
    win.webContents.focus();
  };
  mainWindow.on('focus', focusPage);
  mainWindow.on('show', focusPage);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 起動に失敗したら、記録を残して画面で知らせてから終了する。
 * 黙って残ると単一起動ロックを握り続け、次に起動しても何も表示されない。
 */
function failStartup(err: unknown): void {
  console.error('[main] startup failed:', err);
  const summary = err instanceof Error ? err.message : String(err);
  const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);

  const logPath = path.join(app.getPath('userData'), 'startup-error.log');
  let logNote = `詳細は次のファイルに記録しました。\n${logPath}`;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(
      logPath,
      `[${new Date().toISOString()}] v${app.getVersion()}\n${detail}\n\n`,
      'utf8',
    );
  } catch {
    logNote = '詳細をファイルに記録できませんでした。';
  }

  dialog.showErrorBox(
    'らくらく給与明細α を起動できません',
    `起動中にエラーが発生したため、アプリを終了します。\n\n${summary}\n\n${logNote}\n\n解決しない場合は担当者へご連絡ください。`,
  );

  try {
    closeDb();
  } catch {
    // 終了を優先する
  }
  app.exit(1);
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
    // 確認ダイアログやファイル選択のあと、画面は前面でもキーがページに届かない。
    // blur すると別ウィンドウへキーボードが移るので、前面のまま付け直す。
    ipcMain.handle(IPC.APP.FOCUS_PAGE, () => {
      restoreWindowKeyboard(mainWindow);
    });

    // 起動時に1日1回の自動バックアップ（非同期・失敗は握りつぶす）
    void autoBackupDaily();

    createWindow();

    // 配布版のみ自動更新を確認（開発時は無効）
    // 更新確認の準備に失敗しても、画面は出ているので作業は続けられる。
    if (app.isPackaged && mainWindow) {
      try {
        setupAutoUpdater(mainWindow);
      } catch (err) {
        console.error('[updater] setup failed:', err);
      }
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  }).catch((err: unknown) => {
    failStartup(err);
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
