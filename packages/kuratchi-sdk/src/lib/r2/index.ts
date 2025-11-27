import { getCurrentPlatform } from '../utils/platform-context.js';
import { CloudflareClient } from '../utils/cloudflare.js';

/**
 * Global R2 bucket access that reads from platform.env
 * Automatically works in both dev (via wrangler proxy) and production
 */

type R2Bucket = {
  get(key: string, options?: { onlyIf?: any; range?: any }): Promise<R2Object | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object>;
  delete(keys: string | string[]): Promise<void>;
  head(key: string): Promise<R2Object | null>;
  list(options?: R2ListOptions): Promise<R2Objects>;
  createMultipartUpload(key: string, options?: R2MultipartOptions): Promise<R2MultipartUpload>;
};

type R2Object = {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  checksums: R2Checksums;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  range?: R2Range;
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  blob(): Promise<Blob>;
  writeHttpMetadata(headers: Headers): void;
};

type R2PutOptions = {
  httpMetadata?: R2HTTPMetadata | Headers;
  customMetadata?: Record<string, string>;
  md5?: ArrayBuffer | string;
  sha1?: ArrayBuffer | string;
  sha256?: ArrayBuffer | string;
  sha384?: ArrayBuffer | string;
  sha512?: ArrayBuffer | string;
  onlyIf?: R2Conditional;
};

type R2ListOptions = {
  limit?: number;
  prefix?: string;
  cursor?: string;
  delimiter?: string;
  startAfter?: string;
  include?: ('httpMetadata' | 'customMetadata')[];
};

type R2Objects = {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes: string[];
};

type R2HTTPMetadata = {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
};

type R2Checksums = {
  md5?: ArrayBuffer;
  sha1?: ArrayBuffer;
  sha256?: ArrayBuffer;
  sha384?: ArrayBuffer;
  sha512?: ArrayBuffer;
};

type R2Range = {
  offset: number;
  length: number;
};

type R2Conditional = {
  etagMatches?: string;
  etagDoesNotMatch?: string;
  uploadedBefore?: Date;
  uploadedAfter?: Date;
};

type R2MultipartOptions = {
  httpMetadata?: R2HTTPMetadata | Headers;
  customMetadata?: Record<string, string>;
};

type R2MultipartUpload = {
  key: string;
  uploadId: string;
  uploadPart(partNumber: number, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob): Promise<R2UploadedPart>;
  abort(): Promise<void>;
  complete(uploadedParts: R2UploadedPart[]): Promise<R2Object>;
};

type R2UploadedPart = {
  partNumber: number;
  etag: string;
};

class R2NotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'R2NotAvailableError';
  }
}

function getR2Bucket(name: string): R2Bucket {
  const platform = getCurrentPlatform();
  
  if (!platform || typeof platform !== 'object') {
    throw new R2NotAvailableError('[Kuratchi R2] No platform available. Are you calling this from a server context with the auth handle configured?');
  }

  const env = (platform as any).env;
  if (!env || typeof env !== 'object') {
    throw new R2NotAvailableError('[Kuratchi R2] No platform.env available. Ensure wrangler dev is running or you are deployed to Cloudflare Workers.');
  }

  const bucket = env[name];
  if (!bucket) {
    throw new R2NotAvailableError(`[Kuratchi R2] Bucket "${name}" not found in platform.env. Check your wrangler.toml bindings.`);
  }

  return bucket as R2Bucket;
}

export interface R2WorkerConfig {
  workerName?: string;  // Worker name to construct URL (e.g., "db-abc-123")
  workerUrl?: string;   // Or provide full URL directly
  workersSubdomain?: string; // Workers subdomain (e.g., "kuratchi" for kuratchi.workers.dev)
  gatewayKey: string;
  token: string;
  databaseName: string;
}

/**
 * Get worker URL from config
 */
