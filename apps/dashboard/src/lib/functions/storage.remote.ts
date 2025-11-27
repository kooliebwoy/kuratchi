import { getRequestEvent, query, form, command } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { r2 } from 'kuratchi-sdk';
import { getDatabase, getAdminDatabase, getSiteDatabase } from '$lib/server/db-context';

/**
 * Shared R2 bucket for organization-level storage
 * Uses prefixes for isolation: org-{orgId}/emails/...
 */
const SHARED_BUCKET_BINDING = 'STORAGE';

/**
 * Get organization storage prefix
 */
function getOrgPrefix(orgId: string): string {
	return `org-${orgId}`;
}

/**
 * Get direct R2 bucket access (for dashboard context with platform.env)
 */
function getSharedBucket() {
	try {
		return r2.bucket(SHARED_BUCKET_BINDING);
	} catch (err) {
		console.warn('[Storage] Shared bucket not available:', err);
		return null;
	}
}

// Helpers
const guardedQuery = <R>(fn: () => Promise<R>) => {
  return query(async () => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');
    return fn();
  });
};

const guardedForm = <R>(
  schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
  fn: (data: any) => Promise<R>
) => {
  return form('unchecked', async (data: any) => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');

    const result = v.safeParse(schema, data);
    if (!result.success) {
      console.error('[guardedForm] Validation failed:', result.issues);
      error(400, `Validation failed: ${result.issues.map((i: any) => `${i.path?.map((p: any) => p.key).join('.')}: ${i.message}`).join(', ')}`);
    }

    return fn(result.output);
  });
};

const inferMimeTypeFromKey = (key: string) => {
  const extension = key?.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
    case 'svgz':
      return 'image/svg+xml';
    case 'bmp':
      return 'image/bmp';
    case 'avif':
      return 'image/avif';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
    case 'qt':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'ogg':
    case 'ogv':
      return 'video/ogg';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'application/octet-stream';
  }
};

// ============================================
// BUCKET MANAGEMENT
// ============================================

/**
 * List all R2 buckets from Cloudflare
 */
export const listCloudflareR2Buckets = query('unchecked', async () => {
	const apiToken = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN || env.KURATCHI_CF_API_TOKEN;
	const accountId = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || env.KURATCHI_CF_ACCOUNT_ID;

	if (!apiToken || !accountId) {
		return {
			success: false,
			error: 'Cloudflare credentials not configured',
			buckets: []
		};
	}

	try {
		const { getCloudflareClient } = await import('kuratchi-sdk/domains');
		const client = getCloudflareClient();
		const result = await client.listR2Buckets();

		return {
			success: true,
			buckets: result?.result || []
		};
	} catch (error: any) {
		console.error('[listCloudflareR2Buckets] Error:', error);
		return {
			success: false,
			error: error.message,
			buckets: []
		};
	}
});

/**
 * Get all R2 buckets for this organization from our database
 */
