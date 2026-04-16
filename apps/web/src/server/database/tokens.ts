import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';
import { getLocals, redirect } from '@kuratchi/js';
import { headers } from 'kuratchi:request';
import { getCurrentUser } from './auth';
import { generateDbToken } from './deploy';
import { logActivity } from './audit';

const db = kuratchiORM(() => (env as any).DB);

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/signin');
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

export function consumeFlashNewToken(): string | null {
  const cookies = headers.get('cookie') || '';
  const flashMatch = cookies.match(/__flash_token=([^;]+)/);
  if (!flashMatch) return null;

  const locals = getLocals() as any;
  if (!locals.__setCookieHeaders) locals.__setCookieHeaders = [];
  locals.__setCookieHeaders.push('__flash_token=; Path=/account/tokens; Max-Age=0; HttpOnly; SameSite=Strict');
  return decodeURIComponent(flashMatch[1]);
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
  flashNewToken(token, '/account/tokens');
  logActivity({ action: 'token.create', userId: user.id, organizationId: user.organizationId, data: { type: 'database', name, databaseId } });
  redirect('/account/tokens');
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
  redirect('/account/tokens');
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
  flashNewToken(token, '/account/tokens');
  logActivity({ action: 'token.create', userId: user.id, organizationId: user.organizationId, data: { type: 'kv', name, kvNamespaceId } });
  redirect('/account/tokens');
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
  redirect('/account/tokens');
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
  flashNewToken(token, '/account/tokens');
  logActivity({ action: 'token.create', userId: user.id, organizationId: user.organizationId, data: { type: 'r2', name, r2BucketId } });
  redirect('/account/tokens');
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
  redirect('/account/tokens');
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
  redirect('/account/tokens');
}

export async function revokePlatformToken(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const tokenId = formData.get('tokenId') as string;
  if (!tokenId) throw new Error('Token ID is required');
  await db.platformApiTokens.where({ id: tokenId, organizationId: user.organizationId }).update({ revoked: true, updated_at: new Date().toISOString() });
  redirect('/account/tokens');
}

// -- Unified token listing (all scopes) --------------------------------

export async function getAllTokens() {
  const user = await requireAuth();
  const orgId = user.organizationId!;

  const [platformResult, dbResult, kvResult, r2Result] = await Promise.all([
    db.platformApiTokens.where({ revoked: false, organizationId: orgId }).many(),
    db.dbApiTokens.where({ revoked: false }).many(),
    db.kvApiTokens.where({ revoked: false }).many(),
    db.r2ApiTokens.where({ revoked: false }).many(),
  ]);

  const platform = ((platformResult.data ?? []) as any[]).map(t => ({ ...t, scope: 'platform', scopeLabel: 'Platform (all)' }));

  // Fetch resource names for labels
  const dbIds = new Set(((dbResult.data ?? []) as any[]).map((t: any) => t.databaseId));
  const kvIds = new Set(((kvResult.data ?? []) as any[]).map((t: any) => t.kvNamespaceId));
  const r2Ids = new Set(((r2Result.data ?? []) as any[]).map((t: any) => t.r2BucketId));

  const dbNames: Record<string, string> = {};
  for (const rid of dbIds) {
    const r = await db.databases.where({ id: rid as string, organizationId: orgId }).first();
    if (r.data) dbNames[rid as string] = (r.data as any).name;
  }
  const kvNames: Record<string, string> = {};
  for (const rid of kvIds) {
    const r = await db.kvNamespaces.where({ id: rid as string, organizationId: orgId }).first();
    if (r.data) kvNames[rid as string] = (r.data as any).name;
  }
  const r2Names: Record<string, string> = {};
  for (const rid of r2Ids) {
    const r = await db.r2Buckets.where({ id: rid as string, organizationId: orgId }).first();
    if (r.data) r2Names[rid as string] = (r.data as any).name;
  }

  const dbTokens = ((dbResult.data ?? []) as any[])
    .filter(t => dbNames[t.databaseId])
    .map(t => ({ ...t, scope: 'database', scopeLabel: `DB: ${dbNames[t.databaseId]}` }));
  const kvTokens = ((kvResult.data ?? []) as any[])
    .filter(t => kvNames[t.kvNamespaceId])
    .map(t => ({ ...t, scope: 'kv', scopeLabel: `KV: ${kvNames[t.kvNamespaceId]}` }));
  const r2Tokens = ((r2Result.data ?? []) as any[])
    .filter(t => r2Names[t.r2BucketId])
    .map(t => ({ ...t, scope: 'r2', scopeLabel: `R2: ${r2Names[t.r2BucketId]}` }));

  return [...platform, ...dbTokens, ...kvTokens, ...r2Tokens].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// -- Create token with scope selector -----------------------------------

export async function createScopedToken(formData: FormData): Promise<void> {
  const scope = formData.get('scope') as string;
  const resourceId = formData.get('resourceId') as string;
  const name = (formData.get('name') as string)?.trim();
  if (!scope || !name) throw new Error('Scope and name are required');

  if (scope === 'platform') {
    const fd = new FormData();
    fd.set('name', name);
    return createPlatformToken(fd);
  }

  if (!resourceId) throw new Error('Resource is required for scoped tokens');

  if (scope === 'database') {
    const fd = new FormData();
    fd.set('databaseId', resourceId);
    fd.set('name', name);
    return createDbToken(fd);
  }
  if (scope === 'kv') {
    const fd = new FormData();
    fd.set('kvNamespaceId', resourceId);
    fd.set('name', name);
    return createKvToken(fd);
  }
  if (scope === 'r2') {
    const fd = new FormData();
    fd.set('r2BucketId', resourceId);
    fd.set('name', name);
    return createR2Token(fd);
  }

  throw new Error('Invalid scope');
}

// -- Revoke any token by scope -----------------------------------------

export async function revokeAnyToken(formData: FormData): Promise<void> {
  const user = await requireAuth();
  const tokenId = formData.get('tokenId') as string;
  const scope = formData.get('scope') as string;
  if (!tokenId || !scope) throw new Error('Token ID and scope are required');

  const now = new Date().toISOString();
  switch (scope) {
    case 'platform':
      await db.platformApiTokens.where({ id: tokenId, organizationId: user.organizationId }).update({ revoked: true, updated_at: now });
      break;
    case 'database':
      await db.dbApiTokens.where({ id: tokenId }).update({ revoked: true, updated_at: now });
      break;
    case 'kv':
      await db.kvApiTokens.where({ id: tokenId }).update({ revoked: true, updated_at: now });
      break;
    case 'r2':
      await db.r2ApiTokens.where({ id: tokenId }).update({ revoked: true, updated_at: now });
      break;
    default:
      throw new Error('Invalid scope');
  }
  redirect('/account/tokens');
}
