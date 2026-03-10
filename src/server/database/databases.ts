import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';
import { redirect } from '@kuratchi/js';
import { getCurrentUser } from './auth';
import { deployDbWorker, deleteDbWorker, generateDbToken, dispatchQuery } from './deploy';
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

function getEnvVars() {
  const accountId = (env as any).CLOUDFLARE_ACCOUNT_ID as string | undefined;
  const apiToken = (env as any).CLOUDFLARE_API_TOKEN as string | undefined;
  const gatewayKey = (env as any).GATEWAY_KEY as string | undefined;
  const namespace = (env as any).DISPATCH_NAMESPACE as string | undefined;

  if (!accountId || !apiToken || !gatewayKey || !namespace) {
    throw new Error(
      'Missing required env vars: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, GATEWAY_KEY, DISPATCH_NAMESPACE'
    );
  }
  return { accountId, apiToken, gatewayKey, namespace };
}

// -- Queries --------------------------------------------------------

export async function getDatabases() {
  const user = await requireAuth();
  const result = await db.databases.where({ isActive: true, organizationId: user.organizationId }).many();
  return (result.data ?? []) as any[];
}

export async function getDatabase(id: string) {
  const user = await requireAuth();
  const result = await db.databases.where({ id, isActive: true, organizationId: user.organizationId }).first();
  return (result.data ?? null) as any;
}

// -- Create database: D1 + dispatch namespace worker + token --------

export async function createDatabase(formData: FormData): Promise<void> {
  const user = await requireAuth();

  const name = (formData.get('name') as string)?.trim().toLowerCase();
  const locationHint = (formData.get('locationHint') as string)?.trim() || null;
  if (!name) throw new Error('Database name is required');
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error('Name must contain only lowercase letters, numbers, and hyphens');
  }

  const { accountId, apiToken, gatewayKey, namespace } = getEnvVars();

  // 1. Create the D1 database via Cloudflare REST API
  const createBody: Record<string, string> = { name };
  if (locationHint) createBody.primary_location_hint = locationHint;

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
    }
  );

  if (!cfRes.ok) {
    const errText = await cfRes.text();
    throw new Error(`Cloudflare D1 create failed: ${cfRes.status} ${errText}`);
  }

  const cfData = (await cfRes.json()) as any;
  const d1Db = cfData.result;
  const d1Id: string = d1Db.uuid || d1Db.id;

  const workerName = `kdb-${d1Id.replace(/-/g, '')}`;

  // 2. Deploy bare D1 worker into dispatch namespace (no auth -- internal only)
  await deployDbWorker({ accountId, apiToken, namespace, workerName, d1DatabaseId: d1Id });

  // 3. Generate a long-lived API token for client access
  const dbApiToken = await generateDbToken(name, gatewayKey);

  // 4. Persist to kuratchi-db's own D1
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const insertDb = await db.databases.insert({
    id,
    name,
    dbuuid: d1Id,
    workerName,
    locationHint: locationHint || null,
    isArchived: false,
    isActive: true,
    isPrimary: false,
    schemaVersion: 1,
    needsSchemaUpdate: false,
    createdBy: user.id,
    organizationId: user.organizationId,
    created_at: now,
    updated_at: now,
  });

  if (!insertDb.success) throw new Error('Failed to record database');

  await db.dbApiTokens.insert({
    id: crypto.randomUUID(),
    token: dbApiToken,
    name: `${name}-default`,
    databaseId: id,
    revoked: false,
    created_at: now,
    updated_at: now,
  });

  logActivity({ action: 'database.create', userId: user.id, organizationId: user.organizationId, data: { name, databaseId: id } });

  redirect(`/databases/${id}`);
}

// -- Delete database: D1 + dispatch worker + tokens + record ---------

export async function deleteDatabase(formData: FormData): Promise<void> {
  const user = await requireAuth();

  const id = formData.get('id') as string;
  if (!id) throw new Error('Database ID is required');

  const result = await db.databases.where({ id, organizationId: user.organizationId }).first();
  const record = result.data as any;
  if (!record) throw new Error('Database not found');

  const { accountId, apiToken, namespace } = getEnvVars();

  // 1. Delete the dispatch worker from the namespace
  if (record.workerName) {
    await deleteDbWorker({ accountId, apiToken, namespace, workerName: record.workerName }).catch(
      (err) => console.warn('[deleteDatabase] worker removal failed:', err)
    );
  }

  // 2. Delete the D1 database from Cloudflare
  if (record.dbuuid) {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${record.dbuuid}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiToken}` },
      }
    ).catch((err) => console.warn('[deleteDatabase] D1 deletion failed:', err));
  }

  // 3. Delete all API tokens for this database
  await db.dbApiTokens.where({ databaseId: id }).delete();

  // 4. Delete the database record
  await db.databases.where({ id }).delete();

  logActivity({ action: 'database.delete', userId: user.id, organizationId: user.organizationId, data: { name: record.name, databaseId: id } });

  redirect('/databases');
}

// -- Redeploy dispatch worker for an existing database -------------

export async function redeployDatabase(id: string): Promise<void> {
  const user = await requireAuth();

  const result = await db.databases.where({ id, organizationId: user.organizationId }).first();
  const record = result.data as any;
  if (!record) throw new Error('Database not found');
  if (!record.workerName || !record.dbuuid) throw new Error('Database is missing worker or D1 info');

  const { accountId, apiToken, namespace } = getEnvVars();
  await deployDbWorker({ accountId, apiToken, namespace, workerName: record.workerName, d1DatabaseId: record.dbuuid });

  logActivity({ action: 'database.redeploy', userId: user.id, organizationId: user.organizationId, data: { name: record.name, databaseId: id } });
}

// -- Query a database through the dispatch namespace ----------------
// Used by server-side routes (e.g. database detail page).

export async function queryDatabase(options: {
  databaseId: string;
  sql: string;
  params?: any[];
}): Promise<{ results: any[]; success: boolean; error?: string; meta?: Record<string, unknown> }> {
  await requireAuth();

  const { databaseId, sql, params = [] } = options;

  const dbResult = await db.databases.where({ id: databaseId, isActive: true }).first();
  const record = dbResult.data as any;
  if (!record) return { success: false, error: 'Database not found', results: [] };

  try {
    const res = await dispatchQuery(
      record.workerName,
      JSON.stringify({ sql, params }),
    );
    const data = await res.json().catch(() => null) as any;

    if (!res.ok) {
      return {
        success: false,
        error: data?.error ?? `HTTP ${res.status}`,
        results: [],
      };
    }

    if (data?.error) {
      return {
        success: false,
        error: String(data.error),
        results: [],
        meta: data?.meta,
      };
    }

    return {
      success: data?.success ?? true,
      results: data?.results ?? [],
      error: data?.success === false ? (data?.error ?? 'Query failed') : undefined,
      meta: data?.meta,
    };
  } catch (err) {
    return { success: false, error: String(err), results: [] };
  }
}
