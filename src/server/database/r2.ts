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

// -- R2 Gateway Worker Script ----------------------------------------
// Internal-only. Bindings: env.BUCKET
//
// Routes (RESTful -- natural for object storage):
//   GET    /                     -> list objects (query: prefix, limit, cursor)
//   GET    /:key                 -> get object
//   PUT    /:key                 -> put object (body = file, headers for content-type)
//   DELETE /:key                 -> delete object
//   HEAD   /:key                 -> head object (metadata only)

const R2_WORKER_SCRIPT = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.slice(1)); // strip leading /

    try {
      if (request.method === 'GET' && !key) {
        // List objects
        const prefix = url.searchParams.get('prefix') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '100', 10);
        const cursor = url.searchParams.get('cursor') || undefined;
        const result = await env.BUCKET.list({ prefix, limit, cursor });
        return Response.json({
          success: true,
          objects: result.objects.map(o => ({ key: o.key, size: o.size, etag: o.etag, uploaded: o.uploaded })),
          truncated: result.truncated,
          cursor: result.cursor,
        });
      }

      if (request.method === 'HEAD' && key) {
        const obj = await env.BUCKET.head(key);
        if (!obj) return Response.json({ error: 'Not found' }, { status: 404 });
        return Response.json({
          success: true,
          key: obj.key,
          size: obj.size,
          etag: obj.etag,
          httpMetadata: obj.httpMetadata,
          customMetadata: obj.customMetadata,
          uploaded: obj.uploaded,
        });
      }

      if (request.method === 'GET' && key) {
        const obj = await env.BUCKET.get(key);
        if (!obj) return Response.json({ error: 'Not found' }, { status: 404 });
        const headers = new Headers();
        headers.set('etag', obj.etag);
        if (obj.httpMetadata?.contentType) headers.set('content-type', obj.httpMetadata.contentType);
        if (obj.httpMetadata?.contentDisposition) headers.set('content-disposition', obj.httpMetadata.contentDisposition);
        headers.set('x-r2-size', String(obj.size));
        headers.set('x-r2-uploaded', obj.uploaded?.toISOString?.() || '');
        return new Response(obj.body, { headers });
      }

      if (request.method === 'PUT' && key) {
        const contentType = request.headers.get('content-type') || 'application/octet-stream';
        const customMeta = request.headers.get('x-r2-metadata');
        const opts = { httpMetadata: { contentType } };
        if (customMeta) {
          try { opts.customMetadata = JSON.parse(customMeta); } catch {}
        }
        const obj = await env.BUCKET.put(key, request.body, opts);
        return Response.json({ success: true, key: obj.key, size: obj.size, etag: obj.etag });
      }

      if (request.method === 'DELETE' && key) {
        await env.BUCKET.delete(key);
        return Response.json({ success: true });
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 500 });
    }
  }
};
`;

// -- Queries ---------------------------------------------------------

export async function getR2Buckets() {
  const user = await requireAuth();
  const result = await db.r2Buckets.where({ isActive: true, organizationId: user.organizationId }).many();
  return (result.data ?? []) as any[];
}

export async function getR2Bucket(id: string) {
  const user = await requireAuth();
  const result = await db.r2Buckets.where({ id, isActive: true, organizationId: user.organizationId }).first();
  return (result.data ?? null) as any;
}

// -- Create R2 bucket + deploy worker --------------------------------

export async function createR2Bucket(formData: FormData): Promise<void> {
  const user = await requireAuth();

  const name = (formData.get('name') as string)?.trim().toLowerCase();
  const locationHint = (formData.get('locationHint') as string)?.trim() || null;
  if (!name) throw new Error('Bucket name is required');
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error('Name must contain only lowercase letters, numbers, and hyphens');
  }

  const { accountId, apiToken, gatewayKey, namespace } = getEnvVars();

  // 1. Create R2 bucket via Cloudflare API
  const createBody: Record<string, string> = { name: `kdb-${name}` };
  if (locationHint) createBody.locationHint = locationHint;

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
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
    throw new Error(`R2 create failed: ${cfRes.status} ${errText}`);
  }

  const cfBucketName = `kdb-${name}`;
  const workerName = `kdb-r2-${name}`;

  // 2. Deploy R2 worker into dispatch namespace
  const form = new FormData();
  form.append('worker.js', new File([R2_WORKER_SCRIPT], 'worker.js', { type: 'application/javascript+module' }));
  form.append('metadata', JSON.stringify({
    main_module: 'worker.js',
    compatibility_date: '2026-02-26',
    compatibility_flags: ['nodejs_compat'],
    bindings: [
      { type: 'r2_bucket', name: 'BUCKET', bucket_name: cfBucketName },
    ],
  }));

  const deployRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${namespace}/scripts/${workerName}`,
    { method: 'PUT', headers: { Authorization: `Bearer ${apiToken}` }, body: form }
  );

  if (!deployRes.ok) {
    const err = await deployRes.text();
    throw new Error(`Failed to deploy R2 worker: ${deployRes.status} ${err}`);
  }

  // 3. Generate API token
  const r2Token = await generateDbToken(name, gatewayKey);

  // 4. Persist
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.r2Buckets.insert({
    id,
    name,
    workerName,
    locationHint: locationHint || null,
    isActive: true,
    createdBy: user.id,
    organizationId: user.organizationId,
    created_at: now,
    updated_at: now,
  });

  await db.r2ApiTokens.insert({
    id: crypto.randomUUID(),
    token: r2Token,
    name: `${name}-default`,
    r2BucketId: id,
    revoked: false,
    created_at: now,
    updated_at: now,
  });

  logActivity({ action: 'r2.create', userId: user.id, organizationId: user.organizationId, data: { name, r2BucketId: id } });

  getLocals().__redirectTo = `/r2/${id}`;
}

// -- Delete R2 bucket ------------------------------------------------

export async function deleteR2Bucket(formData: FormData): Promise<void> {
  const user = await requireAuth();

  const id = formData.get('id') as string;
  if (!id) throw new Error('ID is required');

  const result = await db.r2Buckets.where({ id, organizationId: user.organizationId }).first();
  const record = result.data as any;
  if (!record) throw new Error('R2 bucket not found');

  const { accountId, apiToken, namespace } = getEnvVars();

  // Delete dispatch worker
  if (record.workerName) {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${namespace}/scripts/${record.workerName}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` } }
    ).catch((err) => console.warn('[deleteR2] worker removal failed:', err));
  }

  // Delete R2 bucket from Cloudflare
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/kdb-${record.name}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` } }
  ).catch((err) => console.warn('[deleteR2] bucket deletion failed:', err));

  await db.r2ApiTokens.where({ r2BucketId: id }).delete();
  await db.r2Buckets.where({ id }).delete();

  logActivity({ action: 'r2.delete', userId: user.id, organizationId: user.organizationId, data: { name: record.name, r2BucketId: id } });

  getLocals().__redirectTo = '/r2';
}
