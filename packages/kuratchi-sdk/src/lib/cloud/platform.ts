/**
 * Platform Management Client
 * 
 * Provides convenient methods for managing databases, organizations, roles,
 * permissions, and other platform resources through the Kuratchi Platform API.
 * 
 * @example
 * ```typescript
 * import { cloud } from 'kuratchi-sdk';
 * 
 * const platform = cloud.createPlatform({
 *   apiKey: process.env.KURATCHI_API_KEY
 * });
 * 
 * // Manage databases
 * const databases = await platform.databases.list();
 * 
 * // Manage roles & permissions
 * const roles = await platform.roles.list();
 * await platform.roles.create({
 *   name: 'editor',
 *   permissions: ['posts.create', 'posts.edit']
 * });
 * ```
 */

import type { RolesAPI, PermissionsAPI } from './platform-roles.js';

export interface PlatformClientConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface Database {
  id: string;
  name: string;
  dbuuid: string;
  organizationId: string | null;
  isActive: boolean;
  isArchived: boolean;
  schemaVersion: number;
  needsSchemaUpdate: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DatabaseAnalytics {
  readQueries: number;
  writeQueries: number;
  rowsRead: number;
  rowsWritten: number;
  period: {
    start: string;
    end: string;
    days: number;
  };
}

export interface CreateDatabaseRequest {
  name: string;
  description: string;
  organizationId?: string;
}

export interface UpdateDatabaseRequest {
  isActive?: boolean;
  isArchived?: boolean;
  needsSchemaUpdate?: boolean;
  schemaVersion?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  issues?: Array<{ field: string; message: string }>;
}

/**
 * Platform Client for managing Kuratchi resources
 */
export class PlatformClient {
  private apiKey: string;
  private baseUrl: string;
  
  /** Roles management API */
  public readonly roles: RolesAPI;
  
  /** Permissions registry API */
  public readonly permissions: PermissionsAPI;

  constructor(config: PlatformClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://kuratchi.dev';
    
    // Lazy load to avoid circular dependency
    // @ts-ignore - will be properly typed after import
    const { RolesAPI: RolesAPIClass, PermissionsAPI: PermissionsAPIClass } = require('./platform-roles.js');
    this.roles = new RolesAPIClass(this);
    this.permissions = new PermissionsAPIClass(this);
  }

  /**
   * Make an authenticated request to the platform API
   * Public to allow API extensions
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...((options.headers as Record<string, string>) || {})
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          issues: data.issues
        };
      }

      return data;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Network error'
      };
    }
  }

  // ==================== Database Management ====================

  /**
   * List all databases
   * 
   * @example
   * ```typescript
   * const result = await client.platform.databases.list({
   *   organizationId: 'org-123',
   *   includeArchived: false
   * });
   * 
   * if (result.success) {
   *   console.log('Databases:', result.data);
   * }
   * ```
   */
  async listDatabases(options?: {
    organizationId?: string;
    includeArchived?: boolean;
  }): Promise<ApiResponse<Database[]>> {
    const params = new URLSearchParams();
    if (options?.organizationId) {
      params.set('organizationId', options.organizationId);
    }
    if (options?.includeArchived) {
      params.set('includeArchived', 'true');
    }

    const query = params.toString();
    const endpoint = `/api/v1/platform/databases${query ? `?${query}` : ''}`;
    
    return this.request<Database[]>(endpoint);
  }

  /**
   * Create a new database
   * 
   * @example
   * ```typescript
   * const result = await client.platform.databases.create({
   *   name: 'my-database',
   *   description: 'Production database',
   *   organizationId: 'org-123'
   * });
   * 
   * if (result.success) {
   *   console.log('Database created:', result.data);
   * }
   * ```
   */
  async createDatabase(request: CreateDatabaseRequest): Promise<ApiResponse<Database>> {
    return this.request<Database>('/api/v1/platform/databases', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  /**
   * Get database details
   * 
   * @example
   * ```typescript
   * const result = await client.platform.databases.get('db-uuid');
   * 
   * if (result.success) {
   *   console.log('Database:', result.data);
   * }
   * ```
   */
  async getDatabase(id: string): Promise<ApiResponse<Database>> {
    return this.request<Database>(`/api/v1/platform/databases/${id}`);
  }

  /**
   * Update database details
   * 
   * @example
   * ```typescript
   * const result = await client.platform.databases.update('db-uuid', {
   *   isActive: false
   * });
   * 
   * if (result.success) {
   *   console.log('Database updated:', result.data);
   * }
   * ```
   */
  async updateDatabase(
    id: string,
    updates: UpdateDatabaseRequest
  ): Promise<ApiResponse<Database>> {
    return this.request<Database>(`/api/v1/platform/databases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  /**
   * Delete or archive a database
   * 
   * @example
   * ```typescript
   * // Soft delete (archive)
   * await client.platform.databases.delete('db-uuid');
   * 
   * // Hard delete (permanent)
   * await client.platform.databases.delete('db-uuid', { hard: true });
   * ```
   */
  async deleteDatabase(
    id: string,
    options?: { hard?: boolean }
  ): Promise<ApiResponse<void>> {
    const params = new URLSearchParams();
    if (options?.hard) {
      params.set('hard', 'true');
    }

    const query = params.toString();
    const endpoint = `/api/v1/platform/databases${query ? `?${query}` : ''}`;

    return this.request<void>(endpoint, {
      method: 'DELETE',
      body: JSON.stringify({ id })
    });
  }

  /**
   * Get database analytics
   * 
   * @example
   * ```typescript
   * const result = await client.platform.databases.analytics('db-uuid', {
   *   days: 14
   * });
   * 
   * if (result.success) {
   *   console.log('Analytics:', result.data);
   *   console.log('Read queries:', result.data.readQueries);
   * }
   * ```
   */
  async getDatabaseAnalytics(
    id: string,
    options?: { days?: number }
  ): Promise<ApiResponse<DatabaseAnalytics>> {
    const params = new URLSearchParams();
    if (options?.days) {
      params.set('days', options.days.toString());
    }

    const query = params.toString();
    const endpoint = `/api/v1/platform/databases/${id}/analytics${query ? `?${query}` : ''}`;

    return this.request<DatabaseAnalytics>(endpoint);
  }

  /**
   * Convenience object for database operations
   */
  get databases() {
    return {
      list: this.listDatabases.bind(this),
      create: this.createDatabase.bind(this),
      get: this.getDatabase.bind(this),
      update: this.updateDatabase.bind(this),
      delete: this.deleteDatabase.bind(this),
      analytics: this.getDatabaseAnalytics.bind(this)
    };
  }
}

/**
 * Create a platform client
 * 
 * @example
 * ```typescript
 * const platform = createPlatformClient({
 *   apiKey: process.env.KURATCHI_API_KEY
 * });
 * 
 * const databases = await platform.databases.list();
 * ```
 */
export function createPlatformClient(config: PlatformClientConfig): PlatformClient {
  return new PlatformClient(config);
}
