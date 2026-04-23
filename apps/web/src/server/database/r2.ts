import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';
import { getLocals, redirect } from '@kuratchi/js';
import { searchParams } from '@kuratchi/js/request';
import { getCurrentUser } from './auth';
import { generateDbToken } from './deploy';
import { logActivity } from './audit';
import { getDispatcher } from '../api/utils';

const db = kuratchiORM(() => (env as any).DB);
const EXPLORER_PAGE_SIZE = 200;
const TEXT_PREVIEW_SIZE_LIMIT = 256 * 1024;

type R2ListResponse = {
  success?: boolean;
  objects?: Array<{ key: string; size: number; etag: string; uploaded?: string }>;
  truncated?: boolean;
  cursor?: string;
  delimitedPrefixes?: string[];
  error?: string;
};

type ExplorerObject = {
  key: string;
  name: string;
  size: number;
  etag: string;
  uploaded?: string;
  contentType?: string | null;
};

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

function getR2IdFromParams(): string {
  const params = getLocals().params as Record<string, string> | undefined;
  const id = params?.id ?? '';
  if (!id) throw new Error('Missing R2 bucket ID');
  return id;
}

function normalizePrefix(value: string | null | undefined): string {
  const raw = String(value || '').trim().replace(/^\/+/, '');
  if (!raw) return '';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function normalizeObjectKey(value: string | null | undefined): string {
  return String(value || '').trim().replace(/^\/+/, '');
}

function joinPrefixAndKey(prefix: string, key: string, fallbackName = ''): string {
  const normalizedPrefix = normalizePrefix(prefix);
  const rawKey = normalizeObjectKey(key);
  if (rawKey) {
    if (normalizedPrefix && !rawKey.includes('/')) {
      return `${normalizedPrefix}${rawKey}`;
    }
    return rawKey;
  }
  if (!fallbackName) return normalizedPrefix;
  return `${normalizedPrefix}${fallbackName.replace(/^\/+/, '')}`;
}

function buildExplorerHref(bucketId: string, options: { prefix?: string; selected?: string } = {}): string {
  const qs = new URLSearchParams();
  const prefix = normalizePrefix(options.prefix);
  const selected = normalizeObjectKey(options.selected);
  if (prefix) qs.set('prefix', prefix);
  if (selected) qs.set('selected', selected);
  const query = qs.toString();
  return query ? `/r2/${bucketId}?${query}` : `/r2/${bucketId}`;
}

function encodeObjectKey(key: string): string {
  return normalizeObjectKey(key)
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function objectDisplayName(key: string, prefix: string): string {
  const normalizedPrefix = normalizePrefix(prefix);
  if (normalizedPrefix && key.startsWith(normalizedPrefix)) {
    return key.slice(normalizedPrefix.length) || key;
  }
  return key.split('/').filter(Boolean).pop() || key;
}

function isPreviewableText(contentType: string | null, size: number): boolean {
  if (!contentType || size > TEXT_PREVIEW_SIZE_LIMIT) return false;
  const normalized = contentType.toLowerCase();
  return normalized.startsWith('text/')
    || normalized.includes('json')
    || normalized.includes('javascript')
    || normalized.includes('xml')
    || normalized.includes('yaml')
    || normalized.includes('svg');
}

async function requireAuthAndBucket() {
  const id = getR2IdFromParams();
  const user = await requireAuth();
  const result = await db.r2Buckets.where({ id, isActive: true, organizationId: user.organizationId }).first();
  const bucket = result.data as any;
  if (!bucket) throw new Error('R2 bucket not found');
  if (!bucket.workerName) throw new Error('R2 bucket worker is missing');
  return { user, bucket, id };
}

async function dispatchR2Request(options: {
  workerName: string;
  method?: string;
  key?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: BodyInit | null;
}): Promise<Response> {
  const { workerName, method = 'GET', key = '', query = {}, headers = {}, body = null } = options;
  const dispatcher = getDispatcher();
  const worker = dispatcher.get(workerName);
  let internalUrl = 'https://r2.internal/';
  const encodedKey = encodeObjectKey(key);
  if (encodedKey) internalUrl += encodedKey;
  const qs = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value) qs.set(name, value);
  }
  const queryString = qs.toString();
  if (queryString) internalUrl += `?${queryString}`;
  return worker.fetch(internalUrl, {
    method,
    headers: new Headers(headers),
    body,
  });
}

