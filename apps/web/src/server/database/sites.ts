import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';
import { redirect } from '@kuratchi/js';
import { getCurrentUser } from './auth';
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
  const namespace = (env as any).DISPATCH_NAMESPACE as string;
  if (!accountId || !apiToken || !namespace) {
    throw new Error('Missing required env vars: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, DISPATCH_NAMESPACE');
  }
  return { accountId, apiToken, namespace };
}



const SITE_WORKER_SCRIPT = `
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};
`;

async function hashFile(siteId: string, data: ArrayBuffer): Promise<string> {
  // Per CF docs: incorporate site ID to ensure asset isolation across sites
  const enc = new TextEncoder();
  const prefix = enc.encode(siteId);
  const combined = new Uint8Array(prefix.byteLength + data.byteLength);
  combined.set(prefix, 0);
  combined.set(new Uint8Array(data), prefix.byteLength);
  const digest = await crypto.subtle.digest('SHA-256', combined);
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 32);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function guessContentType(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    txt: 'text/plain; charset=utf-8',
    pdf: 'application/pdf',
    wasm: 'application/wasm',
  };
  return types[ext || ''] || 'application/octet-stream';
}

// Queries

export async function getSites() {
  const user = await requireAuth();
  const result = await db.sites.where({ isActive: true, organizationId: user.organizationId }).many();
  return (result.data ?? []) as any[];
}

export async function getSite(id: string) {
  const user = await requireAuth();
  const result = await db.sites.where({ id, isActive: true, organizationId: user.organizationId }).first();
  return (result.data ?? null) as any;
}

export async function getSiteFiles(siteId: string) {
  const user = await requireAuth();
  const site = await db.sites.where({ id: siteId, organizationId: user.organizationId }).first();
  if (!site.data) throw new Error('Site not found');
  const result = await db.siteFiles.where({ siteId }).many();
  return (result.data ?? []) as any[];
}

