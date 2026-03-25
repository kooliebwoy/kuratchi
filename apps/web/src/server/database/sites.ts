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

function getPreviewDomain(): string {
  return String((env as any).SITE_PREVIEW_DOMAIN || 'kuratchi.site').trim().toLowerCase();
}

function normalizeHostname(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}

export function getSitePreviewUrl(site: { name?: string | null; customDomain?: string | null } | null | undefined): string | null {
  if (!site) return null;
  const customDomain = normalizeHostname(site.customDomain);
  if (customDomain) return `https://${customDomain}`;
  const name = String(site.name || '').trim().toLowerCase();
  if (!name) return null;
  return `https://${name}.${getPreviewDomain()}`;
}

async function findSiteByHostname(hostname: string) {
  const host = normalizeHostname(hostname);
  if (!host) return null;

  const customDomainMatch = await db.sites.where({ customDomain: host, isActive: true }).first();
  if (customDomainMatch.data) return customDomainMatch.data as any;

  const previewDomain = getPreviewDomain();
  const suffix = `.${previewDomain}`;
  if (!previewDomain || !host.endsWith(suffix)) return null;

  const siteName = host.slice(0, -suffix.length);
  if (!siteName || siteName.includes('.')) return null;

  const result = await db.sites.where({ name: siteName, isActive: true }).first();
  return (result.data ?? null) as any;
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

function normalizeSiteFilePath(input: string): string {
  let value = String(input || '').trim();
  value = value.replace(/\\/g, '/');
  value = value.replace(/^\.\//, '');
  value = value.replace(/^\/+/, '');
  value = value.replace(/\/+/g, '/');

  const segments = value
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const safeSegments: string[] = [];
  for (const segment of segments) {
    if (segment === '.' || segment === '..') continue;
    safeSegments.push(segment);
  }

  if (safeSegments.length === 0) {
    throw new Error('File path cannot be empty');
  }

  return `/${safeSegments.join('/')}`;
}

function normalizeRelativeUploadPath(input: string): string {
  return String(input || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/');
}

function getDirectoryUploadRoot(paths: string[]): string {
  const normalizedPaths = paths
    .map(normalizeRelativeUploadPath)
    .filter(Boolean);

  if (normalizedPaths.length === 0) return '';

  const firstSegments = normalizedPaths
    .map((path) => path.split('/').filter(Boolean)[0] || '')
    .filter(Boolean);

  if (firstSegments.length !== normalizedPaths.length) return '';

  const rootSegment = firstSegments[0];
  if (!rootSegment || firstSegments.some((segment) => segment !== rootSegment)) return '';
  if (normalizedPaths.some((path) => !path.includes('/'))) return '';

  return rootSegment;
}

function sortByNewest<T extends { updated_at?: string | null; created_at?: string | null }>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    const left = new Date(b.updated_at || b.created_at || 0).getTime();
    const right = new Date(a.updated_at || a.created_at || 0).getTime();
    return left - right;
  });
}

function sumFileSizes(files: Array<{ size?: number | null }>): number {
  return files.reduce((sum, file) => sum + Number(file.size || 0), 0);
}

async function deploySiteManifest(
  siteRecord: { workerName: string },
  manifest: Record<string, { hash: string; size: number }>,
  hashToData: Map<string, ArrayBuffer> = new Map(),
): Promise<void> {
  const { accountId, apiToken, namespace } = getEnvVars();

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

    if (uploadRes.status === 201) {
      const uploadData = (await uploadRes.json()) as any;
      completionToken = uploadData.result?.jwt || completionToken;
    }
  }

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
}

async function getSiteFilesForRecord(siteId: string): Promise<any[]> {
  const result = await db.siteFiles.where({ siteId }).many();
  return sortByNewest((result.data ?? []) as any[]);
}

async function updateSiteTotals(siteId: string, now: string): Promise<any[]> {
  const allFileList = await getSiteFilesForRecord(siteId);
  await db.sites.where({ id: siteId }).update({
    fileCount: allFileList.length,
    totalSize: sumFileSizes(allFileList),
    updated_at: now,
  });
  return allFileList;
}

async function recordSiteUpload(options: {
  siteId: string;
  organizationId: string;
  uploadedBy: string;
  uploadMode: string;
  pathPrefix: string | null;
  fileCount: number;
  totalSize: number;
  addedCount: number;
  overwrittenCount: number;
  createdAt: string;
}): Promise<void> {
  await db.siteUploads.insert({
    id: crypto.randomUUID(),
    siteId: options.siteId,
    organizationId: options.organizationId,
    uploadedBy: options.uploadedBy,
    uploadMode: options.uploadMode,
    pathPrefix: options.pathPrefix,
    fileCount: options.fileCount,
    totalSize: options.totalSize,
    addedCount: options.addedCount,
    overwrittenCount: options.overwrittenCount,
    created_at: options.createdAt,
    updated_at: options.createdAt,
  });
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
  return getSiteFilesForRecord(siteId);
}

