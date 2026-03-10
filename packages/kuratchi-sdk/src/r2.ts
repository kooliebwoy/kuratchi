/**
 * R2 Client
 *
 * Object storage operations against a specific R2 bucket.
 * Routes to /api/v1/r2/:r2Name (RESTful — GET, PUT, DELETE, HEAD)
 *
 * @example
 * ```typescript
 * const r2 = kuratchi.r2('my-bucket');
 *
 * // Upload
 * await r2.put('photos/cat.jpg', imageBuffer, { contentType: 'image/jpeg' });
 *
 * // Download
 * const file = await r2.get('photos/cat.jpg');
 * console.log(file.body); // ReadableStream
 *
 * // List
 * const list = await r2.list({ prefix: 'photos/' });
 *
 * // Delete
 * await r2.delete('photos/cat.jpg');
 *
 * // Head (metadata only)
 * const meta = await r2.head('photos/cat.jpg');
 * ```
 */

export interface R2Object {
  key: string;
  size: number;
  etag: string;
  uploaded?: string;
  httpMetadata?: { contentType?: string; contentDisposition?: string };
  customMetadata?: Record<string, string>;
}

export interface R2ListResult {
  success: boolean;
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}

export interface R2GetResult {
  body: ReadableStream | null;
  etag: string | null;
  contentType: string | null;
  size: string | null;
}

export class R2Client {
  private baseUrl: string;
  private apiKey: string;
  private bucketName: string;

  constructor(baseUrl: string, apiKey: string, bucketName: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.bucketName = bucketName;
  }

  private url(key?: string, query?: Record<string, string>): string {
    let u = `${this.baseUrl}/api/v1/r2/${this.bucketName}`;
    if (key) u += `/${key}`;
    if (query) {
      const params = new URLSearchParams(query);
      const qs = params.toString();
      if (qs) u += `?${qs}`;
    }
    return u;
  }

  private get authHeaders(): Record<string, string> {
    return { 'Authorization': `Bearer ${this.apiKey}` };
  }

  /** Download an object */
  async get(key: string): Promise<R2GetResult> {
    const res = await fetch(this.url(key), {
      headers: this.authHeaders,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((err as any).error || `R2 GET failed: ${res.status}`);
    }

    return {
      body: res.body,
      etag: res.headers.get('etag'),
      contentType: res.headers.get('content-type'),
      size: res.headers.get('x-r2-size'),
    };
  }

  /** Upload an object */
  async put(
    key: string,
    body: BodyInit,
    options?: { contentType?: string; metadata?: Record<string, string> }
  ): Promise<R2Object> {
    const headers: Record<string, string> = {
      ...this.authHeaders,
      'Content-Type': options?.contentType || 'application/octet-stream',
    };

    if (options?.metadata) {
      headers['x-r2-metadata'] = JSON.stringify(options.metadata);
    }

    const res = await fetch(this.url(key), {
      method: 'PUT',
      headers,
      body,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((err as any).error || `R2 PUT failed: ${res.status}`);
    }

    return await res.json() as R2Object;
  }

  /** Delete an object */
  async delete(key: string): Promise<void> {
    const res = await fetch(this.url(key), {
      method: 'DELETE',
      headers: this.authHeaders,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((err as any).error || `R2 DELETE failed: ${res.status}`);
    }
  }

  /** Get object metadata without downloading */
  async head(key: string): Promise<R2Object> {
    const res = await fetch(this.url(key), {
      method: 'HEAD',
      headers: this.authHeaders,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((err as any).error || `R2 HEAD failed: ${res.status}`);
    }

    return await res.json() as R2Object;
  }

  /** List objects in the bucket */
  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<R2ListResult> {
    const query: Record<string, string> = {};
    if (options?.prefix) query.prefix = options.prefix;
    if (options?.limit) query.limit = String(options.limit);
    if (options?.cursor) query.cursor = options.cursor;

    const res = await fetch(this.url(undefined, query), {
      headers: this.authHeaders,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((err as any).error || `R2 LIST failed: ${res.status}`);
    }

    return await res.json() as R2ListResult;
  }
}
