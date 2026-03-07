import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';
import { getLocals } from '@kuratchi/js';
import { getCurrentUser } from './auth';
import { generateDbToken } from './deploy';
import { logActivity } from './audit';

const db = kuratchiORM(() => (env as any).DB);

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    getLocals().__redirectTo = '/auth/signin';
    throw new Error('Unauthorized');
  }
  if (!user.organizationId) {
    throw new Error('User is not associated with an organization');
  }
  return user;
}

function getGatewayKey(): string {
  const key = (env as any).GATEWAY_KEY as string | undefined;
  if (!key) throw new Error('Missing GATEWAY_KEY env var');
  return key;
}

/** Set a short-lived flash cookie so the page can display a newly created token once. */
function flashNewToken(token: string, redirectPath: string): void {
  const locals = getLocals() as any;
  if (!locals.__setCookieHeaders) locals.__setCookieHeaders = [];
  locals.__setCookieHeaders.push(
    `__flash_token=${encodeURIComponent(token)}; Path=${redirectPath}; Max-Age=30; HttpOnly; SameSite=Strict`
  );
}

// -- Database-scoped tokens ------------------------------------------

export async function getDbTokens(databaseId: string) {
  await requireAuth();
  const result = await db.dbApiTokens.where({ databaseId, revoked: false }).many();
  return (result.data ?? []) as any[];
}

export async function createDbToken(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const databaseId = formData.get('databaseId') as string;
  const name = (formData.get('name') as string)?.trim();
  if (!databaseId || !name) throw new Error('Database ID and token name are required');

  const dbResult = await db.databases.where({ id: databaseId, isActive: true, organizationId: user.organizationId }).first();
  const record = dbResult.data as any;
  if (!record) throw new Error('Database not found');

  const token = await generateDbToken(record.name, getGatewayKey());
  const now = new Date().toISOString();
  await db.dbApiTokens.insert({
    id: crypto.randomUUID(), token, name, databaseId, revoked: false,
    created_at: now, updated_at: now,
  });
  flashNewToken(token, `/databases/${databaseId}`);
  logActivity({ action: 'token.create', userId: user.id, organizationId: user.organizationId, data: { type: 'database', name, databaseId } });
  getLocals().__redirectTo = `/databases/${databaseId}`;
}

export async function revokeDbToken(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const tokenId = formData.get('tokenId') as string;
  const databaseId = formData.get('databaseId') as string;
  if (!tokenId) throw new Error('Token ID is required');

  // Verify the database belongs to this org
  if (databaseId) {
    const dbResult = await db.databases.where({ id: databaseId, organizationId: user.organizationId }).first();
    if (!dbResult.data) throw new Error('Database not found');
  }

  await db.dbApiTokens.where({ id: tokenId }).update({ revoked: true, updated_at: new Date().toISOString() });
  getLocals().__redirectTo = `/databases/${databaseId}`;
}

// -- KV-scoped tokens ------------------------------------------------

export async function getKvTokens(kvNamespaceId: string) {
  await requireAuth();
  const result = await db.kvApiTokens.where({ kvNamespaceId, revoked: false }).many();
  return (result.data ?? []) as any[];
}

export async function createKvToken(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const kvNamespaceId = formData.get('kvNamespaceId') as string;
  const name = (formData.get('name') as string)?.trim();
  if (!kvNamespaceId || !name) throw new Error('KV namespace ID and token name are required');

  const kvResult = await db.kvNamespaces.where({ id: kvNamespaceId, isActive: true, organizationId: user.organizationId }).first();
  const record = kvResult.data as any;
  if (!record) throw new Error('KV namespace not found');

  const token = await generateDbToken(record.name, getGatewayKey());
  const now = new Date().toISOString();
  await db.kvApiTokens.insert({
    id: crypto.randomUUID(), token, name, kvNamespaceId, revoked: false,
    created_at: now, updated_at: now,
  });
  flashNewToken(token, `/kv/${kvNamespaceId}`);
  logActivity({ action: 'token.create', userId: user.id, organizationId: user.organizationId, data: { type: 'kv', name, kvNamespaceId } });
  getLocals().__redirectTo = `/kv/${kvNamespaceId}`;
}