function getWorkerUrl(config: R2WorkerConfig): string {
  if (config.workerUrl) {
    return config.workerUrl;
  }
  if (config.workerName) {
    const subdomain = config.workersSubdomain || 'workers';
    return `https://${config.workerName}.${subdomain}`;
  }
  console.error('[Kuratchi R2] Worker config missing workerUrl and workerName:', config);
  throw new Error('[Kuratchi R2] Either workerUrl or workerName must be provided in config');
}

/**
 * Get an object from R2 via worker HTTP endpoint
 * @param bucketName - R2 bucket binding name (not used in HTTP mode, kept for API compatibility)
 * @param key - Object key to retrieve
 * @param options - Optional get options
 * @param workerConfig - Worker configuration (workerUrl, gatewayKey, token, databaseName)
 */
export async function get(
  bucketName: string,
  key: string,
  options?: { onlyIf?: any; range?: any },
  workerConfig?: R2WorkerConfig
): Promise<R2Object | null> {
  // Require worker config
  if (!workerConfig) {
    console.warn('[Kuratchi R2] No worker config provided for get(). Returning null.');
    return null;
  }
  
  // Use worker HTTP endpoint
  try {
    const workerUrl = getWorkerUrl(workerConfig);
    const response = await fetch(`${workerUrl}/api/storage/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerConfig.gatewayKey}`,
        'x-db-token': workerConfig.token,
        'x-db-name': workerConfig.databaseName
      },
      body: JSON.stringify({ key })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get object');
    }
    
    const result = await response.json();
    if (!result.success) {
      return null;
    }
    
    // Decode base64 data
    const base64Data = result.results.data;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return {
      key: result.results.key,
      size: result.results.size,
      httpMetadata: result.results.httpMetadata,
      customMetadata: result.results.customMetadata,
      etag: result.results.etag,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        }
      }),
      arrayBuffer: async () => bytes.buffer,
      text: async () => new TextDecoder().decode(bytes),
      json: async () => JSON.parse(new TextDecoder().decode(bytes)),
      blob: async () => new Blob([bytes])
    } as any;
  } catch (error) {
    console.warn('[Kuratchi R2] Get error:', error);
    return null;
  }
}

/**
 * Put an object into R2
 * @param bucketName - R2 bucket binding name (not used in HTTP mode, kept for API compatibility)
 * @param key - Object key to store
 * @param value - Value to store
 * @param options - Optional put options
 * @param workerConfig - Worker configuration (workerUrl, gatewayKey, token, databaseName)
 */
