import { describe, it, expect } from 'vitest';
import { createRuntimeOrm } from '../lib/orm/kuratchi-orm.js';

function mkExec(calls: { sql: string; params?: any[] }[], responders: Array<(sql: string, params?: any[]) => any> = []) {
  let idx = 0;
  return async (sql: string, params?: any[]) => {
    calls.push({ sql, params });
    const r = responders[idx] || (() => ({ success: true, results: [] }));
    idx++;
    const out = r(sql, params);
    return out && typeof out.then === 'function' ? out : Promise.resolve(out);
  };
}

describe('Runtime ORM chainable query builder', () => {
  it('where/orWhere/orderBy/limit compiles SQL and params correctly', async () => {
    const calls: { sql: string; params?: any[] }[] = [];
    const exec = mkExec(calls);
    const orm = createRuntimeOrm(exec as any);

    await orm
      .table('users')
      .where({ email: '%@acme.com' }) // wildcard -> LIKE
      .orWhere({ status: { in: [1, 2] } })
      .orderBy({ id: 'desc' })
      .limit(10)
      .findMany();

    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual({
      sql: 'SELECT * FROM users WHERE (email LIKE ?) OR (status IN (?, ?)) ORDER BY id DESC LIMIT 10',
      params: ['%@acme.com', 1, 2],
    });
  });

  it('supports LIMIT with OFFSET for pagination', async () => {
    const calls: { sql: string; params?: any[] }[] = [];
    const exec = mkExec(calls);
    const orm = createRuntimeOrm(exec as any);

    await orm
      .table('users')
      .orderBy({ id: 'desc' })
      .limit(5)
      .offset(3)
      .findMany();

    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual({
      sql: 'SELECT * FROM users ORDER BY id DESC LIMIT 5 OFFSET 10',
      params: [],
    });
  });

  it('treats offset(n) as raw row offset when no limit is set', async () => {
    const calls: { sql: string; params?: any[] }[] = [];
    const exec = mkExec(calls);
    const orm = createRuntimeOrm(exec as any);

    await orm
      .table('users')
      .offset(10)
      .findMany();

    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual({
      sql: 'SELECT * FROM users OFFSET 10',
      params: [],
    });
  });

  it('simple filter findFirst infers LIKE and LIMIT 1', async () => {
    const calls: { sql: string; params?: any[] }[] = [];
    const exec = mkExec(calls);
    const orm = createRuntimeOrm(exec as any);

    const res = await orm.table('users').findFirst({ email: 'a@%' } as any);
    expect(res.success).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual({
      sql: 'SELECT * FROM users WHERE (email LIKE ?) LIMIT 1',
      params: ['a@%'],
    });
  });

  it('include() parent attaches object via <key>Id (users on orders)', async () => {
    const calls: { sql: string; params?: any[] }[] = [];
    const exec = mkExec(calls, [
      // Base query -> return orders with userId
      () => ({ success: true, results: [
        { id: 'o1', userId: 'u1' },
        { id: 'o2', userId: 'u2' },
      ] }),
      // Include query -> return users by id
      () => ({ success: true, results: [
        { id: 'u1', name: 'Alice' },
        { id: 'u2', name: 'Bob' },
      ] }),
    ]);
    const orm = createRuntimeOrm(exec as any);

    const res = await orm.table('orders').include({ users: true }).findMany();
    expect(res.success).toBe(true);

    expect(calls[0]).toEqual({ sql: 'SELECT * FROM orders', params: [] });
    expect(calls[1]).toEqual({ sql: 'SELECT * FROM users WHERE id IN (?, ?)', params: ['u1', 'u2'] });

    const rows = (res.data as any[]) || [];
    expect(rows[0].users).toEqual({ id: 'u1', name: 'Alice' });
    expect(rows[1].users).toEqual({ id: 'u2', name: 'Bob' });
  });

  it('include() child attaches arrays via <singular(main)>Id (sessions on users)', async () => {
    const calls: { sql: string; params?: any[] }[] = [];
    const exec = mkExec(calls, [
      // Base query -> users
      () => ({ success: true, results: [
        { id: 'u1' },
        { id: 'u2' },
      ] }),
      // Include query -> sessions with userId
      () => ({ success: true, results: [
        { id: 's1', userId: 'u1' },
        { id: 's2', userId: 'u1' },
        { id: 's3', userId: 'u2' },
      ] }),
    ]);
    const orm = createRuntimeOrm(exec as any);

    const res = await orm.table('users').include({ sessions: true }).findMany();
    expect(res.success).toBe(true);

    expect(calls[0]).toEqual({ sql: 'SELECT * FROM users', params: [] });
    expect(calls[1]).toEqual({ sql: 'SELECT * FROM sessions WHERE userId IN (?, ?)', params: ['u1', 'u2'] });

    const rows = (res.data as any[]) || [];
    expect(rows[0].sessions).toEqual([
      { id: 's1', userId: 'u1' },
      { id: 's2', userId: 'u1' },
    ]);
    expect(rows[1].sessions).toEqual([
      { id: 's3', userId: 'u2' },
    ]);
  });
});
