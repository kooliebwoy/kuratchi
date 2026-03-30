import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';
import { redirect } from '@kuratchi/js';
import { getCurrentUser } from './auth';
import { logActivity } from './audit';

const db = kuratchiORM(() => (env as any).DB);

type SiteRecord = {
  id: string;
  name: string;
  workerName?: string | null;
  customDomain?: string | null;
  isActive?: boolean | null;
  organizationId?: string | null;
};

type SiteDomainRecord = {
  id: string;
  siteId: string;
  hostname: string;
  cloudflareHostnameId?: string | null;
  cnameTarget?: string | null;
  verificationMethod?: string | null;
  hostnameStatus?: string | null;
  sslStatus?: string | null;
  connectionStatus?: string | null;
  verificationErrors?: string[] | null;
  ownershipVerification?: any[] | null;
  ownershipVerificationHttp?: Record<string, any> | null;
  sslVerificationRecords?: any[] | null;
  sslValidationErrors?: string[] | null;
  lastCheckedAt?: string | null;
  organizationId?: string | null;
  createdBy?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Actor = {
  userId: string | null;
  organizationId: string;
  interactive: boolean;
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

async function requireInteractiveActor(): Promise<Actor> {
  const user = await requireAuth();
  return {
    userId: user.id,
    organizationId: user.organizationId,
    interactive: true,
  };
}

function getPlatformEnvVars() {
  const accountId = String((env as any).CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = String((env as any).CLOUDFLARE_API_TOKEN || '').trim();
  const namespace = String((env as any).DISPATCH_NAMESPACE || '').trim();
  if (!accountId || !apiToken || !namespace) {
    throw new Error('Missing required env vars: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, DISPATCH_NAMESPACE');
  }
  return { accountId, apiToken, namespace };
}

function getCustomHostnameZoneId(): string {
  const zoneId = String(
    (env as any).SITE_CUSTOM_HOSTNAMES_ZONE_ID ||
    (env as any).CLOUDFLARE_ZONE_ID ||
    ''
  ).trim();
  if (!zoneId) {
    throw new Error('Missing required env var: SITE_CUSTOM_HOSTNAMES_ZONE_ID');
  }
  return zoneId;
}

function getPreviewDomain(): string {
  return String((env as any).SITE_PREVIEW_DOMAIN || 'kuratchi.site').trim().toLowerCase();
}

function normalizeHostname(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.+$/, '');
}

function getCustomHostnameTarget(site: { name?: string | null }): string {
  const configuredTarget = normalizeHostname((env as any).SITE_CUSTOM_HOSTNAME_TARGET);
  if (configuredTarget.includes('*')) {
    return configuredTarget.replace('*', String(site.name || '').trim().toLowerCase());
  }
  if (configuredTarget) return configuredTarget;
  const siteName = String(site.name || '').trim().toLowerCase();
  return `${siteName}.${getPreviewDomain()}`;
}

function parseJsonArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject(value: unknown): Record<string, any> | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, any> : null;
    } catch {
      return null;
    }
  }
  return null;
}

function flattenMessages(items: unknown): string[] {
  return parseJsonArray(items)
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && typeof (item as any).message === 'string') {
        return String((item as any).message).trim();
      }
      return '';
    })
    .filter(Boolean);
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function summarizeConnectionStatus(hostnameStatus: string, sslStatus: string, verificationErrors: string[]): string {
  if (hostnameStatus === 'active' && sslStatus === 'active') return 'connected';
  if (verificationErrors.length > 0) return 'attention';
  if (!hostnameStatus && !sslStatus) return 'pending';
  if (
    hostnameStatus.includes('blocked') ||
    hostnameStatus.includes('failed') ||
    hostnameStatus === 'moved' ||
    hostnameStatus === 'deleted' ||
    sslStatus.includes('timed_out') ||
    sslStatus === 'inactive' ||
    sslStatus === 'deleted' ||
    sslStatus === 'expired'
  ) {
    return 'error';
  }
  return 'pending';
}