export async function getSiteUploads(siteId: string) {
  const user = await requireAuth();
  const site = await db.sites.where({ id: siteId, organizationId: user.organizationId }).first();
  if (!site.data) throw new Error('Site not found');
  const result = await db.siteUploads.where({ siteId }).many();
  return sortByNewest((result.data ?? []) as any[]).slice(0, 10);
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
  const pathPrefixRaw = (formData.get('pathPrefix') as string | null)?.trim() || '';
  const normalizedPrefix = pathPrefixRaw
    ? normalizeSiteFilePath(pathPrefixRaw).replace(/^\/+/, '').replace(/\/+$/, '')
    : '';
  const uploadPaths = files.map((file, index) => {
    const browserRelativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || '';
    const submittedPath = String(paths[index] || '').trim();
    return submittedPath || browserRelativePath || file.name || '';
  });
  const directoryRoot = getDirectoryUploadRoot(uploadPaths);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file || file.size === 0) continue;
    let rawFilePath = uploadPaths[i] || '';
    if (directoryRoot && rawFilePath.startsWith(`${directoryRoot}/`)) {
      rawFilePath = rawFilePath.slice(directoryRoot.length + 1);
    }
    const prefixedPath = normalizedPrefix ? `${normalizedPrefix}/${rawFilePath}` : rawFilePath;
    const filePath = normalizeSiteFilePath(prefixedPath);

    fileEntries.push({
      path: filePath,
      data: await file.arrayBuffer(),
      contentType: file.type || guessContentType(filePath),
      size: file.size,
    });
  }

  if (fileEntries.length === 0) throw new Error('At least one file is required');

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
  await deploySiteManifest(siteRecord, manifest, hashToData);

  // Step 4: Update file records in admin DB
  const now = new Date().toISOString();
  const addedCount = fileEntries.filter((entry) => !existingMap.has(entry.path)).length;
  const overwrittenCount = fileEntries.length - addedCount;
  const uploadMode = directoryRoot ? 'folder' : 'files';
  const uploadSize = sumFileSizes(fileEntries);

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

  await recordSiteUpload({
    siteId,
    organizationId: user.organizationId,
    uploadedBy: user.id,
    uploadMode,
    pathPrefix: normalizedPrefix || null,
    fileCount: fileEntries.length,
    totalSize: uploadSize,
    addedCount,
    overwrittenCount,
    createdAt: now,
  });

  await updateSiteTotals(siteId, now);

  logActivity({
    action: 'site.upload',
    userId: user.id,
    organizationId: user.organizationId,
    data: {
      siteId,
      files: fileEntries.map(f => f.path),
      count: fileEntries.length,
      addedCount,
      overwrittenCount,
      uploadMode,
      pathPrefix: normalizedPrefix || null,
    },
  });

  redirect(`/sites/${siteId}`);
}

export async function deleteSiteFiles(formData: FormData): Promise<void> {
  const user = await requireAuth();

  const siteId = formData.get('siteId') as string;
  const targetFileId = String(formData.get('targetFileId') || '').trim();
  const selectedFileIds = formData
    .getAll('fileIds')
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const fileIds = Array.from(new Set(targetFileId ? [targetFileId] : selectedFileIds));
  if (!siteId || fileIds.length === 0) throw new Error('Select at least one file to delete');

  const site = await db.sites.where({ id: siteId, organizationId: user.organizationId }).first();
  if (!site.data) throw new Error('Site not found');
  const siteRecord = site.data as any;

  const deletedFiles: any[] = [];
  for (const fileId of fileIds) {
    const fileResult = await db.siteFiles.where({ id: fileId, siteId }).first();
    if (!fileResult.data) continue;
    deletedFiles.push(fileResult.data);
    await db.siteFiles.where({ id: fileId }).delete();
  }

  if (deletedFiles.length === 0) throw new Error('No matching files were found');

  const remainingFiles = await getSiteFilesForRecord(siteId);
  const manifest: Record<string, { hash: string; size: number }> = {};
  for (const file of remainingFiles) {
    manifest[file.path] = { hash: file.hash, size: file.size };
  }

  await deploySiteManifest(siteRecord, manifest);

  // Update totals
  const now = new Date().toISOString();
  await updateSiteTotals(siteId, now);

  logActivity({
    action: deletedFiles.length === 1 ? 'site.deleteFile' : 'site.deleteFiles',
    userId: user.id,
    organizationId: user.organizationId,
    data: {
      siteId,
      count: deletedFiles.length,
      paths: deletedFiles.map((file) => file.path),
    },
  });

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

export async function resolveSiteRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const site = await findSiteByHostname(url.hostname);
  if (!site?.workerName) return null;
  return dispatchSiteRequest(site.workerName, request);
}
