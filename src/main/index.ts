/**
 * Electron Main Process エントリポイント
 * らくらく給与明細α
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { app, BrowserWindow } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../.env') });
import { getDb, closeDb } from './db/connection.js';
import { registerEmployeeHandlers } from './ipc/employee.ipc.js';
import { registerPayslipHandlers } from './ipc/payslip.ipc.js';
import { registerCompanyHandlers } from './ipc/company.ipc.js';
import { registerAttendanceHandlers } from './ipc/attendance.ipc.js';
import { registerExportHandlers } from './ipc/export.ipc.js';

let mainWindow: BrowserWindow | null = null;

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
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  getDb();

  registerEmployeeHandlers();
  registerPayslipHandlers();
  registerCompanyHandlers();
  registerAttendanceHandlers();
  registerExportHandlers();

  createWindow();

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