export async function put(
  bucketName: string,
  key: string,
  value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
  options?: R2PutOptions,
  workerConfig?: R2WorkerConfig
): Promise<R2Object | null> {
  // Require worker config
  if (!workerConfig) {
    console.warn('[Kuratchi R2] No worker config provided for put(). Returning null.');
    return null;
  }
  
  // Use worker HTTP endpoint
  try {
    // Convert value to base64
    let arrayBuffer: ArrayBuffer;
    if (value instanceof ReadableStream) {
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(chunk);
      }
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      arrayBuffer = result.buffer;
    } else if (value instanceof ArrayBuffer) {
      arrayBuffer = value;
    } else if (ArrayBuffer.isView(value)) {
      arrayBuffer = value.buffer as ArrayBuffer;
    } else if (value instanceof Blob) {
      arrayBuffer = await value.arrayBuffer();
    } else if (typeof value === 'string') {
      arrayBuffer = new TextEncoder().encode(value).buffer;
    } else {
      arrayBuffer = new ArrayBuffer(0);
    }
    
    // Convert to base64
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);
    
    const workerUrl = getWorkerUrl(workerConfig);
    const response = await fetch(`${workerUrl}/api/storage/put`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerConfig.gatewayKey}`,
        'x-db-token': workerConfig.token,
        'x-db-name': workerConfig.databaseName
      },
      body: JSON.stringify({
        key,
        data: base64Data,
        httpMetadata: options?.httpMetadata,
        customMetadata: options?.customMetadata
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to put object');
    }
    
    const result = await response.json();
    return result.success ? { key } as any : null;
  } catch (error) {
    console.warn('[Kuratchi R2] Put error:', error);
    return null;
  }
}

/**
 * Delete an object or objects from R2
 * @param bucketName - R2 bucket binding name (not used in HTTP mode, kept for API compatibility)
 * @param keys - Key or array of keys to delete
 * @param workerConfig - Worker configuration (workerUrl, gatewayKey, token, databaseName)
 */
export async function del(
  bucketName: string,
  keys: string | string[],
  workerConfig?: R2WorkerConfig
): Promise<boolean> {
  // Require worker config
  if (!workerConfig) {
    console.warn('[Kuratchi R2] No worker config provided for del(). Returning false.');
    return false;
  }
  
  // Use worker HTTP endpoint
  try {
    const workerUrl = getWorkerUrl(workerConfig);
    const response = await fetch(`${workerUrl}/api/storage/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerConfig.gatewayKey}`,
        'x-db-token': workerConfig.token,
        'x-db-name': workerConfig.databaseName
      },
      body: JSON.stringify({ key: keys })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete object');
    }
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.warn('[Kuratchi R2] Delete error:', error);
    return false;
  }
}

/**
 * Get object metadata from R2 without downloading the body
 * @param bucketName - R2 bucket binding name (not used in HTTP mode, kept for API compatibility)
 * @param key - Object key
 * @param workerConfig - Worker configuration (workerUrl, gatewayKey, token, databaseName)
 */
export async function head(
  bucketName: string,
  key: string,
  workerConfig?: R2WorkerConfig
): Promise<R2Object | null> {
  // Require worker config
  if (!workerConfig) {
    console.warn('[Kuratchi R2] No worker config provided for head(). Returning null.');
    return null;
  }
  
  // Use worker HTTP endpoint
  try {
    const workerUrl = getWorkerUrl(workerConfig);
    const response = await fetch(`${workerUrl}/api/storage/head`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerConfig.gatewayKey}`,
        'x-db-token': workerConfig.token,
        'x-db-name': workerConfig.databaseName
      },
      body: JSON.stringify({ key })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get object metadata');
    }
    
    const result = await response.json();
    if (!result.success) {
      return null;
    }
    
    return {
      key: result.results.key,
      size: result.results.size,
      httpMetadata: result.results.httpMetadata,
      customMetadata: result.results.customMetadata,
      etag: result.results.etag
    } as any;
  } catch (error) {
    console.warn('[Kuratchi R2] Head error:', error);
    return null;
  }
}

/**
 * List objects in R2
 * @param bucketName - R2 bucket binding name (not used in HTTP mode, kept for API compatibility)
 * @param options - Optional list options
 * @param workerConfig - Worker configuration (workerUrl, gatewayKey, token, databaseName)
 */