function normalizeSiteDomainRecord(record: any): SiteDomainRecord {
  const hostnameStatus = String(record?.status || record?.hostnameStatus || '').trim();
  const sslStatus = String(record?.ssl?.status || record?.sslStatus || '').trim();
  const verificationErrors = dedupeStrings([
    ...flattenMessages(record?.verification_errors || record?.verificationErrors),
    ...flattenMessages(record?.ssl?.validation_errors || record?.sslValidationErrors),
  ]);

  return {
    id: String(record?.id || crypto.randomUUID()),
    siteId: String(record?.siteId || ''),
    hostname: normalizeHostname(record?.hostname),
    cloudflareHostnameId: String(record?.cloudflareHostnameId || record?.id || '').trim() || null,
    cnameTarget: normalizeHostname(record?.cnameTarget || getCustomHostnameTarget(record || {})) || null,
    verificationMethod: String(record?.ssl?.method || record?.verificationMethod || 'txt').trim() || 'txt',
    hostnameStatus: hostnameStatus || null,
    sslStatus: sslStatus || null,
    connectionStatus: summarizeConnectionStatus(hostnameStatus, sslStatus, verificationErrors),
    verificationErrors,
    ownershipVerification: parseJsonArray(record?.ownership_verification || record?.ownershipVerification),
    ownershipVerificationHttp: parseJsonObject(record?.ownership_verification_http || record?.ownershipVerificationHttp),
    sslVerificationRecords: parseJsonArray(record?.ssl?.validation_records || record?.sslVerificationRecords),
    sslValidationErrors: flattenMessages(record?.ssl?.validation_errors || record?.sslValidationErrors),
    lastCheckedAt: record?.lastCheckedAt || new Date().toISOString(),
    organizationId: record?.organizationId || null,
    createdBy: record?.createdBy || null,
    created_at: record?.created_at || null,
    updated_at: record?.updated_at || null,
  };
}

function getConnectedPrimaryDomain(domains: SiteDomainRecord[]): string | null {
  const connected = domains.find((domain) => domain.connectionStatus === 'connected');
  return connected?.hostname || null;
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

  const customDomainResult = await db.siteDomains.where({ hostname: host }).many();
  const customDomain = ((customDomainResult.data ?? []) as any[])
    .map(normalizeSiteDomainRecord)
    .find((record) => record.hostname === host);

  if (customDomain?.siteId) {
    const result = await db.sites.where({ id: customDomain.siteId, isActive: true }).first();
    if (result.data) return result.data as any;
  }

  const legacyCustomDomainMatch = await db.sites.where({ customDomain: host, isActive: true }).first();
  if (legacyCustomDomainMatch.data) return legacyCustomDomainMatch.data as any;

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
  const enc = new TextEncoder();
  const prefix = enc.encode(siteId);
  const combined = new Uint8Array(prefix.byteLength + data.byteLength);
  combined.set(prefix, 0);
  combined.set(new Uint8Array(data), prefix.byteLength);
  const digest = await crypto.subtle.digest('SHA-256', combined);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 32);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
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

  const safeSegments = value
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => segment !== '.' && segment !== '..');

  if (safeSegments.length === 0) throw new Error('File path cannot be empty');
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
  const normalizedPaths = paths.map(normalizeRelativeUploadPath).filter(Boolean);
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
  const { accountId, apiToken, namespace } = getPlatformEnvVars();

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
    const errText = await deployRes.text();
    throw new Error(`Deploy failed: ${deployRes.status} ${errText}`);
  }
}

async function cloudflareRequest(path: string, init: RequestInit = {}) {
  const { apiToken } = getPlatformEnvVars();
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok || body.success === false) {
    const errors = Array.isArray(body?.errors)
      ? body.errors.map((item: any) => item?.message || item?.code || '').filter(Boolean)
      : [];
    throw new Error(errors[0] || `Cloudflare request failed: ${response.status}`);
  }

  return body.result;
}

async function createCloudflareCustomHostname(hostname: string) {
  const zoneId = getCustomHostnameZoneId();
  return cloudflareRequest(`/zones/${zoneId}/custom_hostnames`, {
    method: 'POST',
    body: JSON.stringify({
      hostname,
      ssl: {
        method: 'txt',
        type: 'dv',
      },
    }),
  });
}