export const getAllBuckets = query('unchecked', async () => {
	const { locals } = getRequestEvent();
	const session = locals.session;
	const activeOrgId = session?.organizationId;

	if (!activeOrgId) {
		return {
			success: false,
			error: 'Organization not found',
			buckets: [],
			orgBuckets: [],
			siteBuckets: [],
			stats: { total: 0, managed: 0, unmanaged: 0, orgLevel: 0, siteLevel: 0 }
		};
	}

	try {
		const orgDb = await getDatabase(locals);
		
		const siteRecords = await orgDb.sites
			.where({ deleted_at: { isNullish: true } })
			.many();

		if (!siteRecords.success) {
			return {
				success: false,
				error: 'Failed to load sites',
				buckets: [],
				orgBuckets: [],
				siteBuckets: [],
				stats: { total: 0, managed: 0, unmanaged: 0, orgLevel: 0, siteLevel: 0 }
			};
		}
		
		const buckets = [];
		
		// Fetch domain status for each bucket
		for (const site of siteRecords.data || []) {
			if (site.r2BucketName) {
				// Try to get public domain status (R2.dev managed domain)
				let publicDomain = null;
				
				try {
					const domainStatus = await r2.getPublicDomain(site.r2BucketName);
					if (domainStatus?.success && domainStatus?.result) {
						publicDomain = {
							enabled: domainStatus.result.enabled,
							domain: domainStatus.result.domain
						};
					}
				} catch (err) {
					console.warn(`[getAllBuckets] Failed to get domain status for ${site.r2BucketName}:`, err);
				}
				
				// Use actual custom storage domain from site record (e.g., subdomain.kuratchi.cloud)
				const customDomain = site.r2StorageDomain || null;
				
				buckets.push({
					name: site.r2BucketName,
					binding: site.r2Binding || 'STORAGE',
					type: 'site',
					metadata: {
						type: 'site',
						name: site.name,
						subdomain: site.subdomain,
						id: site.id,
						status: site.status,
						databaseId: site.databaseId
					},
					publicDomain,
					customDomain, // Actual configured custom domain from kuratchi.cloud zone
					suggestedCustomDomain: site.subdomain ? `${site.subdomain}.kuratchi.cloud` : null,
					isManaged: true,
					organizationId: activeOrgId,
					creation_date: site.created_at
				});
			}
		}

		const siteBuckets = buckets.filter((b: any) => b.metadata?.type === 'site');
		const orgBuckets: any[] = [];

		return {
			success: true,
			buckets,
			orgBuckets,
			siteBuckets,
			stats: {
				total: buckets.length,
				managed: buckets.length,
				unmanaged: 0,
				orgLevel: orgBuckets.length,
				siteLevel: siteBuckets.length
			}
		};
	} catch (error: any) {
		console.error('[getAllBuckets] Error:', error);
		return {
			success: false,
			error: error.message,
			buckets: [],
			orgBuckets: [],
			siteBuckets: [],
			stats: { total: 0, managed: 0, unmanaged: 0, orgLevel: 0, siteLevel: 0 }
		};
	}
});

// ============================================
// MEDIA & FOLDER MANAGEMENT (BUCKET-AWARE)
// ============================================

/**
 * Get R2 bucket info for a specific bucket name
 * Returns the binding name and worker config to use with SDK methods
 */
async function getBucketInfo(bucketName: string) {
	const { locals } = getRequestEvent();
	const orgDb = await getDatabase(locals);
	
	// Find the site with this bucket
	const siteResult = await orgDb.sites
		.where({ r2BucketName: bucketName, deleted_at: { isNullish: true } })
		.one();
	
	if (!siteResult.success || !siteResult.data) {
		error(404, 'Bucket not found');
	}
	
	const site = siteResult.data;
	const binding = site.r2Binding || 'STORAGE';
	
	// Get worker config from the site's database
	let workerConfig: any = null;
	try {
		// Get database record to access worker name
		const adminDb = await getAdminDatabase(locals);
		const dbResult = await adminDb.databases
			.where({ siteId: site.id, deleted_at: { isNullish: true } })
			.one();
		
		if (dbResult.success && dbResult.data) {
			const dbRecord = dbResult.data;
			const workerName = dbRecord.workerName || site.workerName;
			
			if (workerName) {
				// Get token for authentication
				const tokenResult = await adminDb.dbApiTokens
					.where({
						databaseId: dbRecord.id,
						revoked: false,
						deleted_at: { isNullish: true }
					})
					.first();
				
				if (tokenResult.success && tokenResult.data) {
					const gatewayKey = env.KURATCHI_GATEWAY_KEY;
					
					workerConfig = {
						workerName,
						gatewayKey,
						token: tokenResult.data.token,
						databaseName: dbRecord.name || dbRecord.dbuuid
					};
				}
			}
		}
	} catch (err) {
		console.warn(`[getBucketInfo] Failed to get worker config:`, err);
	}
	
	// Log if no worker config found
	if (!workerConfig) {
		console.warn(`[getBucketInfo] No worker config available for bucket ${bucketName}. R2 operations will fail. Site may need worker deployment.`);
	}
	
	// Get storage URL - prefer custom storage domain
	let publicUrl = null;
	if (site.r2StorageDomain) {
		publicUrl = `https://${site.r2StorageDomain}`;
	} else {
		// Fallback to R2.dev public domain
		try {
			const domainStatus = await r2.getPublicDomain(bucketName);
			if (domainStatus?.success && domainStatus?.result?.enabled) {
				publicUrl = `https://${domainStatus.result.domain}`;
			}
		} catch (err) {
			console.warn(`[getBucketInfo] Failed to get domain status for ${bucketName}:`, err);
		}
	}
	
	return { bucketName, binding, site, publicUrl, workerConfig };
}