export async function list(
  bucketName: string,
  options?: R2ListOptions,
  workerConfig?: R2WorkerConfig
): Promise<R2Objects | null> {
  // Require worker config
  if (!workerConfig) {
    console.warn('[Kuratchi R2] No worker config provided for list(). Returning null.');
    return null;
  }
  
  // Use worker HTTP endpoint
  try {
    const workerUrl = getWorkerUrl(workerConfig);
    const response = await fetch(`${workerUrl}/api/storage/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerConfig.gatewayKey}`,
        'x-db-token': workerConfig.token,
        'x-db-name': workerConfig.databaseName
      },
      body: JSON.stringify({
        prefix: options?.prefix,
        limit: options?.limit,
        cursor: options?.cursor,
        delimiter: options?.delimiter
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list objects');
    }
    
    const result = await response.json();
    if (!result.success) {
      return null;
    }
    
    return {
      objects: result.results.objects || [],
      truncated: result.results.truncated || false,
      cursor: result.results.cursor,
      delimitedPrefixes: result.results.prefixes || []
    };
  } catch (error) {
    console.warn('[Kuratchi R2] List error:', error);
    return null;
  }
}

/**
 * Get an R2 bucket client for direct access
 * @param name - R2 bucket binding name (from wrangler.toml)
 */
export function bucket(name: string): R2Bucket | null {
  try {
    return getR2Bucket(name);
  } catch (error) {
    if (error instanceof R2NotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }
}

export interface CreateBucketConfig {
  apiToken?: string;
  accountId?: string;
}

/**
 * Create an R2 bucket via Cloudflare API (control-plane operation)
 * 
 * @param name - Bucket name
 * @param config - Optional config with apiToken and accountId. If not provided, will attempt to resolve from platform.env
 * @returns Cloudflare API response
 * 
 * @example
 * ```typescript
 * import { r2 } from 'kuratchi-sdk';
 * // Auto-resolve from platform.env
 * const result = await r2.createBucket('my-bucket-name');
 * 
 * // Or provide explicitly
 * const result = await r2.createBucket('my-bucket-name', {
 *   apiToken: 'your-token',
 *   accountId: 'your-account-id'
 * });
 * ```
 */
export async function createBucket(name: string, config?: CreateBucketConfig): Promise<any> {
  console.log('[Kuratchi R2] createBucket called with:', { name, hasConfig: !!config });
  
  const platform = getCurrentPlatform() as any;
  const env = platform?.env || (typeof process !== 'undefined' ? process.env : {});

  console.log('[Kuratchi R2] Environment check:', {
    hasPlatform: !!platform,
    hasPlatformEnv: !!(platform?.env),
    hasProcessEnv: typeof process !== 'undefined' && !!process.env,
    configApiToken: !!config?.apiToken,
    configAccountId: !!config?.accountId
  });

  const apiToken = config?.apiToken || 
    env.CF_API_TOKEN || 
    env.CLOUDFLARE_API_TOKEN || 
    env.KURATCHI_CF_API_TOKEN;
  
  const accountId = config?.accountId || 
    env.CF_ACCOUNT_ID || 
    env.CLOUDFLARE_ACCOUNT_ID || 
    env.KURATCHI_CF_ACCOUNT_ID;

  console.log('[Kuratchi R2] Resolved credentials:', {
    hasApiToken: !!apiToken,
    hasAccountId: !!accountId,
    accountId: accountId ? `${accountId.substring(0, 8)}...` : 'none'
  });

  if (!apiToken) {
    throw new Error('[Kuratchi R2] Cloudflare API token is required. Set CF_API_TOKEN, CLOUDFLARE_API_TOKEN, or KURATCHI_CF_API_TOKEN.');
  }
  if (!accountId) {
    throw new Error('[Kuratchi R2] Cloudflare Account ID is required. Set CF_ACCOUNT_ID, CLOUDFLARE_ACCOUNT_ID, or KURATCHI_CF_ACCOUNT_ID.');
  }

  console.log('[Kuratchi R2] Creating CloudflareClient...');
  const client = new CloudflareClient({ apiToken, accountId });
  
  console.log('[Kuratchi R2] Calling createR2Bucket...');
  const result = await client.createR2Bucket(name);
  
  console.log('[Kuratchi R2] createR2Bucket result:', {
    success: result?.success,
    hasErrors: !!(result?.errors),
    errorCount: result?.errors?.length || 0
  });
  
  return result;
}

/**
 * Enable R2.dev public domain for a bucket
 * @param bucketName - Name of the R2 bucket
 * @param config - Optional config with apiToken and accountId
 */
export async function enablePublicDomain(bucketName: string, config?: CreateBucketConfig): Promise<any> {
  const platform = getCurrentPlatform() as any;
  const env = platform?.env || (typeof process !== 'undefined' ? process.env : {});

  const apiToken = config?.apiToken || 
    env.CF_API_TOKEN || 
    env.CLOUDFLARE_API_TOKEN || 
    env.KURATCHI_CF_API_TOKEN;
  
  const accountId = config?.accountId || 
    env.CF_ACCOUNT_ID || 
    env.CLOUDFLARE_ACCOUNT_ID || 
    env.KURATCHI_CF_ACCOUNT_ID;

  if (!apiToken || !accountId) {
    throw new Error('[Kuratchi R2] API token and account ID required');
  }

  const client = new CloudflareClient({ apiToken, accountId });
  
  // Enable the managed R2.dev domain
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/domains/managed`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enabled: true })
    }
  );

  return await response.json();
}

/**
 * Disable R2.dev public domain for a bucket
 * @param bucketName - Name of the R2 bucket
 * @param config - Optional config with apiToken and accountId
 */
export async function disablePublicDomain(bucketName: string, config?: CreateBucketConfig): Promise<any> {
  const platform = getCurrentPlatform() as any;
  const env = platform?.env || (typeof process !== 'undefined' ? process.env : {});

  const apiToken = config?.apiToken || 
    env.CF_API_TOKEN || 
    env.CLOUDFLARE_API_TOKEN || 
    env.KURATCHI_CF_API_TOKEN;
  
  const accountId = config?.accountId || 
    env.CF_ACCOUNT_ID || 
    env.CLOUDFLARE_ACCOUNT_ID || 
    env.KURATCHI_CF_ACCOUNT_ID;

  if (!apiToken || !accountId) {
    throw new Error('[Kuratchi R2] API token and account ID required');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/domains/managed`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enabled: false })
    }
  );

  return await response.json();
}