async function getCloudflareCustomHostname(customHostnameId: string) {
  const zoneId = getCustomHostnameZoneId();
  return cloudflareRequest(`/zones/${zoneId}/custom_hostnames/${customHostnameId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
}

async function deleteCloudflareCustomHostname(customHostnameId: string) {
  const zoneId = getCustomHostnameZoneId();
  return cloudflareRequest(`/zones/${zoneId}/custom_hostnames/${customHostnameId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
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
  uploadedBy: string | null;
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

async function getSiteRecordForActor(siteId: string, actor: Actor): Promise<SiteRecord> {
  const result = await db.sites.where({ id: siteId, organizationId: actor.organizationId }).first();
  if (!result.data) throw new Error('Site not found');
  return result.data as SiteRecord;
}

async function getSiteDomainRecords(siteId: string): Promise<SiteDomainRecord[]> {
  const result = await db.siteDomains.where({ siteId }).many();
  return sortByNewest((result.data ?? []) as any[]).map(normalizeSiteDomainRecord);
}

async function syncPrimaryCustomDomain(siteId: string, now = new Date().toISOString()): Promise<SiteDomainRecord[]> {
  const domains = await getSiteDomainRecords(siteId);
  const primaryDomain = getConnectedPrimaryDomain(domains);
  await db.sites.where({ id: siteId }).update({
    customDomain: primaryDomain,
    updated_at: now,
  });
  return domains;
}

async function upsertSiteDomainFromCloudflare(site: SiteRecord, record: any, actor: Actor): Promise<SiteDomainRecord> {
  const normalized = normalizeSiteDomainRecord({
    ...record,
    siteId: site.id,
    organizationId: actor.organizationId,
    createdBy: actor.userId,
    cnameTarget: getCustomHostnameTarget(site),
  });
  const now = new Date().toISOString();

  const existingByCloudflareId = normalized.cloudflareHostnameId
    ? await db.siteDomains.where({ cloudflareHostnameId: normalized.cloudflareHostnameId }).first()
    : { data: null };
  const existingByHostname = await db.siteDomains.where({ hostname: normalized.hostname }).first();
  const existing = (existingByCloudflareId.data || existingByHostname.data) as any;

  const payload = {
    siteId: site.id,
    organizationId: actor.organizationId,
    hostname: normalized.hostname,
    cloudflareHostnameId: normalized.cloudflareHostnameId,
    cnameTarget: normalized.cnameTarget,
    verificationMethod: normalized.verificationMethod,
    hostnameStatus: normalized.hostnameStatus,
    sslStatus: normalized.sslStatus,
    connectionStatus: normalized.connectionStatus,
    verificationErrors: normalized.verificationErrors,
    ownershipVerification: normalized.ownershipVerification,
    ownershipVerificationHttp: normalized.ownershipVerificationHttp,
    sslVerificationRecords: normalized.sslVerificationRecords,
    sslValidationErrors: normalized.sslValidationErrors,
    lastCheckedAt: normalized.lastCheckedAt || now,
    createdBy: existing?.createdBy || actor.userId,
    updated_at: now,
  };

  if (existing?.id) {
    await db.siteDomains.where({ id: existing.id }).update(payload);
  } else {
    await db.siteDomains.insert({
      id: crypto.randomUUID(),
      ...payload,
      created_at: now,
    });
  }

  const domains = await syncPrimaryCustomDomain(site.id, now);
  return domains.find((domain) => domain.hostname === normalized.hostname) || normalizeSiteDomainRecord(payload);
}

async function createSiteRecord(name: string, actor: Actor): Promise<SiteRecord> {
  const normalizedName = String(name || '').trim().toLowerCase();
  if (!normalizedName) throw new Error('Site name is required');
  if (!/^[a-z0-9-]+$/.test(normalizedName)) {
    throw new Error('Name must contain only lowercase letters, numbers, and hyphens');
  }

  const existing = await db.sites.where({ name: normalizedName, isActive: true, organizationId: actor.organizationId }).first();
  if (existing.data) throw new Error('A site with this name already exists');

  const id = crypto.randomUUID();
  const workerName = `ksite-${id.replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  await db.sites.insert({
    id,
    name: normalizedName,
    workerName,
    customDomain: null,
    isActive: true,
    fileCount: 0,
    totalSize: 0,
    createdBy: actor.userId,
    organizationId: actor.organizationId,
    created_at: now,
    updated_at: now,
  });

  logActivity({
    action: 'site.create',
    userId: actor.userId,
    organizationId: actor.organizationId,
    data: { name: normalizedName, siteId: id },
  });

  return {
    id,
    name: normalizedName,
    workerName,
    customDomain: null,
    isActive: true,
    organizationId: actor.organizationId,
  };
}

async function uploadSiteFilesForActor(formData: FormData, actor: Actor): Promise<void> {
  const siteId = String(formData.get('siteId') || '').trim();
  if (!siteId) throw new Error('Site ID is required');

  const siteRecord = await getSiteRecordForActor(siteId, actor);

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

  const manifest: Record<string, { hash: string; size: number }> = {};
  const hashToData = new Map<string, ArrayBuffer>();

  const existingFiles = await db.siteFiles.where({ siteId }).many();
  const existingMap = new Map<string, any>();
  for (const existingFile of (existingFiles.data ?? []) as any[]) {
    existingMap.set(existingFile.path, existingFile);
    if (!fileEntries.some((entry) => entry.path === existingFile.path)) {
      manifest[existingFile.path] = { hash: existingFile.hash, size: existingFile.size };
    }
  }

  for (const entry of fileEntries) {
    const hash = await hashFile(siteId, entry.data);
    manifest[entry.path] = { hash, size: entry.size };
    hashToData.set(hash, entry.data);
  }

  await deploySiteManifest({ workerName: String(siteRecord.workerName || '') }, manifest, hashToData);

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
    organizationId: actor.organizationId,
    uploadedBy: actor.userId,
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
    userId: actor.userId,
    organizationId: actor.organizationId,
    data: {
      siteId,
      files: fileEntries.map((file) => file.path),
      count: fileEntries.length,
      addedCount,
      overwrittenCount,
      uploadMode,
      pathPrefix: normalizedPrefix || null,
    },
  });
}

async function deleteSiteFilesForActor(formData: FormData, actor: Actor): Promise<void> {
  const siteId = String(formData.get('siteId') || '').trim();
  const targetFileId = String(formData.get('targetFileId') || '').trim();
  const selectedFileIds = formData
    .getAll('fileIds')
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const fileIds = Array.from(new Set(targetFileId ? [targetFileId] : selectedFileIds));
  if (!siteId || fileIds.length === 0) throw new Error('Select at least one file to delete');

  const siteRecord = await getSiteRecordForActor(siteId, actor);

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

  await deploySiteManifest({ workerName: String(siteRecord.workerName || '') }, manifest);

  const now = new Date().toISOString();
  await updateSiteTotals(siteId, now);

  logActivity({
    action: deletedFiles.length === 1 ? 'site.deleteFile' : 'site.deleteFiles',
    userId: actor.userId,
    organizationId: actor.organizationId,
    data: {
      siteId,
      count: deletedFiles.length,
      paths: deletedFiles.map((file) => file.path),
    },
  });
}

async function deleteSiteForActor(siteId: string, actor: Actor): Promise<void> {
  if (!siteId) throw new Error('Site ID is required');

  const record = await getSiteRecordForActor(siteId, actor);
  const { accountId, apiToken, namespace } = getPlatformEnvVars();

  const domains = await getSiteDomainRecords(siteId);
  for (const domain of domains) {
    if (!domain.cloudflareHostnameId) continue;
    await deleteCloudflareCustomHostname(domain.cloudflareHostnameId).catch(() => null);
  }

  if (record.workerName) {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${namespace}/scripts/${record.workerName}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` } }
    ).catch((err) => console.warn('[deleteSite] worker removal failed:', err));
  }

  await db.siteFiles.where({ siteId }).delete();
  await db.siteDomains.where({ siteId }).delete();
  await db.sites.where({ id: siteId }).delete();

  logActivity({
    action: 'site.delete',
    userId: actor.userId,
    organizationId: actor.organizationId,
    data: { name: record.name, siteId },
  });
}