/**
 * Get bucket details including public URL
 */
export const getBucketDetails = query('unchecked', async (bucketName: string) => {
  try {
    const { locals } = getRequestEvent();
    if (!locals.session?.user) error(401, 'Unauthorized');
    
    if (!bucketName) {
      return null;
    }
    
    const info = await getBucketInfo(bucketName);
    
    return {
      name: info.bucketName,
      publicUrl: info.publicUrl,
      site: {
        id: info.site.id,
        name: info.site.name,
        subdomain: info.site.subdomain
      }
    };
  } catch (err) {
    console.error('[storage.getBucketDetails] error:', err);
    return null;
  }
});

export const getAllMedia = query('unchecked', async (bucketName: string) => {
  try {
    const { locals } = getRequestEvent();
    if (!locals.session?.user) error(401, 'Unauthorized');
    
    if (!bucketName) {
      console.warn('[storage.getAllMedia] No bucket name provided');
      return [];
    }
    
    const { binding, publicUrl, workerConfig } = await getBucketInfo(bucketName);
    const result = await r2.list(binding, { prefix: 'uploads/' }, workerConfig);
    // Transform R2 objects to media format
    return result?.objects?.map((obj: any) => {
      // Extract folder from key path
      // e.g., "uploads/folder-name/file.jpg" -> "uploads/folder-name/"
      const pathParts = obj.key.split('/');
      let folder = null;
      if (pathParts.length > 2) {
        // File is inside a folder
        folder = `${pathParts[0]}/${pathParts[1]}/`;
      }
      
      return {
        id: obj.key,
        filename: obj.key.split('/').pop() || obj.key,
        originalFilename: obj.key.split('/').pop() || obj.key,
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        created_at: obj.uploaded,
        mimeType: obj.httpMetadata?.contentType || inferMimeTypeFromKey(obj.key),
        url: publicUrl ? `${publicUrl}/${obj.key}` : `/api/storage/${obj.key}`,
        folder: folder,
        alt: null
      };
    }).filter((obj: any) => !obj.filename.startsWith('.')) ?? [];
  } catch (err) {
    console.error('[storage.getAllMedia] error:', err);
    return [];
  }
});

export const getFolders = query('unchecked', async (bucketName: string) => {
  try {
    const { locals } = getRequestEvent();
    if (!locals.session?.user) error(401, 'Unauthorized');
    
    if (!bucketName) {
      console.warn('[storage.getFolders] No bucket name provided');
      return [];
    }
    
    const { binding, workerConfig } = await getBucketInfo(bucketName);
    const result = await r2.list(binding, { prefix: 'uploads/', delimiter: '/' }, workerConfig);
    // Extract unique folder prefixes from delimitedPrefixes
    const folders = (result?.delimitedPrefixes || []).map((prefix: string) => {
      // prefix will be like "uploads/folder-name/"
      const folderName = prefix.replace('uploads/', '').replace('/', '');
      return {
        id: prefix,
        name: folderName,
        slug: folderName,
        path: prefix
      };
    });
    
    return folders;
  } catch (err) {
    console.error('[storage.getFolders] error:', err);
    return [];
  }
});

// Forms - Media
export const uploadMedia = guardedForm(
  v.object({
    bucketName: v.pipe(v.string(), v.nonEmpty()),
    files: v.any(), // FileList or File array
    folder: v.optional(v.string())
  }),
  async ({ bucketName, files, folder }) => {
    try {
      const { binding, workerConfig } = await getBucketInfo(bucketName);
      
      const uploadFolder = folder || 'uploads';
      
      // Handle multiple files
      const fileArray = Array.isArray(files) ? files : Array.from(files as FileList);
      
      for (const file of fileArray) {
        // Upload to R2 with custom key
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        
        // Build key with folder support
        let key: string;
        if (folder && folder !== '') {
          // folder is expected to be like "uploads/folder-name/"
          key = `${folder}${timestamp}-${sanitizedName}`;
        } else {
          key = `uploads/${timestamp}-${sanitizedName}`;
        }
        
        // Read file as base64
        const arrayBuffer = await file.arrayBuffer();
        
        await r2.put(binding, key, arrayBuffer, {
          httpMetadata: { contentType: file.type },
          customMetadata: { originalName: file.name }
        }, workerConfig);
      }
      
      await getAllMedia(bucketName).refresh();
      return { success: true };
    } catch (err) {
      console.error('[storage.uploadMedia] error:', err);
      error(500, 'Failed to upload media');
    }
  }
);