export async function createSite(formData: FormData): Promise<void> {
  const user = await requireAuth();

  const name = (formData.get('name') as string)?.trim().toLowerCase();
  if (!name) throw new Error('Site name is required');
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error('Name must contain only lowercase letters, numbers, and hyphens');
  }

  const id = crypto.randomUUID();
  const workerName = `ksite-${id.replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  await db.sites.insert({
    id,
    name,
    workerName,
    customDomain: null,
    isActive: true,
    fileCount: 0,
    totalSize: 0,
    createdBy: user.id,
    organizationId: user.organizationId,
    created_at: now,
    updated_at: now,
  });

  logActivity({ action: 'site.create', userId: user.id, organizationId: user.organizationId, data: { name, siteId: id } });

  redirect(`/sites/${id}`);
}

export async function uploadSiteFiles(formData: FormData): Promise<void> {
  const user = await requireAuth();

  const siteId = formData.get('siteId') as string;
  if (!siteId) throw new Error('Site ID is required');

  const site = await db.sites.where({ id: siteId, organizationId: user.organizationId }).first();
  if (!site.data) throw new Error('Site not found');
  const siteRecord = site.data as any;

  // Collect all uploaded files
  const fileEntries: { path: string; data: ArrayBuffer; contentType: string; size: number }[] = [];
  const files = formData.getAll('file') as File[];
  const paths = formData.getAll('path') as string[];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file || file.size === 0) continue;
    let filePath = (paths[i] || file.name || '').trim();
    if (!filePath.startsWith('/')) filePath = '/' + filePath;
    filePath = filePath.replace(/\/\/+/g, '/');
    if (filePath === '/') throw new Error('File path cannot be root');

    fileEntries.push({
      path: filePath,
      data: await file.arrayBuffer(),
      contentType: file.type || guessContentType(filePath),
      size: file.size,
    });
  }

  if (fileEntries.length === 0) throw new Error('At least one file is required');

  const { accountId, apiToken, namespace } = getEnvVars();

  // Build manifest: { "/path": { hash, size } }
  const manifest: Record<string, { hash: string; size: number }> = {};
  const hashToData: Map<string, ArrayBuffer> = new Map();

  // Include existing files in manifest so they're preserved
  const existingFiles = await db.siteFiles.where({ siteId }).many();
  const existingMap = new Map<string, any>();
  for (const ef of (existingFiles.data ?? []) as any[]) {
    existingMap.set(ef.path, ef);
    if (!fileEntries.some(f => f.path === ef.path)) {
      manifest[ef.path] = { hash: ef.hash, size: ef.size };
    }
  }

  for (const entry of fileEntries) {
    const hash = await hashFile(siteId, entry.data);
    manifest[entry.path] = { hash, size: entry.size };
    hashToData.set(hash, entry.data);
  }

  // Step 1: Create upload session
  const sessionRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${namespace}/scripts/${siteRecord.workerName}/assets-upload-session`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ manifest }),
    }
  );

  if (!sessionRes.ok) {
    const errText = await sessionRes.text();
    throw new Error(`Upload session failed: ${sessionRes.status} ${errText}`);
  }

  const sessionData = (await sessionRes.json()) as any;
  const uploadJwt = sessionData.result?.jwt;
  const buckets: string[][] = sessionData.result?.buckets ?? [];

  // Step 2: Upload file contents for each bucket
  let completionToken = uploadJwt;

  for (const bucket of buckets) {
    const uploadForm = new FormData();
    for (const hash of bucket) {
      const data = hashToData.get(hash);
      if (!data) continue;
      uploadForm.append(hash, arrayBufferToBase64(data));
    }

    const uploadRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/assets/upload?base64=true`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${uploadJwt}` },
        body: uploadForm,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`File upload failed: ${uploadRes.status} ${errText}`);
    }

    // Last upload returns completion token with status 201
    if (uploadRes.status === 201) {
      const uploadData = (await uploadRes.json()) as any;
      completionToken = uploadData.result?.jwt || completionToken;
    }
  }

  // Step 3: Deploy the worker with static assets
  const deployForm = new FormData();
  deployForm.append('metadata', JSON.stringify({
    main_module: 'worker.js',
    assets: {
      jwt: completionToken,
      config: {
        html_handling: 'auto-trailing-slash',
      },
    },
    compatibility_date: '2026-03-07',
    compatibility_flags: ['nodejs_compat'],
  }));
  deployForm.append(
    'worker.js',
    new File([SITE_WORKER_SCRIPT], 'worker.js', { type: 'application/javascript+module' })
  );

  const deployRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${namespace}/scripts/${siteRecord.workerName}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: deployForm,
    }
  );

  if (!deployRes.ok) {
    const err = await deployRes.text();
    throw new Error(`Deploy failed: ${deployRes.status} ${err}`);
  }

  // Step 4: Update file records in admin DB
  const now = new Date().toISOString();

  for (const entry of fileEntries) {
    const hash = manifest[entry.path].hash;
    const existing = existingMap.get(entry.path);

    if (existing) {
      await db.siteFiles.where({ id: existing.id }).update({
        hash,
        contentType: entry.contentType,
        size: entry.size,
        updated_at: now,
      });
    } else {
      await db.siteFiles.insert({
        id: crypto.randomUUID(),
        siteId,
        path: entry.path,
        hash,
        contentType: entry.contentType,
        size: entry.size,
        created_at: now,
        updated_at: now,
      });
    }
  }

  // Update site totals
  const allFiles = await db.siteFiles.where({ siteId }).many();
  const allFileList = (allFiles.data ?? []) as any[];
  const totalSize = allFileList.reduce((sum: number, f: any) => sum + (f.size || 0), 0);
  await db.sites.where({ id: siteId }).update({
    fileCount: allFileList.length,
    totalSize,
    updated_at: now,
  });

  logActivity({
    action: 'site.upload',
    userId: user.id,
    organizationId: user.organizationId,
    data: { siteId, files: fileEntries.map(f => f.path), count: fileEntries.length },
  });

  redirect(`/sites/${siteId}`);
}

