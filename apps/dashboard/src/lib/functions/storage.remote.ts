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
 * Get organization R2 bucket (single bucket per organization)
 * Returns bucket info from the primary database record
 */
export const getOrganizationBucket = query('unchecked', async () => {
	const { locals } = getRequestEvent();
	const session = locals.session;
	const activeOrgId = session?.organizationId;

	if (!activeOrgId) {
		return {
			success: false,
			error: 'Organization not found',
			bucket: null
		};
	}

	try {
		const adminDb = await getAdminDatabase(locals);
		
		// Get the primary database record for this organization (has the R2 bucket)
		const dbResult = await adminDb.databases
			.where({ 
				organizationId: activeOrgId, 
				isPrimary: true,
				deleted_at: { isNullish: true } 
			})
			.first();

		if (!dbResult.success || !dbResult.data) {
			// Fallback: try to get any database with R2 bucket for this org
			const anyDbResult = await adminDb.databases
				.where({ 
					organizationId: activeOrgId,
					deleted_at: { isNullish: true }
				})
				.many();
			
			const dbWithBucket = anyDbResult.data?.find((db: any) => db.r2BucketName);
			
			if (!dbWithBucket) {
				return {
					success: false,
					error: 'No storage bucket configured for this organization',
					bucket: null
				};
			}
			
			// Use the found bucket
			const bucket = {
				name: dbWithBucket.r2BucketName,
				binding: dbWithBucket.r2Binding || 'STORAGE',
				storageDomain: dbWithBucket.r2StorageDomain || null,
				organizationId: activeOrgId,
				databaseId: dbWithBucket.id,
				workerName: dbWithBucket.workerName,
				creation_date: dbWithBucket.created_at
			};
			
			return {
				success: true,
				bucket
			};
		}

		const dbRecord = dbResult.data;
		
		if (!dbRecord.r2BucketName) {
			return {
				success: false,
				error: 'Organization bucket not provisioned',
				bucket: null
			};
		}

		const bucket = {
			name: dbRecord.r2BucketName,
			binding: dbRecord.r2Binding || 'STORAGE',
			storageDomain: dbRecord.r2StorageDomain || null,
			organizationId: activeOrgId,
			databaseId: dbRecord.id,
			workerName: dbRecord.workerName,
			creation_date: dbRecord.created_at
		};

		return {
			success: true,
			bucket
		};
	} catch (error: any) {
		console.error('[getOrganizationBucket] Error:', error);
		return {
			success: false,
			error: error.message,
			bucket: null
		};
	}
});

/**
 * Update the storage domain for the current organization's R2 bucket
 * This should be called after manually setting up the DNS record in Cloudflare
 */
export const updateStorageDomain = command(
	v.object({
		storageDomain: v.pipe(v.string(), v.nonEmpty())
	}),
	async ({ storageDomain }) => {
		const { locals } = getRequestEvent();
		const session = locals.session;
		
		if (!session?.user) {
			error(401, 'Unauthorized');
		}
		
		const activeOrgId = session?.organizationId;
		if (!activeOrgId) {
			error(400, 'Organization not found');
		}

		try {
			const adminDb = await getAdminDatabase(locals);
			
			// Get the primary database record for this organization
			const dbResult = await adminDb.databases
				.where({ 
					organizationId: activeOrgId, 
					isPrimary: true,
					deleted_at: { isNullish: true } 
				})
				.first();

			if (!dbResult.success || !dbResult.data) {
				error(404, 'No database record found for this organization');
			}

			const dbRecord = dbResult.data;
			
			if (!dbRecord.r2BucketName) {
				error(400, 'No R2 bucket configured for this organization');
			}

			// Update the storage domain
			await adminDb.databases
				.where({ id: dbRecord.id })
				.update({ 
					r2StorageDomain: storageDomain,
					updated_at: new Date().toISOString()
				});

			console.log('[updateStorageDomain] Updated storage domain:', {
				organizationId: activeOrgId,
				bucketName: dbRecord.r2BucketName,
				storageDomain
			});

			return {
				success: true,
				bucketName: dbRecord.r2BucketName,
				storageDomain
			};
		} catch (err: any) {
			console.error('[updateStorageDomain] Error:', err);
			error(500, err.message || 'Failed to update storage domain');
		}
	}
);

