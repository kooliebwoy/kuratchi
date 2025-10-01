import { getCurrentPlatform } from '../utils/platform-context.js';

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

/**
 * Get an object from R2
 * @param bucketName - R2 bucket binding name (from wrangler.toml)
 * @param key - Object key to retrieve
 * @param options - Optional get options
 */
export async function get(
  bucketName: string,
  key: string,
  options?: { onlyIf?: any; range?: any }
): Promise<R2Object | null> {
  try {
    const bucket = getR2Bucket(bucketName);
    return await bucket.get(key, options);
  } catch (error) {
    if (error instanceof R2NotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }
}

/**
 * Put an object into R2
 * @param bucketName - R2 bucket binding name (from wrangler.toml)
 * @param key - Object key to store
 * @param value - Value to store
 * @param options - Optional put options
 */
export async function put(
  bucketName: string,
  key: string,
  value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
  options?: R2PutOptions
): Promise<R2Object | null> {
  try {
    const bucket = getR2Bucket(bucketName);
    return await bucket.put(key, value, options);
  } catch (error) {
    if (error instanceof R2NotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }
}

/**
 * Delete an object or objects from R2
 * @param bucketName - R2 bucket binding name (from wrangler.toml)
 * @param keys - Key or array of keys to delete
 */
export async function del(
  bucketName: string,
  keys: string | string[]
): Promise<boolean> {
  try {
    const bucket = getR2Bucket(bucketName);
    await bucket.delete(keys);
    return true;
  } catch (error) {
    if (error instanceof R2NotAvailableError) {
      console.warn(error.message);
      return false;
    }
    throw error;
  }
}

/**
 * Get object metadata from R2 without downloading the body
 * @param bucketName - R2 bucket binding name (from wrangler.toml)
 * @param key - Object key
 */
export async function head(
  bucketName: string,
  key: string
): Promise<R2Object | null> {
  try {
    const bucket = getR2Bucket(bucketName);
    return await bucket.head(key);
  } catch (error) {
    if (error instanceof R2NotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }
}

/**
 * List objects in R2
 * @param bucketName - R2 bucket binding name (from wrangler.toml)
 * @param options - Optional list options
 */
export async function list(
  bucketName: string,
  options?: R2ListOptions
): Promise<R2Objects | null> {
  try {
    const bucket = getR2Bucket(bucketName);
    return await bucket.list(options);
  } catch (error) {
    if (error instanceof R2NotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
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

/**
 * Convenience namespace export
 */
export const r2 = {
  get,
  put,
  delete: del,
  head,
  list,
  bucket
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