export const updateMedia = guardedForm(
  v.object({
    bucketName: v.pipe(v.string(), v.nonEmpty()),
    id: v.pipe(v.string(), v.nonEmpty()), // id is the R2 key
    filename: v.optional(v.string()),
    alt: v.optional(v.string()),
    folder: v.optional(v.string())
  }),
  async ({ bucketName, id, filename, alt, folder }) => {
    try {
      // For now, R2 doesn't support easy metadata updates without re-uploading
      // You could implement this by copying the object with new metadata
      // For simplicity, we'll just refresh the list
      await getAllMedia(bucketName).refresh();
      return { success: true };
    } catch (err) {
      console.error('[storage.updateMedia] error:', err);
      error(500, 'Failed to update media');
    }
  }
);

export const deleteMedia = guardedForm(
  v.object({
    bucketName: v.pipe(v.string(), v.nonEmpty()),
    id: v.pipe(v.string(), v.nonEmpty()) // id is the R2 key
  }),
  async ({ bucketName, id }) => {
    try {
      const { binding, workerConfig } = await getBucketInfo(bucketName);
      
      // Delete from R2 (id is the key)
      await r2.delete(binding, id, workerConfig);
      
      await getAllMedia(bucketName).refresh();
      return { success: true };
    } catch (err) {
      console.error('[storage.deleteMedia] error:', err);
      error(500, 'Failed to delete media');
    }
  }
);

// Forms - Folders (simplified - not using database)
export const createFolder = guardedForm(
  v.object({
    bucketName: v.pipe(v.string(), v.nonEmpty()),
    name: v.pipe(v.string(), v.nonEmpty()),
    slug: v.pipe(v.string(), v.nonEmpty()),
    parentId: v.optional(v.string())
  }),
  async ({ bucketName, name, slug, parentId }) => {
    try {
      const { binding, workerConfig } = await getBucketInfo(bucketName);
      
      // Create a folder by uploading a .keep file
      const folderPath = `uploads/${slug}/`;
      const emptyBuffer = new Uint8Array(0);
      
      await r2.put(binding, `${folderPath}.keep`, emptyBuffer, {
        httpMetadata: { contentType: 'text/plain' },
        customMetadata: { folderName: name }
      }, workerConfig);
      
      await getFolders(bucketName).refresh();
      return { success: true };
    } catch (err) {
      console.error('[storage.createFolder] error:', err);
      error(500, 'Failed to create folder');
    }
  }
);

export const updateFolder = guardedForm(
  v.object({
    bucketName: v.pipe(v.string(), v.nonEmpty()),
    id: v.pipe(v.string(), v.nonEmpty()),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    parentId: v.optional(v.string())
  }),
  async ({ bucketName, id, name, slug, parentId }) => {
    try {
      const { binding, workerConfig } = await getBucketInfo(bucketName);
      
      // For R2 prefix-based folders, renaming means moving all files
      // This is complex, so for now we'll just update the .keep file metadata
      if (slug) {
        const newFolderPath = `uploads/${slug}/`;
        const emptyBuffer = new Uint8Array(0);
        
        // Delete old .keep
        await r2.delete(binding, id + '.keep', workerConfig);
        
        // Create new .keep
        await r2.put(binding, `${newFolderPath}.keep`, emptyBuffer, {
          httpMetadata: { contentType: 'text/plain' },
          customMetadata: { folderName: name || slug }
        }, workerConfig);
      }
      
      await getFolders(bucketName).refresh();
      return { success: true };
    } catch (err) {
      console.error('[storage.updateFolder] error:', err);
      error(500, 'Failed to update folder');
    }
  }
);

export const deleteFolder = guardedForm(
  v.object({
    bucketName: v.pipe(v.string(), v.nonEmpty()),
    id: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ bucketName, id }) => {
    try {
      const { binding, workerConfig } = await getBucketInfo(bucketName);
      
      // List all files in the folder
      const result = await r2.list(binding, { prefix: id }, workerConfig);
      
      // Delete all files in the folder
      if (result?.objects && result.objects.length > 0) {
        for (const obj of result.objects) {
          await r2.delete(binding, obj.key, workerConfig);
        }
      }
      
      await getFolders(bucketName).refresh();
      return { success: true };
    } catch (err) {
      console.error('[storage.deleteFolder] error:', err);
      error(500, 'Failed to delete folder');
    }
  }
);

