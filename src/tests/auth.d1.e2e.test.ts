import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { KuratchiD1 } from '../lib/d1/kuratchi-d1.js';
import { AuthService } from '../lib/auth/AuthService.js';

// Use SvelteKit static env so it resolves under Vitest + Vite
const env = await import('$env/static/private');

// Load env from SvelteKit static private env (baked at transform time)
const CF_API_TOKEN = (env as any).CLOUDFLARE_API_TOKEN || (env as any).CF_API_TOKEN || '';
const CF_ACCOUNT_ID = (env as any).CLOUDFLARE_ACCOUNT_ID || (env as any).CF_ACCOUNT_ID || '';
const WORKERS_SUBDOMAIN = (env as any).CLOUDFLARE_WORKERS_SUBDOMAIN || '';
const KURATCHI_AUTH_SECRET = (env as any).KURATCHI_AUTH_SECRET || '';

// Help diagnose skips: warn which variable(s) are missing
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
  console.warn('[auth.d1.e2e] Skipping E2E: missing env ->', missing.join(', '));
}

const shouldRun = !!(CF_API_TOKEN && CF_ACCOUNT_ID && WORKERS_SUBDOMAIN && KURATCHI_AUTH_SECRET);
const describeMaybe = shouldRun ? describe : describe.skip;
const makeDbName = () => `kuratchi_auth_e2e_${Date.now()}_${Math.floor(Math.random()*1e6)}`;

// Minimal inline migrations to create tables used by AuthService/adminSchema
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
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    deleted_at TEXT
  );`
];

describeMaybe('AuthService E2E with Cloudflare D1 (SvelteKit env, outside lib)', () => {
  const d1 = new KuratchiD1({
    apiToken: CF_API_TOKEN!,
    accountId: CF_ACCOUNT_ID!,
    workersSubdomain: WORKERS_SUBDOMAIN!,
  });

  const databaseName = makeDbName();
  let databaseId = '';
  let apiToken = '';
 
  let auth: AuthService;

  beforeAll(async () => {
    const { database, apiToken: createdToken } = await d1.createDatabase(databaseName);
    databaseId = database.uuid || database.id || '';
    apiToken = createdToken;

    const db = d1.database({ databaseName, apiToken });
    for (const sql of MIGRATIONS_SQL) {
      await db.query(sql);
    }

    // Instantiate runtime ORM client (admin schema) for AuthService
    const client = d1.client({ databaseName, apiToken }, { schema: 'admin' });
    auth = new AuthService(client as any, {
      ADMIN_DB: {} as any,
      RESEND_API_KEY: 'test-resend',
      EMAIL_FROM: 'noreply@example.com',
      ORIGIN: 'http://localhost:5173',
      RESEND_CLUTCHCMS_AUDIENCE: 'test-audience',
      KURATCHI_AUTH_SECRET,
    } as any);
  }, 120_000);

  afterAll(async () => {
    if (databaseId) {
      await d1.deleteDatabase(databaseId);
    }
  }, 120_000);

  it('creates user and authenticates', async () => {
    const u = await auth.createUser({ email: 'e2e@example.com', password: 'pass123' });
    expect(u?.email).toBe('e2e@example.com');

    const ok = await auth.authenticateUser('e2e@example.com', 'pass123');
    const bad = await auth.authenticateUser('e2e@example.com', 'nope');
    expect(ok).toBeTruthy();
    expect(bad).toBeNull();
  }, 60_000);

  it('session lifecycle works', async () => {
    const u = await auth.createUser({ email: 'e2e2@example.com', password: 'pass123' });
    const cookie = await auth.createSession(u.id);
    expect(cookie).toBeTruthy();

    const { sessionData } = await auth.validateSessionToken(cookie);
    expect(sessionData?.userId).toBe(u.id);

    const r = await auth.refreshSession(cookie);
    expect(r.success).toBe(true);

    await auth.invalidateSession(cookie);
    const after = await auth.validateSessionToken(cookie);
    expect(after.sessionData).toBeNull();
  }, 60_000);

  it('password reset lifecycle works', async () => {
    const u = await auth.createUser({ email: 'e2e3@example.com', password: 'pass123' });
    const t = await auth.createPasswordResetToken(u.email);
    expect(t?.token).toBeTruthy();

    const got = await auth.getPasswordResetToken(t.token);
    expect(Array.isArray(got)).toBe(true);
    expect(got.length).toBe(1);

    const del = await auth.deletePasswordResetToken(t.token);
    expect(del).toBe(true);
  }, 60_000);

  it('email verification flow works', async () => {
    const u = await auth.createUser({ email: 'e2e4@example.com', password: 'pass123' });
    const tokenData = await auth.createEmailVerificationToken(u.id, u.email);
    const verify = await auth.verifyEmail(tokenData.token, u.email);
    expect(verify.success).toBe(true);
    expect(verify.user?.emailVerified).toBeTruthy();
  }, 60_000);
});
