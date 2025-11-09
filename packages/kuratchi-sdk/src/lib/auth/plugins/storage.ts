/**
 * Storage plugin - Attach Cloudflare storage bindings & provide media library APIs
 * Provides KV, R2, and D1 access via locals.kuratchi.*
 */

import type { AuthPlugin, PluginContext, SessionContext } from '../core/plugin.js';

export interface StoragePluginOptions {
  /** 
   * KV namespace bindings
   * Maps friendly names to wrangler.toml binding names
   * Example: { default: 'MY_KV', cache: 'CACHE_KV' }
   */
  kv?: Record<string, string>;
  
  /**
   * R2 bucket bindings
   * Maps friendly names to wrangler.toml binding names
   * Example: { default: 'MY_BUCKET', uploads: 'UPLOADS' }
   */
  r2?: Record<string, string>;
  
  /**
   * D1 database bindings
   * Maps friendly names to wrangler.toml binding names
   * Example: { default: 'MY_DB', analytics: 'ANALYTICS_DB' }
   */
  d1?: Record<string, string>;
  
  /**
   * Default R2 bucket for media library
   */
  defaultBucket?: string;
}

export function storagePlugin(options: StoragePluginOptions = {}): AuthPlugin {
  return {
    name: 'storage',
    priority: 40, // After session, before auth flows
    
    async onRequest(ctx: PluginContext) {
      if (!ctx.locals.kuratchi) ctx.locals.kuratchi = {};
      
      const platform = ctx.event.platform as any;
      const platformEnv = platform?.env;
      
      if (!platformEnv) {
        // No platform environment available (SSR without wrangler, etc.)
        if (options.kv) ctx.locals.kuratchi.kv = {};
        if (options.r2) ctx.locals.kuratchi.r2 = {};
        if (options.d1) ctx.locals.kuratchi.d1 = {};
        return;
      }
      
      // Attach KV namespaces
      if (options.kv && typeof options.kv === 'object') {
        ctx.locals.kuratchi.kv = {};
        for (const [friendlyName, bindingName] of Object.entries(options.kv)) {
          const binding = platformEnv[bindingName];
          ctx.locals.kuratchi.kv[friendlyName] = binding || null;
          
          if (!binding && import.meta.env?.DEV) {
            console.warn(
              `[Kuratchi Storage] KV namespace "${bindingName}" not found in platform.env. ` +
              `Check your wrangler.toml bindings.`
            );
          }
        }

        // Convenience accessor: getKV(name?) -> KV namespace
        // If no name is provided, use the first configured KV binding
        ctx.locals.kuratchi.getKV = (name?: string) => {
          const kvObj = ctx.locals.kuratchi.kv as Record<string, any> | undefined;
          if (!kvObj) return null as any;
          const key = name || Object.keys(kvObj)[0];
          return (key ? kvObj[key] : null) as any;
        };
      }
      
      // Attach R2 buckets
      if (options.r2 && typeof options.r2 === 'object') {
        ctx.locals.kuratchi.r2 = {};
        for (const [friendlyName, bindingName] of Object.entries(options.r2)) {
          const binding = platformEnv[bindingName];
          ctx.locals.kuratchi.r2[friendlyName] = binding || null;
          
          if (!binding && import.meta.env?.DEV) {
            console.warn(
              `[Kuratchi Storage] R2 bucket "${bindingName}" not found in platform.env. ` +
              `Check your wrangler.toml bindings.`
            );
          }
        }

        // Convenience accessor: getR2(name?) -> R2 bucket
        // If no name is provided, use the first configured R2 binding
        ctx.locals.kuratchi.getR2 = (name?: string) => {
          const r2Obj = ctx.locals.kuratchi.r2 as Record<string, any> | undefined;
          if (!r2Obj) return null as any;
          const key = name || Object.keys(r2Obj)[0];
          return (key ? r2Obj[key] : null) as any;
        };
      }
      
      // Attach D1 databases
      if (options.d1 && typeof options.d1 === 'object') {
        ctx.locals.kuratchi.d1 = {};
        for (const [friendlyName, bindingName] of Object.entries(options.d1)) {
          const binding = platformEnv[bindingName];
          ctx.locals.kuratchi.d1[friendlyName] = binding || null;
          
          if (!binding && import.meta.env?.DEV) {
            console.warn(
              `[Kuratchi Storage] D1 database "${bindingName}" not found in platform.env. ` +
              `Check your wrangler.toml bindings.`
            );
          }
        }
      }
    },
    
    async onSession(ctx: SessionContext) {
      if (!ctx.locals.kuratchi) ctx.locals.kuratchi = {};
      
      // Helper to get DB connection
      const getDb = async (source: 'admin' | 'org' = 'admin') => {
        if (source === 'admin') {
          return await ctx.locals.kuratchi?.getAdminDb?.();
        }
        return await ctx.locals.kuratchi?.getOrgDb?.(ctx.locals.session?.organizationId);
      };
      
      // Helper to get R2 bucket
      const getBucket = (bucketName?: string) => {
        const name = bucketName || options.defaultBucket || 'default';
        return ctx.locals.kuratchi?.r2?.[name];
      };
      
      // Attach storage/media library APIs
      ctx.locals.kuratchi.storage = {
        // Media Library Management
        async getAllMedia(source: 'admin' | 'org' = 'admin', filters?: {
          folder?: string;
          type?: string;
          search?: string;
        }) {
          const db = await getDb(source);
          if (!db?.media) throw new Error('Media table not available');
          
          let query = db.media.where({ deleted_at: { is: null } });
          
          if (filters?.folder) {
            query = query.where({ folder: { eq: filters.folder } });
          }
          if (filters?.type) {
            query = query.where({ mimeType: { startsWith: filters.type } });
          }
          if (filters?.search) {
            query = query.where({ filename: { contains: filters.search } });
          }
          
          const result = await query.many();
          return Array.isArray((result as any)?.data) ? (result as any).data : (Array.isArray(result) ? result : []);
        },
        
        async getMediaById(id: string, source: 'admin' | 'org' = 'admin') {
          const db = await getDb(source);
          if (!db?.media) throw new Error('Media table not available');
          
          const result = await db.media.where({ id: { eq: id }, deleted_at: { is: null } }).one();
          return (result as any)?.data ?? result ?? null;
        },
        
        async createMedia(data: {
          filename: string;
          originalFilename: string;
          mimeType: string;
          size: number;
          key: string;
          bucket: string;
          folder?: string;
          alt?: string;
          metadata?: any;
        }, source: 'admin' | 'org' = 'admin') {
          const db = await getDb(source);
          if (!db?.media) throw new Error('Media table not available');
          
          const now = new Date().toISOString();
          const id = crypto.randomUUID();
          
          const result = await db.media.insert({
            id,
            filename: data.filename,
            originalFilename: data.originalFilename,
            mimeType: data.mimeType,
            size: data.size,
            key: data.key,
            bucket: data.bucket,
            folder: data.folder ?? null,
            alt: data.alt ?? null,
            metadata: data.metadata ?? null,
            url: null, // Will be generated on access
            created_at: now,
            updated_at: now,
            deleted_at: null
          });
          
          if (!result.success) throw new Error(`Failed to create media: ${result.error}`);
          return { ...result, id };
        },
        
        async updateMedia(id: string, data: {
          filename?: string;
          alt?: string;
          folder?: string;
          metadata?: any;
        }, source: 'admin' | 'org' = 'admin') {
          const db = await getDb(source);
          if (!db?.media) throw new Error('Media table not available');
          
          const now = new Date().toISOString();
          const update: any = { updated_at: now };
          if (data.filename !== undefined) update.filename = data.filename;
          if (data.alt !== undefined) update.alt = data.alt;
          if (data.folder !== undefined) update.folder = data.folder;
          if (data.metadata !== undefined) update.metadata = data.metadata;
          
          const result = await db.media.where({ id }).update(update);
          if (!result.success) throw new Error(`Failed to update media: ${result.error}`);
          return result;
        },
        
        async deleteMedia(id: string, source: 'admin' | 'org' = 'admin') {
          const db = await getDb(source);
          if (!db?.media) throw new Error('Media table not available');
          
          const now = new Date().toISOString();
          const result = await db.media.where({ id }).update({
            deleted_at: now,
            updated_at: now
          });
          if (!result.success) throw new Error(`Failed to delete media: ${result.error}`);
          return result;
        },
        
        // R2 Operations
        async uploadFile(file: File | Blob, uploadOptions?: {
          bucket?: string;
          key?: string;
          metadata?: Record<string, string>;
        }) {
          const bucket = getBucket(uploadOptions?.bucket);
          if (!bucket) throw new Error('R2 bucket not available');
          
          const key = uploadOptions?.key || `uploads/${crypto.randomUUID()}-${(file as File).name || 'file'}`;
          
          // Extract contentType from metadata or use file.type
          const contentType = uploadOptions?.metadata?.contentType || (file as File).type || 'application/octet-stream';
          
          // Build httpMetadata object
          const httpMetadata: Record<string, string> = {
            contentType
          };
          
          // Build customMetadata from remaining metadata fields
          const customMetadata: Record<string, string> = {};
          if (uploadOptions?.metadata) {
            for (const [key, value] of Object.entries(uploadOptions.metadata)) {
              if (key !== 'contentType') {
                customMetadata[key] = value;
              }
            }
          }
          
          await bucket.put(key, file, {
            httpMetadata,
            customMetadata: Object.keys(customMetadata).length > 0 ? customMetadata : undefined
          });
          
          return { key, bucket: uploadOptions?.bucket || options.defaultBucket || 'default' };
        },
        
        async getFile(key: string, bucketName?: string) {
          const bucket = getBucket(bucketName);
          if (!bucket) throw new Error('R2 bucket not available');
          
          const object = await bucket.get(key);
          return object;
        },
        
        async deleteFile(key: string, bucketName?: string) {
          const bucket = getBucket(bucketName);
          if (!bucket) throw new Error('R2 bucket not available');
          
          await bucket.delete(key);
          return { success: true };
        },
        
        async listFiles(options?: {
          bucket?: string;
          prefix?: string;
          limit?: number;
          cursor?: string;
          delimiter?: string;
        }) {
          const bucket = getBucket(options?.bucket);
          if (!bucket) throw new Error('R2 bucket not available');
          
          const listed = await bucket.list({
            prefix: options?.prefix,
            limit: options?.limit || 1000,
            cursor: options?.cursor,
            delimiter: options?.delimiter,
            include: ['httpMetadata', 'customMetadata']
          });
          
          return {
            objects: listed.objects.map((obj: any) => ({
              key: obj.key,
              size: obj.size,
              uploaded: obj.uploaded,
              httpEtag: obj.httpEtag,
              httpMetadata: obj.httpMetadata,
              customMetadata: obj.customMetadata
            })),
            truncated: listed.truncated,
            cursor: listed.cursor,
            delimitedPrefixes: listed.delimitedPrefixes || []
          };
        },
        
        // Folders Management
        async getFolders(source: 'admin' | 'org' = 'admin') {
          const db = await getDb(source);
          if (!db?.mediaFolders) throw new Error('MediaFolders table not available');
          
          const result = await db.mediaFolders.where({ deleted_at: { is: null } }).many();
          return Array.isArray((result as any)?.data) ? (result as any).data : (Array.isArray(result) ? result : []);
        },
        
        async createFolder(data: {
          name: string;
          slug: string;
          parentId?: string;
        }, source: 'admin' | 'org' = 'admin') {
          const db = await getDb(source);
          if (!db?.mediaFolders) throw new Error('MediaFolders table not available');
          
          const now = new Date().toISOString();
          const id = crypto.randomUUID();
          
          const result = await db.mediaFolders.insert({
            id,
            name: data.name,
            slug: data.slug,
            parentId: data.parentId ?? null,
            created_at: now,
            updated_at: now,
            deleted_at: null
          });
          
          if (!result.success) throw new Error(`Failed to create folder: ${result.error}`);
          return { ...result, id };
        },
        
        async updateFolder(id: string, data: {
          name?: string;
          slug?: string;
          parentId?: string;
        }, source: 'admin' | 'org' = 'admin') {
          const db = await getDb(source);
          if (!db?.mediaFolders) throw new Error('MediaFolders table not available');
          
          const now = new Date().toISOString();
          const update: any = { updated_at: now };
          if (data.name !== undefined) update.name = data.name;
          if (data.slug !== undefined) update.slug = data.slug;
          if (data.parentId !== undefined) update.parentId = data.parentId;
          
          const result = await db.mediaFolders.where({ id }).update(update);
          if (!result.success) throw new Error(`Failed to update folder: ${result.error}`);
          return result;
        },
        
        async deleteFolder(id: string, source: 'admin' | 'org' = 'admin') {
          const db = await getDb(source);
          if (!db?.mediaFolders) throw new Error('MediaFolders table not available');
          
          const now = new Date().toISOString();
          const result = await db.mediaFolders.where({ id }).update({
            deleted_at: now,
            updated_at: now
          });
          if (!result.success) throw new Error(`Failed to delete folder: ${result.error}`);
          return result;
        }
      };
    }
  };
}