// ============================================
// DOMAIN MANAGEMENT
// ============================================

/**
 * Enable R2.dev public domain for a bucket
 */
export const enableBucketPublicDomain = guardedForm(
  v.object({
    bucketName: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ bucketName }) => {
    try {
      console.log('[enableBucketPublicDomain] Enabling for:', bucketName);
      
      const result = await r2.enablePublicDomain(bucketName);
      
      if (!result.success) {
        console.error('[enableBucketPublicDomain] Failed:', result.errors);
        error(500, result.errors?.[0]?.message || 'Failed to enable public domain');
      }
      
      console.log('[enableBucketPublicDomain] Success:', result.result);
      
      await getAllBuckets(undefined).refresh();
      return { 
        success: true,
        domain: result.result?.domain
      };
    } catch (err: any) {
      console.error('[enableBucketPublicDomain] error:', err);
      error(500, err.message || 'Failed to enable public domain');
    }
  }
);

/**
 * Disable R2.dev public domain for a bucket
 */
export const disableBucketPublicDomain = guardedForm(
  v.object({
    bucketName: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ bucketName }) => {
    try {
      console.log('[disableBucketPublicDomain] Disabling for:', bucketName);
      
      const result = await r2.disablePublicDomain(bucketName);
      
      if (!result.success) {
        console.error('[disableBucketPublicDomain] Failed:', result.errors);
        error(500, result.errors?.[0]?.message || 'Failed to disable public domain');
      }
      
      await getAllBuckets(undefined).refresh();
      return { success: true };
    } catch (err: any) {
      console.error('[disableBucketPublicDomain] error:', err);
      error(500, err.message || 'Failed to disable public domain');
    }
  }
);

/**
 * Add custom domain to a bucket
 */
export const addBucketCustomDomain = guardedForm(
  v.object({
    bucketName: v.pipe(v.string(), v.nonEmpty()),
    customDomain: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ bucketName, customDomain }) => {
    try {
      console.log('[addBucketCustomDomain] Adding domain:', { bucketName, customDomain });
      
      const result = await r2.addCustomDomain(bucketName, customDomain);
      
      if (!result.success) {
        console.error('[addBucketCustomDomain] Failed:', result.errors);
        error(500, result.errors?.[0]?.message || 'Failed to add custom domain');
      }
      
      await getAllBuckets(undefined).refresh();
      return { 
        success: true,
        domain: customDomain
      };
    } catch (err: any) {
      console.error('[addBucketCustomDomain] error:', err);
      error(500, err.message || 'Failed to add custom domain');
    }
  }
);

/**
 * Remove custom domain from a bucket
 */
export const removeBucketCustomDomain = guardedForm(
  v.object({
    bucketName: v.pipe(v.string(), v.nonEmpty()),
    customDomain: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ bucketName, customDomain }) => {
    try {
      console.log('[removeBucketCustomDomain] Removing domain:', { bucketName, customDomain });
      
      const result = await r2.removeCustomDomain(bucketName, customDomain);
      
      if (!result.success) {
        console.error('[removeBucketCustomDomain] Failed:', result.errors);
        error(500, result.errors?.[0]?.message || 'Failed to remove custom domain');
      }
      
      await getAllBuckets(undefined).refresh();
      return { success: true };
    } catch (err: any) {
      console.error('[removeBucketCustomDomain] error:', err);
      error(500, err.message || 'Failed to remove custom domain');
    }
  }
);

// ============================================
// SITE MEDIA UPLOADS (FOR EDITOR)
// ============================================

const UploadSiteMediaSchema = v.object({
	siteId: v.pipe(v.string(), v.nonEmpty()),
	fileData: v.any(), // ArrayBuffer
	fileName: v.pipe(v.string(), v.nonEmpty()),
	fileType: v.pipe(v.string(), v.nonEmpty()),
	folder: v.optional(v.string())
});

type UploadSiteMediaPayload = v.InferOutput<typeof UploadSiteMediaSchema>;

/**
 * Upload media to site's R2 bucket (used by the editor)
 * Takes a siteId and looks up the bucket automatically
 */
