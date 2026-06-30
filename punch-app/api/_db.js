import { neon } from '@neondatabase/serverless';

let cachedSql = null;

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  cachedSql ??= neon(databaseUrl);
  return cachedSql;
}

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function sendError(res, status, message) {
  res.status(status).json({ error: message });
}
