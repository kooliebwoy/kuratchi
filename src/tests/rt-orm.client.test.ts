import { describe, it, expect, vi } from 'vitest';
import { KuratchiD1 } from '../lib/d1/kuratchi-d1.js';
import adminJson from '../lib/schema-json/admin.json';
import orgJson from '../lib/schema-json/organization.json';

function setupD1() {
  const d1 = new KuratchiD1({ apiToken: 't', accountId: 'acc', workersSubdomain: 'workers.dev' });
  const captured: { sql: string; params?: any[] }[] = [];
  const mockClient = {
    query: vi.fn(async (sql: string, params?: any[]) => {
      captured.push({ sql, params });
      return { success: true, results: [] } as any;
    }),
  };
  vi.spyOn(d1 as any, 'getClient').mockReturnValue(mockClient as any);
  return { d1, mockClient, captured };
}

const cfg = { databaseName: 'dbx', apiToken: 'abc' };

describe('KuratchiD1 top-level sugar client', () => {
  it('JSON schema client compiles SELECT with where/order/limit/offset', async () => {
    const { d1, mockClient, captured } = setupD1();
    const schema = { tables: [{ name: 'users' }] } as any;
    const c = d1.client(cfg, { schema });
    await c.users.findMany({
      where: { email: { like: '%@acme.com' }, status: { in: [1, 2] } },
      select: ['id', 'email'],
      orderBy: [{ id: 'desc' }],
      limit: 10,
      offset: 20,
    });
    expect(mockClient.query).toHaveBeenCalledTimes(1);
    const { sql, params } = captured[0];
    expect(sql).toBe('SELECT id, email FROM users WHERE (email LIKE ?) AND (status IN (?, ?)) ORDER BY id DESC LIMIT 10 OFFSET 20');
    expect(params).toEqual(['%@acme.com', 1, 2]);
  });

  it('JSON schema client (admin schema) maps properties to correct tables and compiles INSERT/UPDATE/DELETE/COUNT', async () => {
    const { d1, mockClient, captured } = setupD1();
    const admin = d1.client(cfg, { schema: adminJson as any });

    await admin.users.insert({ id: 'u1', email: 'a@acme.com' });
    await admin.dbApiTokens.update({ id: 'tok1' }, { revoked: 1 });
    await admin.session.delete({ sessionToken: 'deadbeef' });
    await admin.users.count({ email: { like: 'a@%' } });

    expect(mockClient.query).toHaveBeenCalledTimes(4);
    expect(captured[0]).toEqual({
      sql: 'INSERT INTO users (id, email) VALUES (?, ?)',
      params: ['u1', 'a@acme.com'],
    });
    expect(captured[1]).toEqual({
      sql: 'UPDATE dbApiTokens SET revoked = ? WHERE id = ?',
      params: [1, 'tok1'],
    });
    expect(captured[2]).toEqual({
      sql: 'DELETE FROM session WHERE sessionToken = ?',
      params: ['deadbeef'],
    });
    expect(captured[3]).toEqual({
      sql: 'SELECT COUNT(*) as count FROM users WHERE email LIKE ?',
      params: ['a@%'],
    });
  });

  it('JSON schema client (organization schema) maps roles and compiles COUNT with LIKE', async () => {
    const { d1, mockClient, captured } = setupD1();
    const org = d1.client(cfg, { schema: orgJson as any });
    await org.roles.count({ name: { like: 'admin%' } } as any);
    expect(mockClient.query).toHaveBeenCalledTimes(1);
    expect(captured[0]).toEqual({
      sql: 'SELECT COUNT(*) as count FROM roles WHERE name LIKE ?',
      params: ['admin%'],
    });
  });

  it('custom JSON schema client exposes tables and compiles DELETE', async () => {
    const { d1, mockClient, captured } = setupD1();
    const schema = { tables: [{ name: 'widgets' }] } as any;
    const custom = d1.client(cfg, { schema });
    await (custom as any).widgets.delete({ id: 'w1' });
    expect(mockClient.query).toHaveBeenCalledTimes(1);
    expect(captured[0]).toEqual({ sql: 'DELETE FROM widgets WHERE id = ?', params: ['w1'] });
  });
});

describe('KuratchiD1 database().client', () => {
  it('db.client({ schema }) findFirst returns first row data and compiles LIMIT 1', async () => {
    const { d1, mockClient, captured } = setupD1();
    // Return a single row for this first call
    (mockClient.query as any).mockImplementationOnce(async (sql: string, params?: any[]) => {
      captured.push({ sql, params });
      return { success: true, results: [{ id: 'u1' }] } as any;
    });
    const db = d1.database(cfg);
    const schema = { tables: [{ name: 'users' }] } as any;
    const dyn = db.client({ schema });
    const res = await (dyn as any).users.findFirst({ where: { id: 'u1' }, select: ['id'] });
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ id: 'u1' });
    expect(captured[0]).toEqual({ sql: 'SELECT id FROM users WHERE id = ? LIMIT 1', params: ['u1'] });
  });

  it('db.client({ schema }) exposes schema tables', async () => {
    const { d1, mockClient, captured } = setupD1();
    const db = d1.database(cfg);
    const schema = { tables: [{ name: 'gadgets' }] } as any;
    const c = db.client({ schema });
    await (c as any).gadgets.update({ id: 'g1' }, { name: 'G' });
    expect(mockClient.query).toHaveBeenCalledTimes(1);
    expect(captured[0]).toEqual({ sql: 'UPDATE gadgets SET name = ? WHERE id = ?', params: ['G', 'g1'] });
  });
});
