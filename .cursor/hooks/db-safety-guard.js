#!/usr/bin/env node

const chunks = [];
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    process.stdout.write(JSON.stringify({ permission: 'allow' }));
    process.exit(0);
  }

  const command = (input.command || '').toLowerCase();

  const dangerousPatterns = [
    /rm\s+.*\.db/,
    /rm\s+.*\.sqlite/,
    /del\s+.*\.db/,
    /del\s+.*\.sqlite/,
    /drop\s+table/i,
    /truncate\s+table/i,
    /delete\s+from\s+\w+\s*$/i,
  ];

  const isDangerous = dangerousPatterns.some((pattern) => pattern.test(command));

  if (isDangerous) {
    process.stdout.write(JSON.stringify({
      permission: 'deny',
      user_message: 'このコマンドはデータベースファイルまたはテーブルデータを破壊する可能性があります。実行をブロックしました。',
      agent_message: 'BLOCKED by db-safety-guard hook: This command could destroy database files or table data. Use Drizzle ORM migrations for schema changes instead.',
    }));
  } else {
    process.stdout.write(JSON.stringify({ permission: 'allow' }));
  }
  process.exit(0);
});