/**
 * Get R2.dev public domain status for a bucket
 * @param bucketName - Name of the R2 bucket
 * @param config - Optional config with apiToken and accountId
 */
export async function getPublicDomain(bucketName: string, config?: CreateBucketConfig): Promise<any> {
  const platform = getCurrentPlatform() as any;
  const env = platform?.env || (typeof process !== 'undefined' ? process.env : {});

  const apiToken = config?.apiToken || 
    env.CF_API_TOKEN || 
    env.CLOUDFLARE_API_TOKEN || 
    env.KURATCHI_CF_API_TOKEN;
  
  const accountId = config?.accountId || 
    env.CF_ACCOUNT_ID || 
    env.CLOUDFLARE_ACCOUNT_ID || 
    env.KURATCHI_CF_ACCOUNT_ID;

  if (!apiToken || !accountId) {
    throw new Error('[Kuratchi R2] API token and account ID required');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/domains/managed`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    }
  );

  return await response.json();
}

export interface AddCustomDomainOptions extends CreateBucketConfig {
  /** Zone ID where the custom domain is registered (required by Cloudflare API) */
  zoneId: string;
  /** Whether the domain should be enabled (defaults to true) */
  enabled?: boolean;
}

/**
 * Add custom domain to R2 bucket (e.g., sitename-storage.kuratchi.dev)
 * @param bucketName - Name of the R2 bucket
 * @param customDomain - Custom domain to add (e.g., "files.example.com")
 * @param options - Config with apiToken, accountId, and required zoneId
 */
export async function addCustomDomain(bucketName: string, customDomain: string, options: AddCustomDomainOptions): Promise<any> {
  const platform = getCurrentPlatform() as any;
  const env = platform?.env || (typeof process !== 'undefined' ? process.env : {});

  const apiToken = options?.apiToken || 
    env.CF_API_TOKEN || 
    env.CLOUDFLARE_API_TOKEN || 
    env.KURATCHI_CF_API_TOKEN;
  
  const accountId = options?.accountId || 
    env.CF_ACCOUNT_ID || 
    env.CLOUDFLARE_ACCOUNT_ID || 
    env.KURATCHI_CF_ACCOUNT_ID;

  if (!apiToken || !accountId) {
    throw new Error('[Kuratchi R2] API token and account ID required');
  }

  if (!options?.zoneId) {
    throw new Error('[Kuratchi R2] zoneId is required for adding custom domain');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/domains/custom`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        domain: customDomain,
        zoneId: options.zoneId,
        enabled: options.enabled ?? true
      })
    }
  );

  return await response.json();
}