async function createSiteDomainForActor(siteId: string, hostname: string, actor: Actor): Promise<SiteDomainRecord> {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) throw new Error('Custom domain is required');
  if (normalizedHostname === getPreviewDomain()) throw new Error('Use a customer hostname, not the preview zone itself');
  if (normalizedHostname.endsWith(`.${getPreviewDomain()}`)) {
    throw new Error('Preview subdomains are created automatically and should not be added as custom domains');
  }
  if (normalizedHostname.split('.').length < 2) throw new Error('Enter a valid hostname like app.customer.com');

  const existingDomain = await db.siteDomains.where({ hostname: normalizedHostname }).first();
  if (existingDomain.data && (existingDomain.data as any).siteId !== siteId) {
    throw new Error('This custom domain is already connected to another site');
  }
  if (existingDomain.data && (existingDomain.data as any).siteId === siteId) {
    throw new Error('This custom domain already exists on the site');
  }

  const site = await getSiteRecordForActor(siteId, actor);
  const created = await createCloudflareCustomHostname(normalizedHostname);
  const domain = await upsertSiteDomainFromCloudflare(site, created, actor);

  logActivity({
    action: 'site.domain.create',
    userId: actor.userId,
    organizationId: actor.organizationId,
    data: { siteId, hostname: normalizedHostname, cloudflareHostnameId: domain.cloudflareHostnameId },
  });

  return domain;
}

