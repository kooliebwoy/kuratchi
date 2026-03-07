import { db } from './db';

export type CacheEntry = {
  workerName: string;
  tokens: Set<string>;
  organizationId: string | null;
  ts: number;
};

const dbCache = new Map<string, CacheEntry>();
const kvCache = new Map<string, CacheEntry>();
const r2Cache = new Map<string, CacheEntry>();
let platformTokenCache: { tokenOrgMap: Map<string, string>; ts: number } | null = null;
const CACHE_TTL = 60_000;

export async function resolveDatabase(dbName: string): Promise<CacheEntry | null> {
  const cached = dbCache.get(dbName);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached;

  const dbResult = await db.databases.where({ name: dbName, isActive: true }).first();
  const record = dbResult.data as any;
  if (!record) {
    dbCache.delete(dbName);
    return null;
  }

  const tokenResult = await db.dbApiTokens.where({ databaseId: record.id, revoked: false }).many();
  const tokens = (tokenResult.data ?? []) as any[];
  const tokenSet = new Set(tokens.map((t: any) => t.token as string));

  const entry: CacheEntry = { workerName: record.workerName, tokens: tokenSet, organizationId: record.organizationId || null, ts: Date.now() };
  dbCache.set(dbName, entry);
  return entry;
}

export async function resolveKvNamespace(kvName: string): Promise<CacheEntry | null> {
  const cached = kvCache.get(kvName);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached;

  const result = await db.kvNamespaces.where({ name: kvName, isActive: true }).first();
  const record = result.data as any;
  if (!record) {
    kvCache.delete(kvName);
    return null;
  }

  const tokenResult = await db.kvApiTokens.where({ kvNamespaceId: record.id, revoked: false }).many();
  const tokens = (tokenResult.data ?? []) as any[];
  const tokenSet = new Set(tokens.map((t: any) => t.token as string));

  const entry: CacheEntry = { workerName: record.workerName, tokens: tokenSet, organizationId: record.organizationId || null, ts: Date.now() };
  kvCache.set(kvName, entry);
  return entry;
}

export async function resolveR2Bucket(r2Name: string): Promise<CacheEntry | null> {
  const cached = r2Cache.get(r2Name);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached;

  const result = await db.r2Buckets.where({ name: r2Name, isActive: true }).first();
  const record = result.data as any;
  if (!record) {
    r2Cache.delete(r2Name);
    return null;
  }

  const tokenResult = await db.r2ApiTokens.where({ r2BucketId: record.id, revoked: false }).many();
  const tokens = (tokenResult.data ?? []) as any[];
  const tokenSet = new Set(tokens.map((t: any) => t.token as string));

  const entry: CacheEntry = { workerName: record.workerName, tokens: tokenSet, organizationId: record.organizationId || null, ts: Date.now() };
  r2Cache.set(r2Name, entry);
  return entry;
}

export async function getPlatformTokenOrgMap(): Promise<Map<string, string>> {
  if (platformTokenCache && Date.now() - platformTokenCache.ts < CACHE_TTL) {
    return platformTokenCache.tokenOrgMap;
  }

  const result = await db.platformApiTokens.where({ revoked: false }).many();
  const tokens = (result.data ?? []) as any[];
  const tokenOrgMap = new Map<string, string>();
  for (const t of tokens) {
    tokenOrgMap.set(t.token, t.organizationId || '');
  }
  platformTokenCache = { tokenOrgMap, ts: Date.now() };
  return tokenOrgMap;
}

export async function validateToken(bearerToken: string, entry: CacheEntry): Promise<boolean> {
  if (entry.tokens.has(bearerToken)) return true;

  if (bearerToken.startsWith('kdbp_')) {
    const tokenOrgMap = await getPlatformTokenOrgMap();
    const tokenOrg = tokenOrgMap.get(bearerToken);
    if (tokenOrg === undefined) return false;
    if (entry.organizationId && tokenOrg && tokenOrg !== entry.organizationId) return false;
    return true;
  }

  return false;
}
