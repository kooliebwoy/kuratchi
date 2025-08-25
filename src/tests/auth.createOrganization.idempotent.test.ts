import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KuratchiAuth } from '../lib/auth/kuratchi-auth.js';

// Minimal in-memory admin table stubs
function makeAdminStub() {
  const organizations: any[] = [];
  const databases: any[] = [];
  const dbApiTokens: any[] = [];

  const tables = {
    organizations: {
      insert: vi.fn(async (row: any) => {
        const id = row.id || crypto.randomUUID();
        const r = { ...row, id };
        organizations.push(r);
        return { data: r } as any;
      }),
    },
    databases: {
      insert: vi.fn(async (row: any) => {
        const id = row.id || crypto.randomUUID();
        const r = { ...row, id };
        databases.push(r);
        return { data: r } as any;
      }),
      where: vi.fn((w: any) => ({
        orderBy: (_o: any) => ({
          first: async () => {
            const found = databases.find(d => (!w?.id || d.id === w.id) && (!w?.name || d.name === w.name) && !d.deleted_at);
            return { data: found || null } as any;
          }
        }),
        first: async () => {
          const found = databases.find(d => (!w?.id || d.id === w.id) && (!w?.name || d.name === w.name) && !d.deleted_at);
          return { data: found || null } as any;
        }
      })),
      update: vi.fn(async (_where: any, patch: any) => {
        const idx = databases.findIndex(d => d.id === _where.id);
        if (idx >= 0) databases[idx] = { ...databases[idx], ...patch };
        return { data: databases[idx] } as any;
      })
    },
    dbApiTokens: {
      where: vi.fn((_w: any) => ({
        orderBy: (_o: any) => ({
          many: async () => {
            // Return existing tokens (simulate already persisted token for this DB)
            return { data: dbApiTokens.slice() } as any;
          }
        })
      })),
      insert: vi.fn(async (row: any) => {
        const r = { ...row };
        dbApiTokens.push(r);
        return { data: r } as any;
      })
    }
  } as any;

  return { tables, organizations, databases, dbApiTokens };
}

describe('KuratchiAuth.createOrganization idempotent token reuse', () => {
  let auth: KuratchiAuth;
  let adminStub: ReturnType<typeof makeAdminStub>;

  beforeEach(() => {
    adminStub = makeAdminStub();
    // Construct with a dummy adminDb (only to pass constructor check)
    auth = new KuratchiAuth({
      apiToken: 'cf_test',
      accountId: 'acc_test',
      workersSubdomain: 'example-subdomain',
      gatewayKey: 'test_gateway_key',
      resendApiKey: '',
      emailFrom: 'noreply@example.com',
      origin: 'https://example.com',
      authSecret: 'test_secret',
      adminDb: { query: async () => ({ results: [] }) }
    } as any);
    // Override internal adminDb with our table stubs
    (auth as any).adminDb = adminStub.tables;

    // Spy on provisioning paths; ensure not called
    vi.spyOn((auth as any).kuratchiD1, 'createDatabase').mockResolvedValue({ database: { name: 'db-x', uuid: 'uuid-x' }, apiToken: 'new-token' });
    vi.spyOn((auth as any).kuratchiDO, 'createDatabase').mockResolvedValue({ databaseName: 'db-x', token: 'new-token' });
  });

  it('reuses existing dbApiTokens for DO-backed DB (do: true) and does not call provisioners', async () => {
    // 1) Pre-create organization
    const orgId = crypto.randomUUID();
    await (adminStub.tables.organizations.insert as any)({ id: orgId, organizationName: 'Beta' });

    // 2) Pre-create DO-style database row (no dbuuid)
    const dbId = crypto.randomUUID();
    const dbName = 'beta-db';
    await (adminStub.tables.databases.insert as any)({ id: dbId, name: dbName, organizationId: orgId, dbuuid: null });

    // 3) Pre-create a valid token for that database
    const existingToken = { id: crypto.randomUUID(), token: 'existing-do-token', name: 'primary', databaseId: dbId, revoked: false };
    adminStub.dbApiTokens.push(existingToken);

    // 4) Call createOrganization with same name; expect reuse and no provisioning
    const res: any = await (auth as any).createOrganization({ organizationName: 'Beta' }, { do: true });

    // Minimal return shape
    expect(res && res.success).toBe(true);

    // No new token inserted
    expect((adminStub.tables.dbApiTokens.insert as any)).not.toHaveBeenCalled();

    // Provisioners not called
    expect((auth as any).kuratchiD1.createDatabase).not.toHaveBeenCalled();
    expect((auth as any).kuratchiDO.createDatabase).not.toHaveBeenCalled();

    // No database/organization returned in minimal shape
    expect((res as any).database).toBeUndefined();
    expect((res as any).organization).toBeUndefined();
  });

  it('reuses existing dbApiTokens and does not call provisioners', async () => {
    // 1) Pre-create organization
    const orgId = crypto.randomUUID();
    await (adminStub.tables.organizations.insert as any)({ id: orgId, organizationName: 'Acme' });

    // 2) Pre-create database row for org
    const dbId = crypto.randomUUID();
    const dbName = 'acme-db';
    await (adminStub.tables.databases.insert as any)({ id: dbId, name: dbName, organizationId: orgId, dbuuid: 'd1-uuid' });

    // 3) Pre-create a valid token for that database
    const existingToken = { id: crypto.randomUUID(), token: 'existing-token', name: 'primary', databaseId: dbId, revoked: false };
    adminStub.dbApiTokens.push(existingToken);

    // 4) Call createOrganization with same name; expect reuse
    const res: any = await (auth as any).createOrganization({ organizationName: 'Acme' }, { d1: true });

    // Minimal return shape
    expect(res && res.success).toBe(true);

    // No new token inserted
    expect((adminStub.tables.dbApiTokens.insert as any)).not.toHaveBeenCalled();

    // Provisioners not called
    expect((auth as any).kuratchiD1.createDatabase).not.toHaveBeenCalled();
    expect((auth as any).kuratchiDO.createDatabase).not.toHaveBeenCalled();

    // No database/organization returned in minimal shape
    expect((res as any).database).toBeUndefined();
    expect((res as any).organization).toBeUndefined();
  });
});