export async function revokeKvToken(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const tokenId = formData.get('tokenId') as string;
  const kvNamespaceId = formData.get('kvNamespaceId') as string;
  if (!tokenId) throw new Error('Token ID is required');

  if (kvNamespaceId) {
    const kvResult = await db.kvNamespaces.where({ id: kvNamespaceId, organizationId: user.organizationId }).first();
    if (!kvResult.data) throw new Error('KV namespace not found');
  }

  await db.kvApiTokens.where({ id: tokenId }).update({ revoked: true, updated_at: new Date().toISOString() });
  getLocals().__redirectTo = `/kv/${kvNamespaceId}`;
}

// -- R2-scoped tokens ------------------------------------------------

export async function getR2Tokens(r2BucketId: string) {
  await requireAuth();
  const result = await db.r2ApiTokens.where({ r2BucketId, revoked: false }).many();
  return (result.data ?? []) as any[];
}

export async function createR2Token(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const r2BucketId = formData.get('r2BucketId') as string;
  const name = (formData.get('name') as string)?.trim();
  if (!r2BucketId || !name) throw new Error('R2 bucket ID and token name are required');

  const r2Result = await db.r2Buckets.where({ id: r2BucketId, isActive: true, organizationId: user.organizationId }).first();
  const record = r2Result.data as any;
  if (!record) throw new Error('R2 bucket not found');

  const token = await generateDbToken(record.name, getGatewayKey());
  const now = new Date().toISOString();
  await db.r2ApiTokens.insert({
    id: crypto.randomUUID(), token, name, r2BucketId, revoked: false,
    created_at: now, updated_at: now,
  });
  flashNewToken(token, `/r2/${r2BucketId}`);
  logActivity({ action: 'token.create', userId: user.id, organizationId: user.organizationId, data: { type: 'r2', name, r2BucketId } });
  getLocals().__redirectTo = `/r2/${r2BucketId}`;
}

export async function revokeR2Token(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const tokenId = formData.get('tokenId') as string;
  const r2BucketId = formData.get('r2BucketId') as string;
  if (!tokenId) throw new Error('Token ID is required');

  if (r2BucketId) {
    const r2Result = await db.r2Buckets.where({ id: r2BucketId, organizationId: user.organizationId }).first();
    if (!r2Result.data) throw new Error('R2 bucket not found');
  }

  await db.r2ApiTokens.where({ id: tokenId }).update({ revoked: true, updated_at: new Date().toISOString() });
  getLocals().__redirectTo = `/r2/${r2BucketId}`;
}

// -- Platform tokens (account-level, access to everything) -----------

export async function getPlatformTokens() {
  const user = await requireAuth();
  const result = await db.platformApiTokens.where({ revoked: false, organizationId: user.organizationId }).many();
  return (result.data ?? []) as any[];
}

export async function createPlatformToken(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const name = (formData.get('name') as string)?.trim();
  if (!name) throw new Error('Token name is required');

  const token = `kdbp_${await generateDbToken('__platform__', getGatewayKey())}`;
  const now = new Date().toISOString();
  await db.platformApiTokens.insert({
    id: crypto.randomUUID(), token, name, organizationId: user.organizationId, revoked: false,
    created_at: now, updated_at: now,
  });
  flashNewToken(token, '/account/tokens');
  logActivity({ action: 'token.create', userId: user.id, organizationId: user.organizationId, data: { type: 'platform', name } });
  getLocals().__redirectTo = '/account/tokens';
}

export async function revokePlatformToken(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const tokenId = formData.get('tokenId') as string;
  if (!tokenId) throw new Error('Token ID is required');
  await db.platformApiTokens.where({ id: tokenId, organizationId: user.organizationId }).update({ revoked: true, updated_at: new Date().toISOString() });
  getLocals().__redirectTo = '/account/tokens';
}