async function listBucketObjects(options: {
  workerName: string;
  prefix?: string;
  cursor?: string;
  limit?: number;
}): Promise<R2ListResponse> {
  const res = await dispatchR2Request({
    workerName: options.workerName,
    method: 'GET',
    query: {
      prefix: normalizePrefix(options.prefix),
      cursor: options.cursor || '',
      limit: String(options.limit || EXPLORER_PAGE_SIZE),
      delimiter: '/',
    },
  });

  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as R2ListResponse;
  if (!res.ok) {
    throw new Error(data.error || `R2 list failed: ${res.status}`);
  }
  return data;
}

async function getObjectResponse(workerName: string, key: string): Promise<Response> {
  const res = await dispatchR2Request({
    workerName,
    method: 'GET',
    key,
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(errorText || `R2 object request failed: ${res.status}`);
  }
  return res;
}

// -- R2 Gateway Worker Script ----------------------------------------
// Internal-only. Bindings: env.BUCKET
//
// Routes (RESTful -- natural for object storage):
//   GET    /                     -> list objects (query: prefix, limit, cursor, delimiter)
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
        const prefix = url.searchParams.get('prefix') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '100', 10);
        const cursor = url.searchParams.get('cursor') || undefined;
        const delimiter = url.searchParams.get('delimiter') || undefined;
        const result = await env.BUCKET.list({ prefix, limit, cursor, delimiter });
        return Response.json({
          success: true,
          objects: result.objects.map(o => ({ key: o.key, size: o.size, etag: o.etag, uploaded: o.uploaded })),
          truncated: result.truncated,
          cursor: result.cursor,
          delimitedPrefixes: result.delimitedPrefixes || [],
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

export async function getR2ExplorerData(): Promise<{
  currentPrefix: string;
  directories: Array<{ name: string; prefix: string }>;
  objects: ExplorerObject[];
  selectedObject: ExplorerObject | null;
  selectedPreview: string | null;
  selectedPreviewKind: 'none' | 'text' | 'image';
  nextCursor: string;
  listError: string | null;
}> {
  const { bucket } = await requireAuthAndBucket();
  const currentPrefix = normalizePrefix(searchParams.get('prefix'));
  const selectedKey = normalizeObjectKey(searchParams.get('selected'));
  const cursor = (searchParams.get('cursor') || '').trim();

  let directories: Array<{ name: string; prefix: string }> = [];
  let objects: ExplorerObject[] = [];
  let selectedObject: ExplorerObject | null = null;
  let selectedPreview: string | null = null;
  let selectedPreviewKind: 'none' | 'text' | 'image' = 'none';
  let nextCursor = '';
  let listError: string | null = null;

  try {
    const list = await listBucketObjects({
      workerName: bucket.workerName,
      prefix: currentPrefix,
      cursor,
      limit: EXPLORER_PAGE_SIZE,
    });

    directories = (list.delimitedPrefixes || []).map((prefix) => ({
      prefix,
      name: prefix.slice(currentPrefix.length).replace(/\/$/, '') || prefix,
    }));

    objects = (list.objects || []).map((object) => ({
      ...object,
      name: objectDisplayName(object.key, currentPrefix),
      contentType: null,
    }));

    if (list.truncated && list.cursor) {
      nextCursor = list.cursor;
    }

    if (selectedKey) {
      const current = objects.find((object) => object.key === selectedKey) || {
        key: selectedKey,
        name: objectDisplayName(selectedKey, currentPrefix),
        size: 0,
        etag: '',
        uploaded: '',
        contentType: null,
      };

      const res = await getObjectResponse(bucket.workerName, selectedKey);
      const size = Number(res.headers.get('x-r2-size') || current.size || 0);
      const contentType = res.headers.get('content-type');
      const uploaded = res.headers.get('x-r2-uploaded') || current.uploaded || '';
      const etag = res.headers.get('etag') || current.etag || '';

      selectedObject = {
        ...current,
        size,
        uploaded,
        etag,
        contentType,
      };

      if (contentType && contentType.startsWith('image/')) {
        selectedPreviewKind = 'image';
      } else if (isPreviewableText(contentType, size)) {
        selectedPreview = await res.text();
        selectedPreviewKind = 'text';
      }
    }
  } catch (error) {
    listError = error instanceof Error ? error.message : String(error);
  }

  return {
    currentPrefix,
    directories,
    objects,
    selectedObject,
    selectedPreview,
    selectedPreviewKind,
    nextCursor,
    listError,
  };
}

export async function proxyR2ObjectDownload(bucketId: string, key: string): Promise<Response> {
  const user = await requireAuth();
  const result = await db.r2Buckets.where({ id: bucketId, isActive: true, organizationId: user.organizationId }).first();
  const bucket = result.data as any;
  if (!bucket) {
    return new Response('R2 bucket not found', { status: 404 });
  }

  const res = await getObjectResponse(bucket.workerName, key);
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  if (!headers.get('content-disposition')) {
    const fileName = key.split('/').filter(Boolean).pop() || 'download';
    headers.set('content-disposition', `attachment; filename="${fileName.replace(/"/g, '')}"`);
  }
  return new Response(res.body, {
    status: res.status,
    headers,
  });
}

// -- Actions ---------------------------------------------------------

export async function uploadR2Object({ formData }: FormData): Promise<void> {
  const { bucket, id } = await requireAuthAndBucket();
  const prefix = normalizePrefix(formData.get('prefix') as string);
  const requestedKey = formData.get('objectKey') as string;
  const file = formData.get('file');
  if (!(file instanceof File)) throw new Error('Choose a file to upload');

  const targetKey = joinPrefixAndKey(prefix, requestedKey, file.name);
  if (!targetKey) throw new Error('Object key is required');

  const res = await dispatchR2Request({
    workerName: bucket.workerName,
    method: 'PUT',
    key: targetKey,
    headers: {
      'content-type': file.type || 'application/octet-stream',
    },
    body: await file.arrayBuffer(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `Upload failed: ${res.status}`);
  }

  redirect(buildExplorerHref(id, { prefix, selected: targetKey }));
}

export async function saveR2TextObject({ formData }: FormData): Promise<void> {
  const { bucket, id } = await requireAuthAndBucket();
  const prefix = normalizePrefix(formData.get('prefix') as string);
  const objectKey = formData.get('objectKey') as string;
  const content = String(formData.get('content') || '');
  const contentType = String(formData.get('contentType') || 'text/plain; charset=utf-8').trim();
  const targetKey = joinPrefixAndKey(prefix, objectKey);
  if (!targetKey) throw new Error('Object key is required');

  const res = await dispatchR2Request({
    workerName: bucket.workerName,
    method: 'PUT',
    key: targetKey,
    headers: {
      'content-type': contentType || 'text/plain; charset=utf-8',
    },
    body: content,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `Save failed: ${res.status}`);
  }

  redirect(buildExplorerHref(id, { prefix, selected: targetKey }));
}

export async function deleteR2Object({ formData }: FormData): Promise<void> {
  const { bucket, id } = await requireAuthAndBucket();
  const key = normalizeObjectKey(formData.get('key') as string);
  const prefix = normalizePrefix(formData.get('prefix') as string);
  if (!key) throw new Error('Object key is required');

  const res = await dispatchR2Request({
    workerName: bucket.workerName,
    method: 'DELETE',
    key,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `Delete failed: ${res.status}`);
  }

  redirect(buildExplorerHref(id, { prefix }));
}

// -- Create R2 bucket + deploy worker --------------------------------

export async function createR2Bucket({ formData }: FormData): Promise<void> {
  const user = await requireAuth();

  const name = (formData.get('name') as string)?.trim().toLowerCase();
  const locationHint = (formData.get('locationHint') as string)?.trim() || null;
  if (!name) throw new Error('Bucket name is required');
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error('Name must contain only lowercase letters, numbers, and hyphens');
  }

  const { accountId, apiToken, gatewayKey, namespace } = getEnvVars();

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

  const r2Token = await generateDbToken(name, gatewayKey);
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
  redirect(`/r2/${id}`);
}

// -- Delete R2 bucket ------------------------------------------------

export async function deleteR2Bucket({ formData }: FormData): Promise<void> {
  const user = await requireAuth();

  const id = formData.get('id') as string;
  if (!id) throw new Error('ID is required');

  const result = await db.r2Buckets.where({ id, organizationId: user.organizationId }).first();
  const record = result.data as any;
  if (!record) throw new Error('R2 bucket not found');

  const { accountId, apiToken, namespace } = getEnvVars();

  if (record.workerName) {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${namespace}/scripts/${record.workerName}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` } }
    ).catch((err) => console.warn('[deleteR2] worker removal failed:', err));
  }

  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/kdb-${record.name}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` } }
  ).catch((err) => console.warn('[deleteR2] bucket deletion failed:', err));

  await db.r2ApiTokens.where({ r2BucketId: id }).delete();
  await db.r2Buckets.where({ id }).delete();

  logActivity({ action: 'r2.delete', userId: user.id, organizationId: user.organizationId, data: { name: record.name, r2BucketId: id } });
  redirect('/r2');
}
