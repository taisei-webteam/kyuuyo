/**
 * データベースバックアップ サービス
 *
 * SQLite DB ファイル (rakuraku-kyuuyo.db) を userData/backups/ 配下へ世代保存する。
 * better-sqlite3 の online backup API (db.backup) を使用するため、WAL モードでも
 * 整合性の取れたスナップショットが得られる（ファイル単純コピーの破損リスクを回避）。
 */
import path from 'node:path';
import fs from 'node:fs';
import { app, shell } from 'electron';
import { getSqlite, getDbPath, closeDb, getDb } from '../db/connection.js';
import type { BackupInfo } from '../../shared/types.js';

/** 保持する世代数（これを超える古いバックアップは自動削除） */
const MAX_BACKUPS = 10;

const FILE_PREFIX = 'rakuraku-kyuuyo-';

/** バックアップ保存ディレクトリ（存在しなければ作成） */
export function getBackupDir(): string {
  const dir = path.join(app.getPath('userData'), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** YYYYMMDD-HHmmss 形式のタイムスタンプ（ローカル時刻） */
function timestamp(d: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

function toBackupInfo(fileName: string): BackupInfo {
  const full = path.join(getBackupDir(), fileName);
  const st = fs.statSync(full);
  return { fileName, path: full, size: st.size, createdAt: st.mtime.toISOString() };
}

/** バックアップ一覧（新しい順） */
export function listBackups(): BackupInfo[] {
  const dir = getBackupDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(FILE_PREFIX) && f.endsWith('.db'))
    .map(toBackupInfo)
    .sort((a, b) => b.fileName.localeCompare(a.fileName));
}

/** 世代数を超える古いバックアップを削除 */
function pruneBackups(): void {
  const backups = listBackups();
  for (const b of backups.slice(MAX_BACKUPS)) {
    try {
      fs.rmSync(b.path);
    } catch {
      // 削除失敗は致命的ではないため無視
    }
  }
}

/** 今すぐバックアップを作成して情報を返す */
export async function runBackup(): Promise<BackupInfo> {
  const fileName = `${FILE_PREFIX}${timestamp()}.db`;
  const dest = path.join(getBackupDir(), fileName);
  const raw = getSqlite();
  await raw.backup(dest);
  pruneBackups();
  return toBackupInfo(fileName);
}

/** 1日1回の自動バックアップ（同日分が無ければ作成）。失敗は握りつぶす */
export async function autoBackupDaily(): Promise<void> {
  try {
    const today = timestamp().slice(0, 8); // YYYYMMDD
    const exists = listBackups().some((b) =>
      b.fileName.startsWith(`${FILE_PREFIX}${today}-`),
    );
    if (exists) return;
    await runBackup();
  } catch (err) {
    console.error('[backup] auto backup failed:', err);
  }
}

/** バックアップフォルダを既定のファイラで開く */
export async function openBackupDir(): Promise<void> {
  const err = await shell.openPath(getBackupDir());
  if (err) throw new Error(err);
}

/**
 * 指定バックアップから DB を復元する。
 * - パストラバーサル防止のためファイル名のみ許可（basename 化）
 * - 復元前に現状を自動バックアップ（誤操作からの復帰用）
 * - DB 接続を閉じ、WAL/SHM を削除してからファイルを差し替え、再オープン
 * 呼び出し側で復元後にアプリ再起動を行うこと（Renderer のキャッシュ一新のため）。
 */
export async function restoreBackup(fileName: string): Promise<void> {
  const safe = path.basename(fileName);
  if (!safe.startsWith(FILE_PREFIX) || !safe.endsWith('.db')) {
    throw new Error('バックアップファイル名が不正です');
  }
  const src = path.join(getBackupDir(), safe);
  if (!fs.existsSync(src)) {
    throw new Error('指定されたバックアップが見つかりません');
  }

  // 復元前に現状を保全
  await runBackup();

  const dbPath = getDbPath();
  closeDb();

  // WAL/SHM が残っていると古い状態が復活し得るため削除してから差し替え
  for (const suffix of ['', '-wal', '-shm']) {
    const f = dbPath + suffix;
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  fs.copyFileSync(src, dbPath);

  // 再オープン（テーブル初期化・マイグレーションを通す）
  getDb();
}
