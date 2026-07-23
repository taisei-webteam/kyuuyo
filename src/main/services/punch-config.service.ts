/**
 * 打刻連携(Neon)接続設定サービス
 *
 * iPad 打刻データを取り込む Neon の DATABASE_URL を、端末ごとに GUI から設定できるようにする。
 * 認証情報を含む秘匿値のため、メール設定と同様に Electron safeStorage で暗号化し
 * userData 配下に保存する（インストーラーには同梱しない）。
 *
 * 取得の優先順位: 保存済み設定 > 環境変数(DATABASE_URL / NEON_DATABASE_URL)
 */
import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { PunchSyncConfigStatus, PunchSyncConfigUpdate } from '../../shared/types.js';

interface PunchConfigData {
  databaseUrl: string;
}

function configFilePath(): string {
  return path.join(app.getPath('userData'), 'punch-sync.enc');
}

function load(): PunchConfigData {
  try {
    const raw = readFileSync(configFilePath());
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(raw)
      : Buffer.from(raw.toString('utf8'), 'base64').toString('utf8');
    const parsed = JSON.parse(json) as Partial<PunchConfigData>;
    return { databaseUrl: (parsed.databaseUrl ?? '').trim() };
  } catch {
    return { databaseUrl: '' };
  }
}

function save(data: PunchConfigData): void {
  const dir = path.dirname(configFilePath());
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const json = JSON.stringify(data);
  const buf = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(Buffer.from(json, 'utf8').toString('base64'), 'utf8');
  writeFileSync(configFilePath(), buf);
}

/**
 * 接続文字列を正規化する。
 * 先頭に postgres:// / postgresql:// が無い場合は postgresql:// を補う
 * （Neon コンソール等からスキームを含めずに貼り付けても動くようにする）。
 */
function normalizeDatabaseUrl(url: string): string {
  const t = (url ?? '').trim();
  if (t.length === 0) return '';
  if (/^postgres(ql)?:\/\//i.test(t)) return t;
  return `postgresql://${t}`;
}

/** 環境変数側の接続文字列（開発版の .env 等）。 */
function envDatabaseUrl(): string {
  return normalizeDatabaseUrl(process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL ?? '');
}

/**
 * 保存済みの接続文字列を返す（無ければ null）。getNeonConfig から同期利用する。
 * 既に保存済みでスキームが欠けている値も読み込み時に正規化する。
 */
export function getStoredDatabaseUrl(): string | null {
  const url = normalizeDatabaseUrl(load().databaseUrl);
  return url.length > 0 ? url : null;
}

/**
 * 実効的に使用する接続文字列を返す（保存済み優先、無ければ環境変数）。
 */
export function getEffectiveDatabaseUrl(): string | null {
  const stored = getStoredDatabaseUrl();
  if (stored) return stored;
  const env = envDatabaseUrl();
  return env.length > 0 ? env : null;
}

/** 接続文字列の認証情報を伏せてマスク表示する。 */
function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, '');
    return `${u.protocol}//***@${u.host}${db ? `/${db}` : ''}`;
  } catch {
    return '設定済み';
  }
}

export function getPunchSyncConfigStatus(): PunchSyncConfigStatus {
  const stored = getStoredDatabaseUrl();
  const env = envDatabaseUrl();
  const effective = stored ?? (env.length > 0 ? env : null);
  return {
    configured: effective !== null,
    source: stored ? 'stored' : env.length > 0 ? 'env' : 'none',
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    maskedUrl: effective ? maskUrl(effective) : '',
  };
}

export function setPunchSyncConfig(update: PunchSyncConfigUpdate): PunchSyncConfigStatus {
  save({ databaseUrl: normalizeDatabaseUrl(update.databaseUrl ?? '') });
  return getPunchSyncConfigStatus();
}
