/**
 * Platform Client
 *
 * Manage Kuratchi resources programmatically — create, list, delete
 * databases, KV namespaces, and R2 buckets. Also manage API tokens.
 *
 * Routes to /api/v1/platform/* (requires platform token with kdbp_ prefix)
 *
 * @example
 * ```typescript
 * const kuratchi = createClient({ apiKey: 'kdbp_...', baseUrl: '...' });
 *
 * // Databases
 * const dbs = await kuratchi.platform.databases.list();
 * await kuratchi.platform.databases.create({ name: 'my-db', locationHint: 'enam' });
 * await kuratchi.platform.databases.delete('db-id');
 *
 * // KV Namespaces
 * const kvs = await kuratchi.platform.kv.list();
 * await kuratchi.platform.kv.create({ name: 'my-cache' });
 *
 * // R2 Buckets
 * const buckets = await kuratchi.platform.r2.list();
 * await kuratchi.platform.r2.create({ name: 'my-bucket', locationHint: 'weur' });
 *
 * // Tokens
 * await kuratchi.platform.tokens.createForDatabase({ name: 'ci', databaseId: 'db-id' });
 * ```
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DatabaseInfo {
  id: string;
  name: string;
  dbuuid?: string;
  workerName?: string;
  locationHint?: string;
  isActive: boolean;
  created_at: string;
}

export interface KVNamespaceInfo {
  id: string;
  name: string;
  cfNamespaceId?: string;
  workerName?: string;
  isActive: boolean;
  created_at: string;
}

export interface R2BucketInfo {
  id: string;
  name: string;
  workerName?: string;
  locationHint?: string;
  isActive: boolean;
  created_at: string;
}

export interface TokenInfo {
  id: string;
  name: string;
  token: string;
  revoked: boolean;
  created_at: string;
}

export interface CreateDatabaseRequest {
  name: string;
  locationHint?: string;
}

export interface CreateKVRequest {
  name: string;
}

export interface CreateR2Request {
  name: string;
  locationHint?: string;
}

export interface SiteInfo {
  id: string;
  name: string;
  workerName?: string;
  customDomain?: string;
  isActive: boolean;
  fileCount: number;
  totalSize: number;
  created_at: string;
}

export interface SiteFileInfo {
  id: string;
  siteId: string;
  path: string;
  hash: string;
  contentType?: string;
  size: number;
  created_at: string;
}

export interface CreateSiteRequest {
  name: string;
}

export interface CreateTokenRequest {
  name: string;
}

export class PlatformClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request<T = any>(
    endpoint: string,
    options: { method?: string; body?: any } = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: (data as any).error || `HTTP ${res.status}` };
      }

      return data as ApiResponse<T>;
    } catch (error: any) {
      return { success: false, error: error.message || 'Network error' };
    }
  }

  /** Database management */
  get databases() {
    return {
      list: () => this.request<DatabaseInfo[]>('/api/v1/platform/databases'),

      get: (id: string) => this.request<DatabaseInfo>(`/api/v1/platform/databases/${id}`),

      create: (req: CreateDatabaseRequest) =>
        this.request<DatabaseInfo>('/api/v1/platform/databases', {
          method: 'POST',
          body: req,
        }),

      delete: (id: string) =>
        this.request<void>(`/api/v1/platform/databases/${id}`, { method: 'DELETE' }),
    };
  }

  /** KV namespace management */
  get kv() {
    return {
      list: () => this.request<KVNamespaceInfo[]>('/api/v1/platform/kv'),

      get: (id: string) => this.request<KVNamespaceInfo>(`/api/v1/platform/kv/${id}`),

      create: (req: CreateKVRequest) =>
        this.request<KVNamespaceInfo>('/api/v1/platform/kv', {
          method: 'POST',
          body: req,
        }),

      delete: (id: string) =>
        this.request<void>(`/api/v1/platform/kv/${id}`, { method: 'DELETE' }),
    };
  }

  /** R2 bucket management */
  get r2() {
    return {
      list: () => this.request<R2BucketInfo[]>('/api/v1/platform/r2'),

      get: (id: string) => this.request<R2BucketInfo>(`/api/v1/platform/r2/${id}`),

      create: (req: CreateR2Request) =>
        this.request<R2BucketInfo>('/api/v1/platform/r2', {
          method: 'POST',
          body: req,
        }),

      delete: (id: string) =>
        this.request<void>(`/api/v1/platform/r2/${id}`, { method: 'DELETE' }),
    };
  }

  /** Site management */
  get sites() {
    return {
      list: () => this.request<SiteInfo[]>('/api/v1/platform/sites'),

      get: (id: string) => this.request<SiteInfo & { files: SiteFileInfo[] }>(`/api/v1/platform/sites/${id}`),

      create: (req: CreateSiteRequest) =>
        this.request<SiteInfo>('/api/v1/platform/sites', {
          method: 'POST',
          body: req,
        }),

      delete: (id: string) =>
        this.request<void>(`/api/v1/platform/sites/${id}`, { method: 'DELETE' }),

      /** Upload files to a site and deploy. Each entry is { file, path? }. */
      uploadFiles: async (siteId: string, files: { file: Blob | File; path?: string }[]): Promise<ApiResponse> => {
        const form = new FormData();
        for (const entry of files) {
          form.append('file', entry.file);
          form.append('path', entry.path || (entry.file instanceof File ? entry.file.name : ''));
        }

        try {
          const res = await fetch(`${this.baseUrl}/api/v1/platform/sites/${siteId}/files`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.apiKey}` },
            body: form,
          });
          const data = await res.json();
          if (!res.ok) return { success: false, error: (data as any).error || `HTTP ${res.status}` };
          return data as ApiResponse;
        } catch (error: any) {
          return { success: false, error: error.message || 'Network error' };
        }
      },
    };
  }

  /** Token management */
  get tokens() {
    return {
      /** Create a database-scoped token */
      createForDatabase: (req: CreateTokenRequest & { databaseId: string }) =>
        this.request<TokenInfo>('/api/v1/platform/tokens/database', {
          method: 'POST',
          body: req,
        }),

      /** Create a KV-scoped token */
      createForKv: (req: CreateTokenRequest & { kvNamespaceId: string }) =>
        this.request<TokenInfo>('/api/v1/platform/tokens/kv', {
          method: 'POST',
          body: req,
        }),

      /** Create an R2-scoped token */
      createForR2: (req: CreateTokenRequest & { r2BucketId: string }) =>
        this.request<TokenInfo>('/api/v1/platform/tokens/r2', {
          method: 'POST',
          body: req,
        }),

      /** Revoke a token by ID */
      revoke: (tokenId: string) =>
        this.request<void>(`/api/v1/platform/tokens/${tokenId}`, { method: 'DELETE' }),
    };
  }
}