async function refreshSiteDomainForActor(siteId: string, domainId: string, actor: Actor): Promise<SiteDomainRecord> {
  const site = await getSiteRecordForActor(siteId, actor);
  const result = await db.siteDomains.where({ id: domainId, siteId }).first();
  if (!result.data) throw new Error('Custom domain not found');

  const domain = normalizeSiteDomainRecord(result.data);
  if (!domain.cloudflareHostnameId) throw new Error('Custom domain is missing its Cloudflare hostname id');

  const refreshed = await getCloudflareCustomHostname(domain.cloudflareHostnameId);
  const record = await upsertSiteDomainFromCloudflare(site, refreshed, actor);

  logActivity({
    action: 'site.domain.refresh',
    userId: actor.userId,
    organizationId: actor.organizationId,
    data: {
      siteId,
      domainId,
      hostname: record.hostname,
      hostnameStatus: record.hostnameStatus,
      sslStatus: record.sslStatus,
      connectionStatus: record.connectionStatus,
    },
  });

  return record;
}

async function deleteSiteDomainForActor(siteId: string, domainId: string, actor: Actor): Promise<void> {
  await getSiteRecordForActor(siteId, actor);
  const result = await db.siteDomains.where({ id: domainId, siteId }).first();
  if (!result.data) throw new Error('Custom domain not found');

  const domain = normalizeSiteDomainRecord(result.data);
  if (domain.cloudflareHostnameId) {
    await deleteCloudflareCustomHostname(domain.cloudflareHostnameId).catch(() => null);
  }

  await db.siteDomains.where({ id: domainId }).delete();
  await syncPrimaryCustomDomain(siteId);

  logActivity({
    action: 'site.domain.delete',
    userId: actor.userId,
    organizationId: actor.organizationId,
    data: { siteId, domainId, hostname: domain.hostname },
  });
}

export async function getSites() {
  const actor = await requireInteractiveActor();
  const result = await db.sites.where({ isActive: true, organizationId: actor.organizationId }).many();
  return (result.data ?? []) as any[];
}

export async function getSite(id: string) {
  const actor = await requireInteractiveActor();
  const result = await db.sites.where({ id, isActive: true, organizationId: actor.organizationId }).first();
  return (result.data ?? null) as any;
}

export async function getSiteFiles(siteId: string) {
  const actor = await requireInteractiveActor();
  await getSiteRecordForActor(siteId, actor);
  return getSiteFilesForRecord(siteId);
}

export async function getSiteUploads(siteId: string) {
  const actor = await requireInteractiveActor();
  await getSiteRecordForActor(siteId, actor);
  const result = await db.siteUploads.where({ siteId }).many();
  return sortByNewest((result.data ?? []) as any[]).slice(0, 10);
}