export async function deleteSiteFile(formData: FormData): Promise<void> {
  const user = await requireAuth();

  const siteId = formData.get('siteId') as string;
  const fileId = formData.get('fileId') as string;
  if (!siteId || !fileId) throw new Error('Site ID and File ID are required');

  const site = await db.sites.where({ id: siteId, organizationId: user.organizationId }).first();
  if (!site.data) throw new Error('Site not found');
  const siteRecord = site.data as any;

  const fileResult = await db.siteFiles.where({ id: fileId, siteId }).first();
  if (!fileResult.data) throw new Error('File not found');
  const fileRecord = fileResult.data as any;

  // Delete the DB record
  await db.siteFiles.where({ id: fileId }).delete();

  // Rebuild manifest without deleted file and re-deploy
  const remaining = await db.siteFiles.where({ siteId }).many();
  const remainingFiles = (remaining.data ?? []) as any[];

  const { accountId, apiToken, namespace } = getEnvVars();

  if (remainingFiles.length > 0) {
    const manifest: Record<string, { hash: string; size: number }> = {};
    for (const f of remainingFiles) {
      manifest[f.path] = { hash: f.hash, size: f.size };
    }

    // All files already uploaded, so no buckets expected
    const sessionRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${namespace}/scripts/${siteRecord.workerName}/assets-upload-session`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ manifest }),
      }
    );

    if (sessionRes.ok) {
      const sessionData = (await sessionRes.json()) as any;
      const completionToken = sessionData.result?.jwt;

      if (completionToken) {
        const deployForm = new FormData();
        deployForm.append('metadata', JSON.stringify({
          main_module: 'worker.js',
          assets: {
            jwt: completionToken,
            config: { html_handling: 'auto-trailing-slash' },
          },
          compatibility_date: '2026-03-07',
          compatibility_flags: ['nodejs_compat'],
        }));
        deployForm.append(
          'worker.js',
          new File([SITE_WORKER_SCRIPT], 'worker.js', { type: 'application/javascript+module' })
        );

        await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${namespace}/scripts/${siteRecord.workerName}`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${apiToken}` },
            body: deployForm,
          }
        );
      }
    }
  }

  // Update totals
  const now = new Date().toISOString();
  const totalSize = remainingFiles.reduce((sum: number, f: any) => sum + (f.size || 0), 0);
  await db.sites.where({ id: siteId }).update({
    fileCount: remainingFiles.length,
    totalSize,
    updated_at: now,
  });

  logActivity({ action: 'site.deleteFile', userId: user.id, organizationId: user.organizationId, data: { siteId, path: fileRecord.path } });

  redirect(`/sites/${siteId}`);
}

export async function deleteSite(formData: FormData): Promise<void> {
  const user = await requireAuth();

  const id = formData.get('id') as string;
  if (!id) throw new Error('Site ID is required');

  const result = await db.sites.where({ id, organizationId: user.organizationId }).first();
  const record = result.data as any;
  if (!record) throw new Error('Site not found');

  const { accountId, apiToken, namespace } = getEnvVars();

  // Delete dispatch worker (also removes associated static assets)
  if (record.workerName) {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${namespace}/scripts/${record.workerName}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` } }
    ).catch((err) => console.warn('[deleteSite] worker removal failed:', err));
  }

  await db.siteFiles.where({ siteId: id }).delete();
  await db.sites.where({ id }).delete();

  logActivity({ action: 'site.delete', userId: user.id, organizationId: user.organizationId, data: { name: record.name, siteId: id } });

  redirect('/sites');
}

export async function dispatchSiteRequest(workerName: string, request: Request): Promise<Response> {
  const dispatcher = (env as any).DISPATCHER;
  if (!dispatcher) {
    throw new Error('DISPATCHER binding not available');
  }
  const userWorker = dispatcher.get(workerName);
  return userWorker.fetch(request);
}
