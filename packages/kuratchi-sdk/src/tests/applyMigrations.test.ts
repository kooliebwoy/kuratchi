import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KuratchiDatabase } from '../lib/database/index.js';

// Mock the migration loader to control journal + migrations content
vi.mock('../lib/orm/loader', () => {
  return {
    loadMigrations: vi.fn(async (_dirName: string) => {
      return {
        journal: {
          entries: [
            { idx: 0, tag: 'init' },
          ],
        },
        migrations: {
          m0000: async () => 'CREATE TABLE t1 (id INTEGER PRIMARY KEY AUTOINCREMENT);INSERT INTO t1 (id) VALUES (1);',
        },
      };
    }),
  };
});

// Build a minimal fake HTTP client matching the shape used by applyMigrations
function createFakeHttpClient(opts?: { alreadyApplied?: boolean }) {
  const calls: { exec: string[]; batch: any[]; query: string[] } = {
    exec: [],
    batch: [],
    query: [],
  };
  const http = {
    exec: vi.fn(async (sql: string) => {
      calls.exec.push(sql);
      return { success: true };
    }),
    query: vi.fn(async (sql: string) => {
      calls.query.push(sql);
      if (sql.startsWith('SELECT tag FROM migrations_history')) {
        if (opts?.alreadyApplied) {
          return { success: true, results: [{ tag: 'init' }] };
        }
        return { success: true, results: [] };
      }
      return { success: true, results: [] };
    }),
    batch: vi.fn(async (items: Array<{ query: string; params?: any[] }>) => {
      calls.batch.push(items);
      return { success: true };
    }),
  } as any;
  return { http, calls };
}

// Helper to get at the private method for testing
function getApplyMigrations(doSvc: KuratchiDatabase) {
  return (doSvc as any).applyMigrations.bind(doSvc) as (http: any, dirName: string) => Promise<void>;
}

describe('applyMigrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies new migrations and records history', async () => {
    const doSvc = new KuratchiDatabase({ workersSubdomain: 'x', scriptName: 'y', apiToken: 't', accountId: 'acc' } as any);
    const { http, calls } = createFakeHttpClient({ alreadyApplied: false });

    const apply = getApplyMigrations(doSvc);
    await apply(http, 'admin');

    // Ensured history table creation
    expect(calls.exec.some((q) => q.includes('CREATE TABLE IF NOT EXISTS migrations_history'))).toBe(true);

    // Selected existing tags
    expect(calls.query.some((q) => q.startsWith('SELECT tag FROM migrations_history'))).toBe(true);

    // Batch contains both migration statements plus insert into migrations_history
    expect(calls.batch.length).toBe(1);
    const batchItems = calls.batch[0] as Array<{ query: string; params?: any[] }>;
    expect(batchItems.some((i) => i.query.startsWith('CREATE TABLE t1'))).toBe(true);
    expect(batchItems.some((i) => i.query.startsWith('INSERT INTO t1'))).toBe(true);
    expect(batchItems.some((i) => i.query.startsWith('INSERT INTO migrations_history'))).toBe(true);
  });

  it('skips already-applied migrations based on history', async () => {
    const doSvc = new KuratchiDatabase({ workersSubdomain: 'x', scriptName: 'y', apiToken: 't', accountId: 'acc' } as any);
    const { http, calls } = createFakeHttpClient({ alreadyApplied: true });

    const apply = getApplyMigrations(doSvc);
    await apply(http, 'admin');

    // Should still ensure table and read history
    expect(calls.exec.length).toBe(1);
    expect(calls.query.length).toBeGreaterThan(0);

    // No batch executed if already applied
    expect(calls.batch.length).toBe(0);
  });
});
