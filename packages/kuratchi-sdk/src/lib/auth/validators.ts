// Lightweight schema contract validation for admin and organization databases
// Expects a D1 client that implements query(sql: string, params?: any[]): Promise<{ success: boolean; results: any[] }>
import type { QueryResult } from '../database/kuratchi-database.js';

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
    activity: ['id', 'action'],
    // DO-only: no KV/R2/Queues tracking required
  };

  for (const [table, requiredCols] of Object.entries(requiredTables)) {
    const exists = await tableExists(client, table);
    if (!exists) throw new Error(`Missing required admin table: ${table}`);
    const cols = await getColumns(client, table);
    const missing = missingColumns(cols, requiredCols);
    if (missing.length) throw new Error(`Table ${table} missing columns: ${missing.join(', ')}`);
  }
}

export async function validateOrganizationSchema(client: D1LikeClient): Promise<void> {
  const requiredTables: Record<string, string[]> = {
    users: ['id', 'email'],
    session: ['sessionToken', 'userId', 'expires'],
    roles: ['id', 'name'],
    activity: ['id', 'action'],
    oauthAccounts: ['id', 'provider', 'providerAccountId', 'userId'],
    passwordResetTokens: ['id', 'userId'],
    emailVerificationToken: ['id', 'identifier', 'token', 'expires'],
    magicLinkTokens: ['id', 'userId', 'token', 'expires'],
  };

  for (const [table, requiredCols] of Object.entries(requiredTables)) {
    const exists = await tableExists(client, table);
    if (!exists) throw new Error(`Missing required organization table: ${table}`);
    const cols = await getColumns(client, table);
    const missing = missingColumns(cols, requiredCols);
    if (missing.length) throw new Error(`Table ${table} missing columns: ${missing.join(', ')}`);
  }
}
