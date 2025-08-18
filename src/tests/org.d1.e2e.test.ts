import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { KuratchiD1 } from '../lib/d1/index.js';
import { organizationSchema as schema } from '../lib/auth/organizationSchema.js';
import { AuthService } from '../lib/auth/AuthService.js';
import { drizzle as createDrizzle } from 'drizzle-orm/sqlite-proxy';
import { eq } from 'drizzle-orm';

// Use SvelteKit static env so it resolves under Vitest + Vite
const env = await import('$env/static/private');

// Load env
const CF_API_TOKEN = (env as any).CLOUDFLARE_API_TOKEN || (env as any).CF_API_TOKEN || '';
const CF_ACCOUNT_ID = (env as any).CLOUDFLARE_ACCOUNT_ID || (env as any).CF_ACCOUNT_ID || '';
const WORKERS_SUBDOMAIN = (env as any).CLOUDFLARE_WORKERS_SUBDOMAIN || '';
const KURATCHI_AUTH_SECRET = (env as any).KURATCHI_AUTH_SECRET || '';

const missing = [
  ['CLOUDFLARE_API_TOKEN', CF_API_TOKEN],
  ['CLOUDFLARE_ACCOUNT_ID', CF_ACCOUNT_ID],
  ['CLOUDFLARE_WORKERS_SUBDOMAIN', WORKERS_SUBDOMAIN],
  ['KURATCHI_AUTH_SECRET', KURATCHI_AUTH_SECRET],
]
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  // eslint-disable-next-line no-console
  console.warn('[org.d1.e2e] Skipping E2E: missing env ->', missing.join(', '));
}

const shouldRun = !!(CF_API_TOKEN && CF_ACCOUNT_ID && WORKERS_SUBDOMAIN && KURATCHI_AUTH_SECRET);
const describeMaybe = shouldRun ? describe : describe.skip;
const makeDbName = () => `kuratchi_org_e2e_${Date.now()}_${Math.floor(Math.random()*1e6)}`;

// Minimal org schema migrations (subset sufficient for AuthService flows)
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
    tenantId TEXT,
    organization TEXT,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS session (
    sessionToken TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    expires INTEGER NOT NULL,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    deleted_at TEXT,
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS emailVerificationToken (
    id TEXT PRIMARY KEY NOT NULL,
    token TEXT NOT NULL,
    email TEXT NOT NULL,
    userId TEXT NOT NULL,
    expires INTEGER NOT NULL,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS passwordResetTokens (
    id TEXT PRIMARY KEY NOT NULL,
    token TEXT NOT NULL,
    email TEXT NOT NULL,
    expires INTEGER NOT NULL,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT,
    action TEXT NOT NULL,
    data TEXT,
    status INTEGER,
    ip TEXT,
    userAgent TEXT,
    siteId TEXT,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    permissions TEXT,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    projectName TEXT,
    domain TEXT,
    status INTEGER,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    deleted_at TEXT
  );`,
];

describeMaybe('Organization E2E with Cloudflare D1', () => {
  const d1 = new KuratchiD1({
    apiToken: CF_API_TOKEN!,
    accountId: CF_ACCOUNT_ID!,
    workersSubdomain: WORKERS_SUBDOMAIN!,
  });

  const databaseName = makeDbName();
  let databaseId = '';
  let apiToken = '';
  let drizzle: any;
  let auth: AuthService;

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
    auth = new AuthService(drizzle as any, {
      ADMIN_DB: {} as any,
      RESEND_API_KEY: 'test-resend',
      EMAIL_FROM: 'noreply@example.com',
      ORIGIN: 'http://localhost:5173',
      RESEND_CLUTCHCMS_AUDIENCE: 'test-audience',
      KURATCHI_AUTH_SECRET,
    } as any, schema as any);
  }, 120_000);

  afterAll(async () => {
    if (databaseId) {
      await d1.deleteDatabase(databaseId);
    }
  }, 120_000);

  it('CRUD users in organization DB', async () => {
    const id = crypto.randomUUID();
    const u = await drizzle.insert(schema.Users).values({ id, email: 'orguser@example.com' }).returning().get();
    expect(u.id).toBe(id);

    const got = await drizzle.select().from(schema.Users).where(eq(schema.Users.id, id)).get();
    expect(got?.email).toBe('orguser@example.com');

    const upd = await drizzle.update(schema.Users).set({ name: 'Org User' }).where(eq(schema.Users.id, id)).returning().get();
    expect(upd?.name).toBe('Org User');
  }, 60_000);

  it('AuthService works against organization DB (create/auth/session)', async () => {
    const user = await auth.createUser({ email: 'org-auth@example.com', password: 'secret' });
    expect(user?.email).toBe('org-auth@example.com');

    const ok = await auth.authenticateUser('org-auth@example.com', 'secret');
    expect(ok).toBeTruthy();

    const cookie = await auth.createSession(user.id);
    expect(cookie).toBeTruthy();

    const { sessionData } = await auth.validateSessionToken(cookie);
    expect(sessionData?.userId).toBe(user.id);
  }, 60_000);

  it('Delete user invalidates sessions in organization DB', async () => {
    const user = await auth.createUser({ email: 'org-del@example.com', password: 'secret' });
    const cookie = await auth.createSession(user.id);
    const before = await auth.validateSessionToken(cookie);
    expect(before.sessionData?.userId).toBe(user.id);

    // delete user
    const deleted = await auth.deleteUser(user.id);
    expect(deleted?.id).toBe(user.id);

    // session should now be invalid
    const after = await auth.validateSessionToken(cookie);
    expect(after.sessionData).toBeNull();
  }, 60_000);
});