export const uploadSiteMedia = command(UploadSiteMediaSchema, async ({ siteId, fileData, fileName, fileType, folder }: UploadSiteMediaPayload) => {
	const { locals } = getRequestEvent();
	const session = locals.session;

	if (!siteId) {
		error(400, 'Site ID required');
	}

	// Get site and verify it has an R2 bucket
	const db = await getDatabase(locals);
	const siteResult = await db.sites
		.where({ id: siteId, deleted_at: { isNullish: true } })
		.one();

	if (!siteResult.success || !siteResult.data) {
		error(404, 'Site not found');
	}

	const site = siteResult.data;

	if (!site.r2BucketName) {
		error(500, 'Site does not have an R2 bucket configured');
	}

	// Use folder or default to 'images'
	const uploadFolder = folder || 'images';

	if (!fileData) {
		error(400, 'No file provided');
	}

	// Generate unique filename
	const timestamp = Date.now();
	const randomStr = Math.random().toString(36).substring(2, 8);
	const ext = fileName.split('.').pop();
	const filename = `${timestamp}-${randomStr}.${ext}`;
	const key = `${uploadFolder}/${filename}`;

	// Upload file to R2 using SDK
	const binding = site.r2Binding || 'STORAGE';
	
	// Get worker config
	let workerConfig: any = null;
	try {
		const adminDb = await getAdminDatabase(locals);
		const dbResult = await adminDb.databases
			.where({ siteId: site.id, deleted_at: { isNullish: true } })
			.one();
		
		if (dbResult.success && dbResult.data) {
			const dbRecord = dbResult.data;
			const workerName = dbRecord.workerName || site.workerName;
			
			if (workerName) {
				const tokenResult = await adminDb.dbApiTokens
					.where({
						databaseId: dbRecord.id,
						revoked: false,
						deleted_at: { isNullish: true }
					})
					.first();
				
				if (tokenResult.success && tokenResult.data) {
					const gatewayKey = env.KURATCHI_GATEWAY_KEY;
					const workersSubdomain = env.CLOUDFLARE_WORKERS_SUBDOMAIN;
					
					workerConfig = {
						workerName,
						gatewayKey,
						token: tokenResult.data.token,
						databaseName: dbRecord.name || dbRecord.dbuuid,
						workersSubdomain
					};
				}
			}
		}
	} catch (err) {
		console.warn('[uploadSiteMedia] Failed to get worker config:', err);
	}
	
	console.log('[uploadSiteMedia] About to upload:', {
		binding,
		key,
		fileSize: fileData instanceof ArrayBuffer ? fileData.byteLength : 0,
		hasWorkerConfig: !!workerConfig,
		workerConfig: workerConfig ? {
			workerName: workerConfig.workerName,
			databaseName: workerConfig.databaseName,
			hasToken: !!workerConfig.token,
			hasGatewayKey: !!workerConfig.gatewayKey
		} : null
	});
	
	const putResult = await r2.put(binding, key, fileData, {
		httpMetadata: {
			contentType: fileType || 'application/octet-stream',
		},
		customMetadata: {
			originalName: fileName,
			uploadedBy: session?.userId || 'unknown',
			uploadedAt: new Date().toISOString(),
		}
	}, workerConfig);

	console.log('[uploadSiteMedia] R2 put result:', putResult);

	// Check if upload failed
	if (!putResult) {
		error(500, 'Failed to upload file to R2. Check worker logs for details.');
	}

	// Get storage URL - prefer custom storage domain (e.g., subdomain.kuratchi.cloud)
	let publicUrl = null;
	
	// First check if site has a custom storage domain configured
	if (site.r2StorageDomain) {
		publicUrl = `https://${site.r2StorageDomain}/${key}`;
		console.log('[uploadSiteMedia] Using custom storage domain:', site.r2StorageDomain);
	} else {
		// Fallback to R2.dev public domain if no custom domain
		try {
			const domainStatus = await r2.getPublicDomain(site.r2BucketName);
			console.log('[uploadSiteMedia] Domain status:', domainStatus);
			
			if (domainStatus?.success && domainStatus?.result?.enabled && domainStatus?.result?.domain) {
				publicUrl = `https://${domainStatus.result.domain}/${key}`;
			}
		} catch (err) {
			console.warn('[uploadSiteMedia] Failed to get domain status:', err);
		}
	}
	
	// No fallback - a storage domain must be configured
	if (!publicUrl) {
		error(500, 'No storage domain configured for this bucket. Please configure a custom domain or enable public access.');
	}

	const fileSize = fileData instanceof ArrayBuffer ? fileData.byteLength : 0;

	console.log('[Site Media Upload] File uploaded:', {
		siteId,
		bucket: site.r2BucketName,
		key,
		size: fileSize,
		type: fileType,
		publicUrl,
		putResult
	});

	return {
		success: true,
		url: publicUrl,
		key,
		filename,
		size: fileSize,
		contentType: fileType
	};
});