/**
 * Remove custom domain from R2 bucket
 * @param bucketName - Name of the R2 bucket
 * @param customDomain - Custom domain to remove
 * @param config - Optional config with apiToken and accountId
 */
export async function removeCustomDomain(bucketName: string, customDomain: string, config?: CreateBucketConfig): Promise<any> {
  const platform = getCurrentPlatform() as any;
  const env = platform?.env || (typeof process !== 'undefined' ? process.env : {});

  const apiToken = config?.apiToken || 
    env.CF_API_TOKEN || 
    env.CLOUDFLARE_API_TOKEN || 
    env.KURATCHI_CF_API_TOKEN;
  
  const accountId = config?.accountId || 
    env.CF_ACCOUNT_ID || 
    env.CLOUDFLARE_ACCOUNT_ID || 
    env.KURATCHI_CF_ACCOUNT_ID;

  if (!apiToken || !accountId) {
    throw new Error('[Kuratchi R2] API token and account ID required');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/domains/custom/${customDomain}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    }
  );

  return await response.json();
}

/**
 * Add R2 binding to an existing worker
 * 
 * @param workerName - Name of the worker script
 * @param bucketName - Name of the R2 bucket
 * @param bindingName - Name of the binding (e.g., 'STORAGE')
 * @param databaseId - D1 database ID for the worker
 * @param gatewayKey - Gateway key for authentication
 * @param config - Optional config with apiToken and accountId
 * @returns Result object with success flag and optional error message
 * 
 * @example
 * ```typescript
 * import { r2 } from 'kuratchi-sdk';
 * const result = await r2.addWorkerBinding(
 *   'my-worker',
 *   'my-bucket',
 *   'STORAGE',
 *   'database-uuid',
 *   'gateway-key',
 *   { apiToken: 'your-token', accountId: 'your-account-id' }
 * );
 * ```
 */
export async function addWorkerBinding(
  workerName: string,
  bucketName: string,
  bindingName: string,
  databaseId: string,
  gatewayKey: string,
  config?: CreateBucketConfig
): Promise<{ success: boolean; error?: string }> {
  const platform = getCurrentPlatform() as any;
  const env = platform?.env || (typeof process !== 'undefined' ? process.env : {});

  const apiToken = config?.apiToken || 
    env.CF_API_TOKEN || 
    env.CLOUDFLARE_API_TOKEN || 
    env.KURATCHI_CF_API_TOKEN;
  
  const accountId = config?.accountId || 
    env.CF_ACCOUNT_ID || 
    env.CLOUDFLARE_ACCOUNT_ID || 
    env.KURATCHI_CF_ACCOUNT_ID;

  if (!apiToken) {
    throw new Error('[Kuratchi R2] Cloudflare API token is required. Set CF_API_TOKEN, CLOUDFLARE_API_TOKEN, or KURATCHI_CF_API_TOKEN.');
  }
  if (!accountId) {
    throw new Error('[Kuratchi R2] Cloudflare Account ID is required. Set CF_ACCOUNT_ID, CLOUDFLARE_ACCOUNT_ID, or KURATCHI_CF_ACCOUNT_ID.');
  }

  const client = new CloudflareClient({ apiToken, accountId });
  
  return await client.addR2BindingToWorker({
    workerName,
    bucketName,
    bindingName,
    databaseId,
    gatewayKey
  });
}

/**
 * Convenience namespace export
 */
export const r2 = {
  get,
  put,
  delete: del,
  head,
  list,
  bucket,
  createBucket,
  addWorkerBinding,
  enablePublicDomain,
  disablePublicDomain,
  getPublicDomain,
  addCustomDomain,
  removeCustomDomain
};

// Re-export types
export type {
  R2Bucket,
  R2Object,
  R2Objects,
  R2PutOptions,
  R2ListOptions,
  R2HTTPMetadata,
  R2Checksums,
  R2Range,
  R2Conditional,
  R2MultipartOptions,
  R2MultipartUpload,
  R2UploadedPart
};