/**
 * Get all R2 buckets for this organization from our database
 * @deprecated Use getOrganizationBucket instead - we now have one bucket per org
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
		// Get organization bucket from primary database
		const orgBucketResult = await getOrganizationBucket();
		
		if (!orgBucketResult.success || !orgBucketResult.bucket) {
			return {
				success: false,
				error: orgBucketResult.error || 'No bucket found',
				buckets: [],
				orgBuckets: [],
				siteBuckets: [],
				stats: { total: 0, managed: 0, unmanaged: 0, orgLevel: 0, siteLevel: 0 }
			};
		}
		
		const bucket = orgBucketResult.bucket;
		
		// Get public domain status
		let publicDomain = null;
		try {
			const domainStatus = await r2.getPublicDomain(bucket.name);
			if (domainStatus?.success && domainStatus?.result) {
				publicDomain = {
					enabled: domainStatus.result.enabled,
					domain: domainStatus.result.domain
				};
			}
		} catch (err) {
			console.warn(`[getAllBuckets] Failed to get domain status for ${bucket.name}:`, err);
		}
		
		const bucketWithDomain = {
			...bucket,
			publicDomain,
			customDomain: bucket.storageDomain,
			type: 'organization',
			isManaged: true,
			metadata: {
				type: 'organization',
				organizationId: activeOrgId
			}
		};

		return {
			success: true,
			buckets: [bucketWithDomain],
			orgBuckets: [bucketWithDomain],
			siteBuckets: [], // No more site-level buckets
			stats: {
				total: 1,
				managed: 1,
				unmanaged: 0,
				orgLevel: 1,
				siteLevel: 0
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
 * Now uses organization-level bucket from primary database record
 */
async function getBucketInfo(bucketName: string) {
	const { locals } = getRequestEvent();
	const adminDb = await getAdminDatabase(locals);
	const session = locals.session;
	const activeOrgId = session?.organizationId;
	
	if (!activeOrgId) {
		error(401, 'Organization not found');
	}
	
	// Find the database record with this bucket (organization-level)
	const dbResult = await adminDb.databases
		.where({ 
			r2BucketName: bucketName, 
			organizationId: activeOrgId,
			deleted_at: { isNullish: true } 
		})
		.one();
	
	if (!dbResult.success || !dbResult.data) {
		error(404, 'Bucket not found for this organization');
	}
	
	const dbRecord = dbResult.data;
	const binding = dbRecord.r2Binding || 'STORAGE';
	
	// Get worker config from the database record
	let workerConfig: any = null;
	try {
		const workerName = dbRecord.workerName;
		
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
				const workersSubdomain = env.CLOUDFLARE_WORKERS_SUBDOMAIN;
				
				workerConfig = {
					workerName,
					workersSubdomain,
					gatewayKey,
					token: tokenResult.data.token,
					databaseName: dbRecord.name || dbRecord.dbuuid
				};
			}
		}
	} catch (err) {
		console.warn(`[getBucketInfo] Failed to get worker config:`, err);
	}
	
	// Log if no worker config found
	if (!workerConfig) {
		console.warn(`[getBucketInfo] No worker config available for bucket ${bucketName}. R2 operations will fail.`);
	}
	
	// Get storage URL - prefer custom storage domain
	let publicUrl = null;
	if (dbRecord.r2StorageDomain) {
		publicUrl = `https://${dbRecord.r2StorageDomain}`;
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
	
	return { bucketName, binding, publicUrl, workerConfig };
}

/**
 * Get organization bucket info (internal helper)
 * Resolves bucket from organization's primary database
 */
