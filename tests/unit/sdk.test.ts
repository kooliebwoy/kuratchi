import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted storage to be available inside the mock factory
const hoisted = vi.hoisted(() => ({ instances: [] as any[] }));

// Mock the internal HTTP client class used by SDK BEFORE importing SDK
vi.mock('../../src/lib/sdk.js', () => {
  const instances = hoisted.instances;
  const MockInternalKuratchi = class {
    cfg: any;
    bookmark?: string;
    query = vi.fn(async (_sql?: string, _params?: any[]) => ({ ok: true }));
    queryWithToken = vi.fn(async (_token: string, _sql: string, _params?: any[]) => ({ ok: true }));
    getDrizzleProxy = vi.fn(() => vi.fn(async (_sql: string, _params: any[], _method: string) => ({ rows: [] })));
    migrate = vi.fn(async (_bundle: any) => true);
    setSessionBookmark = vi.fn((b?: string) => { this.bookmark = b; });
    constructor(cfg: any) { this.cfg = cfg; instances.push(this); }
  } as any;
  return { Kuratchi: MockInternalKuratchi, __instances: instances };
});

import { Kuratchi } from '../../src/lib/index.js';

// Minimal fake MigrationLoader
const loader = {
  async loadJournal(_dir: string) {
    return { entries: [ { idx: 1, tag: '001_init' }, { idx: 2, tag: '002_add_users' } ] };
  },
  async loadSql(_dir: string, tag: string) {
    return `-- SQL for ${tag}`;
  }
};

describe('Kuratchi SDK (stateless)', () => {
  const apiToken = 'test-token';
  const accountId = 'acct_123';
  const workersSubdomain = 'acct.workers.dev';
  let sdk: Kuratchi;

  beforeEach(() => {
    hoisted.instances.length = 0;
    vi.restoreAllMocks();
    sdk = new Kuratchi({ apiToken, accountId, workersSubdomain });
  });

  it('getClient returns an internal client with provided cfg', () => {
    const client = sdk.getClient({ databaseName: 'db1', apiToken: 'worker-token' });
    expect(hoisted.instances).toHaveLength(1);
    expect(hoisted.instances[0].cfg).toEqual({ databaseName: 'db1', workersSubdomain, apiToken: 'worker-token' });
    expect(typeof (client as any).getDrizzleProxy).toBe('function');
  });

  it('getDrizzleClient returns a drizzle adapter function for the given db', async () => {
    const adapter = sdk.getDrizzleClient({ databaseName: 'db2', apiToken });
    expect(typeof adapter).toBe('function');
    const res = await adapter('SELECT 1', [], 'all');
    expect(res).toEqual({ rows: [] });
  });

  it('db().query constructs a fresh client and runs the query', async () => {
    const res = await sdk.db({ databaseName: 'db3', apiToken }).query<{ one: number }>('SELECT 1 as one');
    expect(hoisted.instances).toHaveLength(1);
    const inst = hoisted.instances[0];
    expect(inst.query).toHaveBeenCalledWith('SELECT 1 as one', []);
    expect(res).toEqual({ ok: true });
  });

  it('db({ bookmark }) seeds read-replication session via bookmark header', async () => {
    const res = await sdk.db({ databaseName: 'db4', apiToken, bookmark: 'bm-123' }).query('SELECT 1');
    const inst = hoisted.instances[0];
    expect(inst.setSessionBookmark).toHaveBeenCalledWith('bm-123');
    expect(inst.bookmark).toBe('bm-123');
    expect(inst.query).toHaveBeenCalledWith('SELECT 1', []);
    expect(res).toEqual({ ok: true });
  });

  it('migrateWithLoader builds bundle and calls internal migrate', async () => {
    const ok = await sdk.migrateWithLoader({ databaseName: 'db5', apiToken }, 'site', loader as any);
    const inst = hoisted.instances[0];
    expect(inst.migrate).toHaveBeenCalledTimes(1);
    const callArg = (inst.migrate as any).mock.calls[0][0];
    expect(Array.isArray(callArg.journal.entries)).toBe(true);
    expect(typeof callArg.migrations.m0001).toBe('function');
    expect(await callArg.migrations.m0002()).toContain('002_add_users');
    expect(ok).toBe(true);
  });
});
