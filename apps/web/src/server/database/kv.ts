import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';
import { redirect } from '@kuratchi/js';
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

function getEnvVars() {
  const accountId = (env as any).CLOUDFLARE_ACCOUNT_ID as string;
  const apiToken = (env as any).CLOUDFLARE_API_TOKEN as string;
  const gatewayKey = (env as any).GATEWAY_KEY as string;
  const namespace = (env as any).DISPATCH_NAMESPACE as string;
  if (!accountId || !apiToken || !gatewayKey || !namespace) {
    throw new Error('Missing required env vars');
  }
  return { accountId, apiToken, gatewayKey, namespace };
}

// -- KV Gateway Worker Script ----------------------------------------
// Internal-only. Single POST endpoint. Bindings: env.KV
//
// Body:
//   { op: "get", key }                -> get value
//   { op: "put", key, value, meta? }  -> put value (with optional metadata/expiration)
//   { op: "delete", key }             -> delete key
//   { op: "list", prefix?, limit?, cursor? } -> list keys

const KV_WORKER_SCRIPT = `
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    try {
      const body = await request.json();
      const { op } = body;

      if (op === 'get') {
        const value = await env.KV.get(body.key, body.type || 'text');
        return Response.json({ success: true, value });
      }

      if (op === 'getWithMetadata') {
        const result = await env.KV.getWithMetadata(body.key, body.type || 'text');
        return Response.json({ success: true, value: result.value, metadata: result.metadata });
      }

      if (op === 'put') {
        const opts = {};
        if (body.expirationTtl) opts.expirationTtl = body.expirationTtl;
        if (body.expiration) opts.expiration = body.expiration;
        if (body.metadata) opts.metadata = body.metadata;
        await env.KV.put(body.key, body.value, opts);
        return Response.json({ success: true });
      }

      if (op === 'delete') {
        await env.KV.delete(body.key);
        return Response.json({ success: true });
      }

      if (op === 'list') {
        const opts = {};
        if (body.prefix) opts.prefix = body.prefix;
        if (body.limit) opts.limit = body.limit;
        if (body.cursor) opts.cursor = body.cursor;
        const result = await env.KV.list(opts);
        return Response.json({ success: true, keys: result.keys, list_complete: result.list_complete, cursor: result.cursor });
      }

      return Response.json({ error: 'Unknown op: ' + op }, { status: 400 });
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 500 });
    }
  }
};
`;

// -- Queries ---------------------------------------------------------

export async function getKvNamespaces() {
  const user = await requireAuth();
  const result = await db.kvNamespaces.where({ isActive: true, organizationId: user.organizationId }).many();
  return (result.data ?? []) as any[];
}

export async function getKvNamespace(id: string) {
  const user = await requireAuth();
  const result = await db.kvNamespaces.where({ id, isActive: true, organizationId: user.organizationId }).first();
  return (result.data ?? null) as any;
}

// -- Create KV namespace + deploy worker -----------------------------

export async function createKvNamespace({ formData }: FormData): Promise<void> {
  const user = await requireAuth();

  const name = (formData.get('name') as string)?.trim().toLowerCase();
  if (!name) throw new Error('Namespace name is required');
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error('Name must contain only lowercase letters, numbers, and hyphens');
  }

  const { accountId, apiToken, gatewayKey, namespace } = getEnvVars();

  // 1. Create KV namespace via Cloudflare API
  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: `kdb-${name}` }),
    }
  );

  if (!cfRes.ok) {
    const errText = await cfRes.text();
    throw new Error(`KV create failed: ${cfRes.status} ${errText}`);
  }

  const cfData = (await cfRes.json()) as any;
  const cfNamespaceId = cfData.result.id;

  const workerName = `kdb-kv-${cfNamespaceId.slice(0, 16)}`;

  // 2. Deploy KV worker into dispatch namespace
  const form = new FormData();
  form.append('worker.js', new File([KV_WORKER_SCRIPT], 'worker.js', { type: 'application/javascript+module' }));
  form.append('metadata', JSON.stringify({
    main_module: 'worker.js',
    compatibility_date: '2026-02-26',
    compatibility_flags: ['nodejs_compat'],
    bindings: [
      { type: 'kv_namespace', name: 'KV', namespace_id: cfNamespaceId },
    ],
  }));

  const deployRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${namespace}/scripts/${workerName}`,
    { method: 'PUT', headers: { Authorization: `Bearer ${apiToken}` }, body: form }
  );

  if (!deployRes.ok) {
    const err = await deployRes.text();
    throw new Error(`Failed to deploy KV worker: ${deployRes.status} ${err}`);
  }

  // 3. Generate API token
  const kvToken = await generateDbToken(name, gatewayKey);

  // 4. Persist
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.kvNamespaces.insert({
    id,
    name,
    cfNamespaceId,
    workerName,
    isActive: true,
    createdBy: user.id,
    organizationId: user.organizationId,
    created_at: now,
    updated_at: now,
  });

  await db.kvApiTokens.insert({
    id: crypto.randomUUID(),
    token: kvToken,
    name: `${name}-default`,
    kvNamespaceId: id,
    revoked: false,
    created_at: now,
    updated_at: now,
  });

  logActivity({ action: 'kv.create', userId: user.id, organizationId: user.organizationId, data: { name, kvNamespaceId: id } });

  redirect(`/kv/${id}`);
}

// -- Delete KV namespace ---------------------------------------------

export async function deleteKvNamespace({ formData }: FormData): Promise<void> {
  const user = await requireAuth();

  const id = formData.get('id') as string;
  if (!id) throw new Error('ID is required');

  const result = await db.kvNamespaces.where({ id, organizationId: user.organizationId }).first();
  const record = result.data as any;
  if (!record) throw new Error('KV namespace not found');

  const { accountId, apiToken, namespace } = getEnvVars();

  // Delete dispatch worker
  if (record.workerName) {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${namespace}/scripts/${record.workerName}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` } }
    ).catch((err) => console.warn('[deleteKv] worker removal failed:', err));
  }

  // Delete KV namespace from Cloudflare
  if (record.cfNamespaceId) {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${record.cfNamespaceId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` } }
    ).catch((err) => console.warn('[deleteKv] KV deletion failed:', err));
  }

  await db.kvApiTokens.where({ kvNamespaceId: id }).delete();
  await db.kvNamespaces.where({ id }).delete();

  logActivity({ action: 'kv.delete', userId: user.id, organizationId: user.organizationId, data: { name: record.name, kvNamespaceId: id } });

  redirect('/kv');
}