async function getOrgBucketInfo() {
	const { locals } = getRequestEvent();
	const adminDb = await getAdminDatabase(locals);
	const session = locals.session;
	const activeOrgId = session?.organizationId;
	
	if (!activeOrgId) {
		throw new Error('Organization not found');
	}
	
	// Get the primary database record for this organization
	let dbResult = await adminDb.databases
		.where({ 
			organizationId: activeOrgId, 
			isPrimary: true,
			deleted_at: { isNullish: true } 
		})
		.first();

	// Fallback: try to get any database with R2 bucket
	if (!dbResult.success || !dbResult.data) {
		const anyDbResult = await adminDb.databases
			.where({ 
				organizationId: activeOrgId,
				deleted_at: { isNullish: true }
			})
			.many();
		
		const dbWithBucket = anyDbResult.data?.find((db: any) => db.r2BucketName);
		if (dbWithBucket) {
			dbResult = { success: true, data: dbWithBucket };
		}
	}
	
	if (!dbResult?.success || !dbResult?.data?.r2BucketName) {
		throw new Error('No storage bucket configured for this organization');
	}
	
	const dbRecord = dbResult.data;
	const bucketName = dbRecord.r2BucketName;
	const binding = dbRecord.r2Binding || 'STORAGE';
	
	// Get worker config
	let workerConfig: any = null;
	const workerName = dbRecord.workerName;
	
	if (workerName) {
		const tokenResult = await adminDb.dbApiTokens
			.where({
				databaseId: dbRecord.id,
				revoked: false,
				deleted_at: { isNullish: true }
			})
			.first();
		
		if (tokenResult.success && tokenResult.data) {
			workerConfig = {
				workerName,
				workersSubdomain: env.CLOUDFLARE_WORKERS_SUBDOMAIN,
				gatewayKey: env.KURATCHI_GATEWAY_KEY,
				token: tokenResult.data.token,
				databaseName: dbRecord.name || dbRecord.dbuuid
			};
		}
	}
	
	// Get public URL
	let publicUrl = null;
	if (dbRecord.r2StorageDomain) {
		publicUrl = `https://${dbRecord.r2StorageDomain}`;
	} else {
		try {
			const domainStatus = await r2.getPublicDomain(bucketName);
			if (domainStatus?.success && domainStatus?.result?.enabled) {
				publicUrl = `https://${domainStatus.result.domain}`;
			}
		} catch (err) {
			console.warn(`[getOrgBucketInfo] Failed to get domain status:`, err);
		}
	}
	
	return { bucketName, binding, publicUrl, workerConfig, storageDomain: dbRecord.r2StorageDomain };
}

// ============================================
// ORGANIZATION STORAGE (no bucket param needed)
// ============================================

/**
 * Storage path patterns:
 * - sites/{subdomain}/{folder}/...     - Site-specific uploads
 * - catalog/{oem}/{category}/{model}/... - Catalog vehicle images  
 * - uploads/...                         - General organization uploads
 * - emails/...                          - Email attachments
 */
type StorageSource = 'sites' | 'catalog' | 'uploads' | 'emails' | 'other';

/**
 * Get all storage media for the organization
 * Supports filtering by source type and site
 */
