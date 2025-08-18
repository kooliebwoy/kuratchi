import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { KuratchiD1 } from '../lib/d1/index.js';
import { adminSchema as schema } from '../lib/auth/adminSchema.js';
import { drizzle as createDrizzle } from 'drizzle-orm/sqlite-proxy';

// Use SvelteKit static env so it resolves under Vitest + Vite
const env = await import('$env/static/private');

// Load env
const CF_API_TOKEN = (env as any).CLOUDFLARE_API_TOKEN || (env as any).CF_API_TOKEN || '';
const CF_ACCOUNT_ID = (env as any).CLOUDFLARE_ACCOUNT_ID || (env as any).CF_ACCOUNT_ID || '';
const WORKERS_SUBDOMAIN = (env as any).CLOUDFLARE_WORKERS_SUBDOMAIN || '';

const missing = [
  ['CLOUDFLARE_API_TOKEN', CF_API_TOKEN],
  ['CLOUDFLARE_ACCOUNT_ID', CF_ACCOUNT_ID],
  ['CLOUDFLARE_WORKERS_SUBDOMAIN', WORKERS_SUBDOMAIN],
]
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  // eslint-disable-next-line no-console
  console.warn('[admin.d1.e2e] Skipping E2E: missing env ->', missing.join(', '));
}

const shouldRun = !!(CF_API_TOKEN && CF_ACCOUNT_ID && WORKERS_SUBDOMAIN);
const describeMaybe = shouldRun ? describe : describe.skip;
const makeDbName = () => `kuratchi_admin_e2e_${Date.now()}_${Math.floor(Math.random()*1e6)}`;

// Minimal admin schema migrations
const MIGRATIONS_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT,
    firstName TEXT,
    lastName TEXT,
    phone TEXT,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER,
    image TEXT,
    status INTEGER,
    role TEXT,
    password_hash TEXT,
    accessAttempts INTEGER,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY NOT NULL,
    organizationName TEXT,
    email TEXT UNIQUE,
    organizationSlug TEXT UNIQUE,
    notes TEXT,
    stripeCustomerId TEXT,
    stripeSubscriptionId TEXT,
    status TEXT,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS organizationUsers (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT,
    organizationId TEXT,
    organizationSlug TEXT,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS databases (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT,
    dbuuid TEXT UNIQUE,
    isArchived INTEGER,
    isActive INTEGER,
    lastBackup INTEGER,
    schemaVersion INTEGER DEFAULT 1,
    needsSchemaUpdate INTEGER DEFAULT 0,
    lastSchemaSync INTEGER,
    organizationId TEXT,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS dbApiTokens (
    id TEXT PRIMARY KEY NOT NULL,
    token TEXT NOT NULL UNIQUE,
    name TEXT,
    databaseId TEXT,
    expires INTEGER,
    revoked INTEGER,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    deleted_at TEXT
  );`,
];

describeMaybe('Admin E2E with Cloudflare D1', () => {
  const d1 = new KuratchiD1({
    apiToken: CF_API_TOKEN!,
    accountId: CF_ACCOUNT_ID!,
    workersSubdomain: WORKERS_SUBDOMAIN!,
  });

  const databaseName = makeDbName();
  let databaseId = '';
  let apiToken = '';
  let drizzle: any;

  beforeAll(async () => {
    const { database, apiToken: createdToken } = await d1.createDatabase(databaseName);
    databaseId = database.uuid || database.id || '';
    apiToken = createdToken;

    const db = d1.database({ databaseName, apiToken });
    for (const sql of MIGRATIONS_SQL) {
      await db.query(sql);
    }

    const proxy = d1.getDrizzleClient({ databaseName, apiToken });
    drizzle = createDrizzle(proxy as any, { schema: schema as any });
  }, 120_000);

  afterAll(async () => {
    if (databaseId) {
      await d1.deleteDatabase(databaseId);
    }
  }, 120_000);

  it('creates and reads organization + database + token', async () => {
    const orgId = crypto.randomUUID();
    const dbId = crypto.randomUUID();
    const tokenId = crypto.randomUUID();

    const org = await drizzle.insert(schema.Organizations).values({
      id: orgId,
      organizationName: 'Acme Co',
      email: 'ops@acme.test',
      organizationSlug: 'acme',
      status: 'active',
    }).returning().get();
    expect(org.id).toBe(orgId);

    const dbrow = await drizzle.insert(schema.Databases).values({
      id: dbId,
      name: 'acme-db',
      dbuuid: 'uuid-' + dbId,
      isActive: 1,
      organizationId: orgId,
    }).returning().get();
    expect(dbrow.organizationId).toBe(orgId);

    const tok = await drizzle.insert(schema.DBApiTokens).values({
      id: tokenId,
      token: 'tkn-' + tokenId,
      name: 'default',
      databaseId: dbId,
      revoked: 0,
    }).returning().get();
    expect(tok.databaseId).toBe(dbId);

    const join = await drizzle.select().from(schema.Databases).get();
    expect(join.organizationId).toBe(orgId);
  }, 60_000);
});