export async function getSiteCustomDomains(siteId: string) {
  const actor = await requireInteractiveActor();
  await getSiteRecordForActor(siteId, actor);
  return getSiteDomainRecords(siteId);
}

export async function createSite(formData: FormData): Promise<void> {
  const actor = await requireInteractiveActor();
  const site = await createSiteRecord(String(formData.get('name') || ''), actor);
  redirect(`/sites/${site.id}`);
}

export async function uploadSiteFiles(formData: FormData): Promise<void> {
  const actor = await requireInteractiveActor();
  await uploadSiteFilesForActor(formData, actor);
  redirect(`/sites/${String(formData.get('siteId') || '').trim()}`);
}

export async function deleteSiteFiles(formData: FormData): Promise<void> {
  const actor = await requireInteractiveActor();
  await deleteSiteFilesForActor(formData, actor);
  redirect(`/sites/${String(formData.get('siteId') || '').trim()}`);
}

export async function deleteSite(formData: FormData): Promise<void> {
  const actor = await requireInteractiveActor();
  const siteId = String(formData.get('id') || '').trim();
  await deleteSiteForActor(siteId, actor);
  redirect('/sites');
}

export async function addSiteCustomDomain(formData: FormData): Promise<void> {
  const actor = await requireInteractiveActor();
  const siteId = String(formData.get('siteId') || '').trim();
  const hostname = String(formData.get('hostname') || '').trim();
  await createSiteDomainForActor(siteId, hostname, actor);
  redirect(`/sites/${siteId}`);
}

export async function refreshSiteCustomDomain(formData: FormData): Promise<void> {
  const actor = await requireInteractiveActor();
  const siteId = String(formData.get('siteId') || '').trim();
  const domainId = String(formData.get('domainId') || '').trim();
  await refreshSiteDomainForActor(siteId, domainId, actor);
  redirect(`/sites/${siteId}`);
}

export async function deleteSiteCustomDomain(formData: FormData): Promise<void> {
  const actor = await requireInteractiveActor();
  const siteId = String(formData.get('siteId') || '').trim();
  const domainId = String(formData.get('domainId') || '').trim();
  await deleteSiteDomainForActor(siteId, domainId, actor);
  redirect(`/sites/${siteId}`);
}

export async function createSiteForOrganization(name: string, organizationId: string, userId: string | null = null) {
  return createSiteRecord(name, { organizationId, userId, interactive: false });
}

export async function getSiteCustomDomainsForOrganization(siteId: string, organizationId: string) {
  await getSiteRecordForActor(siteId, { organizationId, userId: null, interactive: false });
  return getSiteDomainRecords(siteId);
}

export async function uploadSiteFilesForOrganization(formData: FormData, organizationId: string, userId: string | null = null) {
  return uploadSiteFilesForActor(formData, { organizationId, userId, interactive: false });
}

export async function deleteSiteForOrganization(siteId: string, organizationId: string, userId: string | null = null) {
  return deleteSiteForActor(siteId, { organizationId, userId, interactive: false });
}

export async function createSiteCustomDomainForOrganization(siteId: string, hostname: string, organizationId: string, userId: string | null = null) {
  return createSiteDomainForActor(siteId, hostname, { organizationId, userId, interactive: false });
}

export async function refreshSiteCustomDomainForOrganization(siteId: string, domainId: string, organizationId: string, userId: string | null = null) {
  return refreshSiteDomainForActor(siteId, domainId, { organizationId, userId, interactive: false });
}

export async function deleteSiteCustomDomainForOrganization(siteId: string, domainId: string, organizationId: string, userId: string | null = null) {
  return deleteSiteDomainForActor(siteId, domainId, { organizationId, userId, interactive: false });
}

export async function dispatchSiteRequest(workerName: string, request: Request): Promise<Response> {
  const dispatcher = (env as any).DISPATCHER;
  if (!dispatcher) throw new Error('DISPATCHER binding not available');
  const userWorker = dispatcher.get(workerName);
  return userWorker.fetch(request);
}

export async function resolveSiteRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const site = await findSiteByHostname(url.hostname);
  if (!site?.workerName) return null;
  return dispatchSiteRequest(site.workerName, request);
}