export const getStorageMedia = query('unchecked', async (sourceFilter?: string) => {
	try {
		const { locals } = getRequestEvent();
		if (!locals.session?.user) error(401, 'Unauthorized');
		
		const { binding, publicUrl, workerConfig } = await getOrgBucketInfo();
		
		// Determine prefix based on filter
		// sourceFilter can be: 'sites', 'sites/{subdomain}', 'catalog', 'uploads', 'emails', or undefined for all
		let prefix = '';
		if (sourceFilter) {
			prefix = sourceFilter.endsWith('/') ? sourceFilter : `${sourceFilter}/`;
		}
		
		const result = await r2.list(binding, { prefix }, workerConfig);
		
		return {
			success: true,
			media: result?.objects?.map((obj: any) => {
				const pathParts = obj.key.split('/');
				const rootFolder = pathParts[0];
				
				// Determine source type
				let source: StorageSource = 'other';
				let site: string | null = null;
				let folder: string | null = null;
				let catalogInfo: { oem?: string; category?: string; model?: string } | null = null;
				
				if (rootFolder === 'sites' && pathParts.length > 1) {
					source = 'sites';
					site = pathParts[1];
					if (pathParts.length > 3) {
						folder = pathParts.slice(2, -1).join('/');
					}
				} else if (rootFolder === 'catalog') {
					source = 'catalog';
					// catalog/{oem}/{category}/{model}/filename
					if (pathParts.length >= 4) {
						catalogInfo = {
							oem: pathParts[1],
							category: pathParts[2],
							model: pathParts[3]
						};
					}
				} else if (rootFolder === 'uploads') {
					source = 'uploads';
					if (pathParts.length > 2) {
						folder = pathParts.slice(1, -1).join('/');
					}
				} else if (rootFolder === 'emails') {
					source = 'emails';
					if (pathParts.length > 2) {
						folder = pathParts.slice(1, -1).join('/');
					}
				}
				
				return {
					id: obj.key,
					key: obj.key,
					filename: pathParts[pathParts.length - 1] || obj.key,
					size: obj.size,
					uploaded: obj.uploaded,
					mimeType: obj.httpMetadata?.contentType || inferMimeTypeFromKey(obj.key),
					url: publicUrl ? `${publicUrl}/${obj.key}` : null,
					source,
					site,
					folder,
					catalogInfo
				};
			}).filter((obj: any) => !obj.filename.startsWith('.')) ?? [],
			publicUrl
		};
	} catch (err: any) {
		console.error('[getStorageMedia] error:', err);
		return { success: false, error: err.message, media: [], publicUrl: null };
	}
});

/**
 * Get storage details for the organization bucket
 */
export const getStorageDetails = query('unchecked', async () => {
	try {
		const { locals } = getRequestEvent();
		if (!locals.session?.user) error(401, 'Unauthorized');
		
		const { bucketName, publicUrl, storageDomain } = await getOrgBucketInfo();
		
		return {
			success: true,
			bucket: bucketName,
			publicUrl,
			storageDomain
		};
	} catch (err: any) {
		console.error('[getStorageDetails] error:', err);
		return { success: false, error: err.message, bucket: null, publicUrl: null, storageDomain: null };
	}
});

/**
 * Upload media to organization storage
 * 
 * Storage paths:
 * - With site: sites/{subdomain}/{folder}/{filename}
 * - Without site: uploads/{folder}/{filename}
 */
export const uploadStorageMedia = guardedForm(
	v.object({
		file: v.any(),
		siteSubdomain: v.optional(v.string()),
		folder: v.optional(v.string())
	}),
	async (data) => {
		try {
			const { binding, publicUrl, workerConfig } = await getOrgBucketInfo();
			
			// Build path with consistent structure
			let path = '';
			if (data.siteSubdomain) {
				// Site-specific: sites/{subdomain}/{folder}/
				path = `sites/${data.siteSubdomain}/`;
				if (data.folder) {
					path += `${data.folder}/`;
				} else {
					path += 'uploads/';
				}
			} else {
				// Organization-level: uploads/{folder}/
				path = 'uploads/';
				if (data.folder) {
					path += `${data.folder}/`;
				}
			}
			
			const file = data.file as File;
			const key = `${path}${file.name}`;
			const arrayBuffer = await file.arrayBuffer();
			
			await r2.put(binding, key, arrayBuffer, {
				httpMetadata: { contentType: file.type }
			}, workerConfig);
			
			await getStorageMedia(undefined).refresh();
			
			return {
				success: true,
				key,
				url: publicUrl ? `${publicUrl}/${key}` : null
			};
		} catch (err: any) {
			console.error('[uploadStorageMedia] error:', err);
			return { success: false, error: err.message };
		}
	}
);

/**
 * Delete media from organization storage
 */
export const deleteStorageMedia = guardedForm(
	v.object({ key: v.string() }),
	async (data) => {
		try {
			const { binding, workerConfig } = await getOrgBucketInfo();
			
			await r2.delete(binding, data.key, workerConfig);
			await getStorageMedia(undefined).refresh();
			
			return { success: true };
		} catch (err: any) {
			console.error('[deleteStorageMedia] error:', err);
			return { success: false, error: err.message };
		}
	}
);

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