// ============================================================================
// Organization-Level Storage (Shared Bucket with Prefixes)
// ============================================================================

/**
 * Upload email media to organization storage
 * Used for email campaigns, newsletters, etc. that aren't site-specific
 */
export const uploadEmailMedia = command(
	v.object({
		file: v.any(), // File object
		folder: v.optional(v.string(), 'emails')
	}),
	async ({ file, folder }) => {
		const { locals } = getRequestEvent();
		if (!locals.session?.user) error(401, 'Unauthorized');

		const orgId = (locals as any)?.kuratchi?.superadmin?.getActiveOrgId?.() || locals.session?.organizationId;
		
		if (!orgId) {
			error(400, 'No active organization');
		}

		const bucket = getSharedBucket();
		if (!bucket) {
			error(500, 'Storage not available');
		}

		// Generate unique filename
		const timestamp = Date.now();
		const randomStr = Math.random().toString(36).substring(2, 8);
		const ext = file.name.split('.').pop();
		const filename = `${timestamp}-${randomStr}.${ext}`;
		
		// Key format: org-{orgId}/emails/{filename}
		const prefix = getOrgPrefix(orgId);
		const key = `${prefix}/${folder}/${filename}`;

		// Upload to shared bucket with org prefix
		const arrayBuffer = await file.arrayBuffer();
		await bucket.put(key, arrayBuffer, {
			httpMetadata: {
				contentType: file.type || 'application/octet-stream',
			},
			customMetadata: {
				originalName: file.name,
				uploadedBy: locals.session.userId || 'unknown',
				uploadedAt: new Date().toISOString(),
				organizationId: orgId
			}
		});

		// Generate public URL (assuming public domain is enabled)
		// TODO: Get actual public domain from bucket config
		const publicUrl = `https://pub-kuratchi-storage.r2.dev/${key}`;

		return {
			success: true,
			url: publicUrl,
			key,
			filename,
			size: file.size,
			contentType: file.type
		};
	}
);

/**
 * List email media for organization
 */
export const listEmailMedia = query('unchecked', async (folder: string = 'emails') => {
	const { locals } = getRequestEvent();
	if (!locals.session?.user) error(401, 'Unauthorized');

	const orgId = (locals as any)?.kuratchi?.superadmin?.getActiveOrgId?.() || locals.session?.organizationId;
	if (!orgId) {
		error(400, 'No active organization');
	}

	const bucket = getSharedBucket();
	if (!bucket) {
		return [];
	}

	const prefix = `${getOrgPrefix(orgId)}/${folder}/`;
	const result = await bucket.list({ prefix });

	return result?.objects?.map((obj: any) => ({
		id: obj.key,
		filename: obj.key.split('/').pop() || obj.key,
		key: obj.key,
		size: obj.size,
		uploaded: obj.uploaded,
		mimeType: obj.httpMetadata?.contentType,
		url: `https://pub-kuratchi-storage.r2.dev/${obj.key}` // TODO: Get actual public domain
	})) || [];
});

/**
 * Delete email media from organization storage
 */
export const deleteEmailMedia = command(
	v.object({
		key: v.pipe(v.string(), v.nonEmpty())
	}),
	async ({ key }) => {
		const { locals } = getRequestEvent();
		if (!locals.session?.user) error(401, 'Unauthorized');

		const orgId = (locals as any)?.kuratchi?.superadmin?.getActiveOrgId?.() || locals.session?.organizationId;
		if (!orgId) {
			error(400, 'No active organization');
		}

		// Verify key belongs to this organization
		const prefix = getOrgPrefix(orgId);
		if (!key.startsWith(prefix)) {
			error(403, 'Access denied');
		}

		const bucket = getSharedBucket();
		if (!bucket) {
			error(500, 'Storage not available');
		}

		await bucket.delete(key);

		return { success: true };
	}
);
