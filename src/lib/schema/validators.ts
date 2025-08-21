// Lightweight schema contract validation for admin and organization databases
// Expects a D1 client that implements query(sql: string, params?: any[]): Promise<{ success: boolean; results: any[] }>
import type { QueryResult } from '../d1/internal-http-client.js';

export type D1LikeClient = {
  query: (sql: string, params?: any[]) => Promise<QueryResult<any>>
}

async function getColumns(client: D1LikeClient, table: string): Promise<Set<string>> {
  const res = await client.query(`PRAGMA table_info(${table})`);
  if (!res.success) return new Set();
  const cols = new Set<string>();
  for (const row of res.results as any[]) {
    // PRAGMA table_info returns { name: string, type: string, ... }
    if (row && typeof row.name === 'string') cols.add(row.name);
  }
  return cols;
}

async function tableExists(client: D1LikeClient, table: string): Promise<boolean> {
  const res = await client.query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
  return !!(res.success && res.results && res.results.length > 0);
}

function missingColumns(cols: Set<string>, required: string[]): string[] {
  return required.filter((c) => !cols.has(c));
}

export async function validateAdminSchema(client: D1LikeClient): Promise<void> {
  const requiredTables: Record<string, string[]> = {
    organizations: ['id', 'organizationSlug'],
    organizationUsers: ['id', 'email', 'organizationId'],
    users: ['id', 'email'],
    session: ['sessionToken', 'userId', 'expires'],
    databases: ['id', 'organizationId'],
    dbApiTokens: ['id', 'token', 'databaseId'],
    activity: ['id', 'action']
  };
  const missing: { table: string; columns?: string[] }[] = [];

  for (const [table, cols] of Object.entries(requiredTables)) {
    const exists = await tableExists(client, table);
    if (!exists) {
      missing.push({ table });
      continue;
    }
    const present = await getColumns(client, table);
    const missCols = missingColumns(present, cols);
    if (missCols.length) missing.push({ table, columns: missCols });
  }

  if (missing.length) {
    const details = missing.map(m => `- ${m.table}${m.columns ? ` (missing cols: ${m.columns.join(', ')})` : ''}`).join('\n');
    throw new Error(`Admin DB schema validation failed. Missing requirements:\n${details}`);
  }
}

export async function validateOrganizationSchema(client: D1LikeClient): Promise<void> {
  const requiredTables: Record<string, string[]> = {
    users: ['id', 'email', 'password_hash'],
    session: ['sessionToken', 'userId', 'expires'],
    passwordResetTokens: ['id', 'token', 'email', 'expires'],
    emailVerificationToken: ['id', 'token', 'email', 'userId', 'expires'],
    activity: ['id', 'action']
  };
  const missing: { table: string; columns?: string[] }[] = [];

  for (const [table, cols] of Object.entries(requiredTables)) {
    const exists = await tableExists(client, table);
    if (!exists) {
      missing.push({ table });
      continue;
    }
    const present = await getColumns(client, table);
    const missCols = missingColumns(present, cols);
    if (missCols.length) missing.push({ table, columns: missCols });
  }

  if (missing.length) {
    const details = missing.map(m => `- ${m.table}${m.columns ? ` (missing cols: ${m.columns.join(', ')})` : ''}`).join('\n');
    throw new Error(`Organization DB schema validation failed. Missing requirements:\n${details}`);
  }
}
