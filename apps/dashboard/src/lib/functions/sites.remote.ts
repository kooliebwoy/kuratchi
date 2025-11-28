import { getRequestEvent, query, form, command } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { database, r2 } from 'kuratchi-sdk';
import { getDatabase, getAdminDatabase, getSiteDatabase } from '$lib/server/db-context';
import { sitesSchema } from '$lib/schemas/sites';
import { getThemeHomepage, getThemeTemplate, DEFAULT_THEME_ID } from '@kuratchi/editor';

// Helper to check permissions
const requirePermission = (permission: string) => {
	const { locals } = getRequestEvent();
	const kur = locals.kuratchi as any;
	
	if (!kur?.roles?.hasPermission?.(permission)) {
		error(403, `Missing required permission: ${permission}`);
	}
};

// Helper to log activity
const logActivity = async (action: string, data?: any) => {
	const { locals } = getRequestEvent();
	const kur = locals.kuratchi as any;
	const session = locals.session;
	const organizationId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;

	try {
		await kur?.activity?.log?.({
			action,
			data,
			organizationId
		});
	} catch (err) {
		console.error('[logActivity] Failed to log activity:', err);
	}
};

// Guarded query with permission check
const guardedQuery = <R>(permission: string, fn: () => Promise<R>) => {
	return query(async () => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');
		
		// Check permission
		requirePermission(permission);
		
		return fn();
	});
};

// Guarded form with permission check and activity logging
const guardedForm = <R>(
	permission: string,
	schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
	activityType: string,
	fn: (data: any) => Promise<R>
) => {
	return form('unchecked', async (data: any) => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');

		// Check permission
		requirePermission(permission);

		// Validate with valibot
		const result = v.safeParse(schema, data);
		if (!result.success) {
			console.error('[guardedForm] Validation failed:', result.issues);
			error(400, `Validation failed: ${result.issues.map((i: any) => `${i.path?.map((p: any) => p.key).join('.')}: ${i.message}`).join(', ')}`);
		}

		// Execute action
		const output = await fn(result.output);

		// Log activity
		await logActivity(activityType, {
			input: result.output,
			output
		});

		return output;
	});
};

// Log route activity
export const logRouteActivity = guardedQuery('sites.read', async () => {
	await logActivity('sites.viewed');
	return { success: true };
});

// Get all sites for the organization
export const getSites = guardedQuery('sites.read', async () => {
	const { locals } = getRequestEvent();

	const session = locals.session;
	const activeOrgId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;
	
	if (!activeOrgId) {
		return [];
	}
	
	try {
		const db = await getDatabase(locals);
		const result = await db.sites
			.where({ deleted_at: { isNullish: true } })
			.many();

		if (!result.success) {
			console.error('Failed to fetch sites:', result.error);
			return [];
		}

		console.log('[getSites] activeOrgId:', activeOrgId, 'count:', result.data?.length || 0);
		
		return result.data || [];
	} catch (err) {
		console.error('Error fetching sites:', err);
		return [];
	}
});

// Get a single site by ID
export const getSiteById = guardedQuery('sites.read', async () => {
	const { locals, params } = getRequestEvent();
	const session = locals.session;
	const activeOrgId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;
	const siteId = params.id;
	
	if (!activeOrgId || !siteId) {
		error(400, 'Missing required parameters');
	}
	
	try {
		const db = await getDatabase(locals);
		const result = await db.sites
			.where({ id: siteId, deleted_at: { isNullish: true } })
			.one();

		if (!result.success || !result.data) {
			console.error('Site not found:', siteId);
			error(404, 'Site not found');
		}

		const site = result.data;
		
		return site;
	} catch (err) {
		console.error('Error fetching site:', err);
		error(404, 'Site not found');
	}
});

// Create site schema - only require the site name
const createSiteSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Site name is required'))
});

// Create a new site
export const createSite = guardedForm(
	'sites.create',      // Required permission
	createSiteSchema,    // Validation schema
	'sites.created',     // Activity type to log
	async (data) => {
		const { locals } = getRequestEvent();
		const session = locals.session;
		const activeOrgId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;
		const userId = session?.user?.id;

		if (!activeOrgId || !userId) {
			error(400, 'Organization ID and User ID are required');
		}

		try {
			const now = new Date().toISOString();
			const siteId = crypto.randomUUID();
			const dbId = crypto.randomUUID();
			const themeId = DEFAULT_THEME_ID;

			// Derive a base subdomain from the site name
			const baseSlug = data.name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '')
				.slice(0, 50) || `site-${siteId.substring(0, 8)}`;

			const { locals } = getRequestEvent();
			const db = await getDatabase(locals);
			const kv = (locals.kuratchi as any)?.kv?.default;

			// Ensure subdomain uniqueness using KV and org DB
			let subdomain = baseSlug;
			for (let i = 0; i < 20; i++) {
				const candidate = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`;

				let kvExists = false;
				if (kv) {
					try {
						const existing = await kv.get(`site:subdomain:${candidate}`);
						kvExists = !!existing;
					} catch (kvErr) {
						console.error('[createSite] KV check failed:', kvErr);
					}
				}

				let dbExists = false;
				try {
					const existingSite = await db.sites
						.where({ subdomain: candidate, deleted_at: { isNullish: true } })
						.first();
					if (existingSite.success && existingSite.data) {
						dbExists = true;
					}
				} catch (dbErr) {
					console.error('[createSite] DB subdomain check failed:', dbErr);
				}

				if (!kvExists && !dbExists) {
					subdomain = candidate;
					break;
				}
			}

			if (!subdomain) {
				console.error('[createSite] Failed to generate unique subdomain for site:', data.name);
				error(400, 'Unable to generate a unique subdomain. Please try again with a different name.');
			}

			console.log('[createSite] Creating site:', {
				siteId,
				name: data.name,
				subdomain,
			});
			
			// Provision R2 bucket for site storage
			const r2BucketName = `site-${subdomain}-${crypto.randomUUID().substring(0, 8)}`;
			const r2Binding = 'STORAGE';
			
			let r2Created = false;
			try {
				const apiToken = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN || env.KURATCHI_CF_API_TOKEN;
				const accountId = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || env.KURATCHI_CF_ACCOUNT_ID;
				
				console.log('[createSite] R2 credentials check:', {
					hasApiToken: !!apiToken,
					hasAccountId: !!accountId,
					accountId: accountId ? `${accountId.substring(0, 8)}...` : 'none'
				});
				
				if (apiToken && accountId) {
					console.log('[createSite] Creating R2 bucket:', r2BucketName);
					const r2Result = await r2.createBucket(r2BucketName, { apiToken, accountId });
					console.log('[createSite] R2 result:', r2Result);
					if (r2Result.success) {
						console.log('[createSite] ✓ R2 bucket created:', r2BucketName);
						r2Created = true;
					} else {
						console.warn('[createSite] R2 bucket creation failed:', r2Result.errors);
					}
				} else {
					console.warn('[createSite] Cloudflare credentials not available, skipping R2 provisioning');
				}
			} catch (r2Error: any) {
				console.error('[createSite] Failed to create R2 bucket - Full error:', r2Error);
				console.error('[createSite] Error message:', r2Error.message);
				console.error('[createSite] Error stack:', r2Error.stack);
				// Non-fatal: continue without R2
			}

			// Step 1: Create the site database with sites schema
			// Use siteId prefix (first 8 chars) + subdomain to keep under 63 char limit
			const shortId = siteId.substring(0, 8);
			const dbName = `site-${shortId}-${subdomain}`;
			const created = await database.create({
				name: dbName,
				schema: sitesSchema,
				schemaName: 'sites',
				migrate: true
			});

			console.log('[createSite] Database created:', {
				databaseName: created.databaseName,
				databaseId: created.databaseId,
				workerName: created.workerName
			});

			// Step 1.5: If R2 bucket was created, bind it to the worker and redeploy
			let r2StorageDomain: string | null = null;
			if (r2Created && created.workerName && created.databaseId) {
				try {
					console.log('[createSite] Binding R2 bucket to worker:', {
						workerName: created.workerName,
						bucketName: r2BucketName,
						binding: r2Binding,
						databaseId: created.databaseId
					});
					
					const apiToken = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN || env.KURATCHI_CF_API_TOKEN;
					const accountId = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || env.KURATCHI_CF_ACCOUNT_ID;
					const gatewayKey = env.KURATCHI_GATEWAY_KEY;
					
					if (apiToken && accountId && gatewayKey) {
						// Add R2 binding to worker using r2 namespace
						const bindResult = await r2.addWorkerBinding(
							created.workerName,
							r2BucketName,
							r2Binding,
							created.databaseId,
							gatewayKey,
							{ apiToken, accountId }
						);
						
						if (bindResult?.success) {
							console.log('[createSite] ✓ R2 bucket bound to worker successfully');
						} else {
							console.warn('[createSite] Failed to bind R2 bucket to worker:', bindResult);
						}
						
						// Step 1.6: Add custom domain from kuratchi.cloud zone for storage
						// This allows serving media directly via {subdomain}.kuratchi.cloud
						const bucketOriginHost = env.KURATCHI_BUCKET_ORIGIN_HOST;
						const bucketZoneId = env.KURATCHI_BUCKET_ZONE_ID;
						if (bucketOriginHost && bucketZoneId) {
							const storageDomain = `${subdomain}.${bucketOriginHost}`;
							console.log('[createSite] Adding custom storage domain:', storageDomain);
							
							try {
								const domainResult = await r2.addCustomDomain(r2BucketName, storageDomain, { 
									apiToken, 
									accountId,
									zoneId: bucketZoneId,
									enabled: true
								});
								
								if (domainResult?.success) {
									console.log('[createSite] ✓ Custom storage domain added:', storageDomain);
									r2StorageDomain = storageDomain;
								} else {
									console.warn('[createSite] Failed to add custom storage domain:', domainResult?.errors);
									// Non-fatal: bucket works, just without custom domain
								}
							} catch (domainError) {
								console.error('[createSite] Error adding custom storage domain:', domainError);
								// Non-fatal: bucket works, just without custom domain
							}
						} else {
							console.warn('[createSite] KURATCHI_BUCKET_ORIGIN_HOST or KURATCHI_BUCKET_ZONE_ID not configured, skipping custom storage domain');
						}
					} else {
						console.warn('[createSite] Missing credentials for R2 binding:', {
							hasApiToken: !!apiToken,
							hasAccountId: !!accountId,
							hasGatewayKey: !!gatewayKey
						});
					}
				} catch (bindError) {
					console.error('[createSite] Error binding R2 bucket to worker:', bindError);
					// Non-fatal: worker exists, just without R2 for now
				}
			}

			// Step 2: Store database info in admin databases table
			const adminDb = await getAdminDatabase(locals);
			const newDB = await adminDb.databases.insert({
				id: dbId,
				name: created.databaseName,
				dbuuid: created.databaseId || created.databaseName,
				workerName: created.workerName,
				r2BucketName: r2Created ? r2BucketName : null,
				r2Binding: r2Created ? r2Binding : null,
				r2StorageDomain: r2StorageDomain, // Custom storage domain (e.g., subdomain.kuratchi.cloud)
				organizationId: activeOrgId,
				siteId: siteId,
				isArchived: false,
				isActive: true,
				schemaVersion: 1,
				needsSchemaUpdate: false,
				created_at: now,
				updated_at: now,
				deleted_at: null
			});

			if (!newDB.success) {
				console.error('Failed to insert database:', newDB.error);
				error(500, `Failed to create database: ${newDB.error}`);
			}

			// Step 3: Store the database token
			const dbApiToken = await adminDb.dbApiTokens.insert({
				id: crypto.randomUUID(),
				token: created.token,
				name: `${subdomain}-token`,
				databaseId: dbId,
				created_at: now,
				updated_at: now,
				revoked: false,
				expires: null,
				deleted_at: null
			});

			if (!dbApiToken.success) {
				console.error('Failed to insert database token:', dbApiToken.error);
				error(500, `Failed to create database token: ${dbApiToken.error}`);
			}

			// Step 4: Store site info in organization database
			const siteResult = await db.sites.insert({
				id: siteId,
				name: data.name,
				subdomain,
				description: data.description || null,
				status: true,
				domain: `${subdomain}.kuratchi.site`,
				environment: 'preview',
				theme: themeId,
				databaseId: dbId,
				dbuuid: created.databaseId || created.databaseName,
				workerName: created.workerName,
				r2BucketName: r2Created ? r2BucketName : null,
				r2Binding: r2Created ? r2Binding : null,
				r2StorageDomain: r2StorageDomain, // Custom domain for storage (e.g., subdomain.kuratchi.cloud)
				metadata: { themeId },
				created_at: now,
				updated_at: now,
				deleted_at: null
			});

			if (!siteResult.success) {
				console.error('Failed to insert site:', siteResult.error);
				error(500, `Failed to create site: ${siteResult.error}`);
			}

			// Step 5: Link user to site
			const userSiteResult = await db.userSites.insert({
				userId,
				siteId,
				created_at: now,
				updated_at: now,
				deleted_at: null
			});

			if (!userSiteResult.success) {
				console.error('Failed to link user to site:', userSiteResult.error);
				// Non-fatal, continue
			}

			// Step 6: Store theme header/footer in site metadata
			const themeTemplate = getThemeTemplate(themeId);
			const siteMetadata = {
				themeId,
				header: themeTemplate.siteHeader,
				footer: themeTemplate.siteFooter,
				...themeTemplate.siteMetadata
			};

			// Update site with metadata
			await db.sites
				.where({ id: siteId })
				.update({ metadata: siteMetadata });

			// Step 7: Seed default homepage for selected theme
			try {
				const { siteDb } = await getSiteDatabase(locals, siteId);
				const themeHomepage = getThemeHomepage(themeId);
				const homepageData = {
					content: themeHomepage.content.map((block, index) => {
						const clone = typeof structuredClone === 'function' ? structuredClone(block) : JSON.parse(JSON.stringify(block));
						if (!clone.id) {
							clone.id = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `block-${index}-${Date.now()}`);
						}
						return clone as Record<string, unknown>;
					})
				};
				const homepageId = crypto.randomUUID();
				await siteDb.pages.insert({
					id: homepageId,
					title: themeHomepage.title || data.name || 'Homepage',
					seoTitle: themeHomepage.seoTitle || themeHomepage.title || data.name || 'Homepage',
					seoDescription: themeHomepage.seoDescription || '',
					slug: themeHomepage.slug || 'homepage',
					pageType: 'homepage',
					isSpecialPage: true,
					status: true,
					data: homepageData,
					created_at: now,
					updated_at: now,
					deleted_at: null
				});
			} catch (homepageError) {
				console.error('[createSite] Failed to seed default homepage:', homepageError);
			}

			// Step 8: Store subdomain mapping in KV for fast site resolution
			try {
				const kv = (locals.kuratchi as any)?.kv?.default;
				if (kv) {
					await kv.put(`site:subdomain:${subdomain}`, JSON.stringify({
						siteId,
						orgId: activeOrgId,
						databaseId: dbId,
						dbuuid: created.databaseId || created.databaseName,
						workerName: created.workerName
					}));
					console.log('[createSite] Subdomain mapping stored in KV:', subdomain);
				} else {
					console.warn('[createSite] KV not available, skipping subdomain mapping');
				}
			} catch (err) {
				console.error('[createSite] Failed to store KV mapping:', err);
				// Non-fatal, continue
			}

			// Refresh sites list
			await getSites().refresh();

			return {
				success: true,
				message: 'Site created successfully',
				data: siteResult.data
			};
		} catch (err) {
			console.error('Error creating site:', err);
			error(500, 'Failed to create site');
		}
	}
);

// Update site schema
const updateSiteSchema = v.object({
	id: v.string(),
	name: v.optional(v.string()),
	subdomain: v.optional(v.pipe(
		v.string(),
		v.regex(/^[a-z0-9-]+$/, 'Subdomain must contain only lowercase letters, numbers, and hyphens')
	)),
	description: v.optional(v.string()),
	theme: v.optional(v.string())
});

// Update an existing site
export const updateSite = guardedForm(
	'sites.update',      // Required permission
	updateSiteSchema,    // Validation schema
	'sites.updated',     // Activity type to log
	async (data) => {
		const { locals } = getRequestEvent();
		const session = locals.session;
		const activeOrgId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;

		if (!activeOrgId) {
			error(400, 'Organization ID is required');
		}

		try {
			// TODO: Implement actual database update when sites table is created
			console.log('[updateSite] Updating site:', data);

			// Simulate API delay
			await new Promise(resolve => setTimeout(resolve, 1000));

			return {
				success: true,
				message: 'Site updated successfully',
				data
			};
		} catch (err) {
			console.error('Error updating site:', err);
			error(500, 'Failed to update site');
		}
	}
);

// Update site theme schema
const updateSiteThemeSchema = v.object({
    siteId: v.string(),
    themeId: v.string()
});

// Update site theme as a command (programmatic invocation)
export const updateSiteTheme = command(updateSiteThemeSchema, async ({ siteId, themeId }): Promise<{ success: boolean; message: string }> => {
    const { locals } = getRequestEvent();

    const db = await getDatabase(locals);

    const siteResult = await db.sites
        .where({ id: siteId, deleted_at: { isNullish: true } })
        .one();

    if (!siteResult.success || !siteResult.data) {
        error(404, 'Site not found');
    }

    const currentMetadata = (siteResult.data as any).metadata || {};
    const updatedMetadata = { ...currentMetadata, themeId };

    const updateResult = await db.sites
        .where({ id: siteId })
        .update({
            metadata: updatedMetadata,
            updated_at: new Date().toISOString()
        });

    if (!updateResult.success) {
        error(500, `Failed to update theme: ${updateResult.error}`);
    }

    await getSites().refresh();

    return { success: true, message: 'Theme updated successfully' };
});

// Delete site schema
const deleteSiteSchema = v.object({
	id: v.string()
});

// Delete a site
export const deleteSite = guardedForm(
	'sites.delete',      // Required permission
	deleteSiteSchema,    // Validation schema
	'sites.deleted',     // Activity type to log
	async (data) => {
		const { locals } = getRequestEvent();
		const session = locals.session;
		const activeOrgId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;

		if (!activeOrgId) {
			error(400, 'Organization ID is required');
		}

		try {
			console.log('[deleteSite] Deleting site:', data.id);

			// Step 1: Get site details from org DB
			const db = await getDatabase(locals);
			const siteResult = await db.sites.where({ id: data.id }).first();

			if (!siteResult.success || !siteResult.data) {
				error(404, 'Site not found');
			}

			const site = siteResult.data;
			const databaseId = site.databaseId;

			// Step 2: Delete site from org DB
			const deleteResult = await db.sites.delete({ id: data.id });
			if (!deleteResult.success) {
				console.error('[deleteSite] Failed to delete site from org DB:', deleteResult.error);
				error(500, 'Failed to delete site');
			}

			// Step 3: Delete database and worker from Cloudflare using SDK
			if (site.dbuuid || site.workerName) {
				try {
					const apiToken = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN || env.KURATCHI_CF_API_TOKEN;
					const accountId = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || env.KURATCHI_CF_ACCOUNT_ID;
					
					if (apiToken && accountId) {
						const deleteResult = await database.delete({ 
							databaseId: site.dbuuid,
							workerName: site.workerName,
							apiToken,
							accountId
						});
						
						if (deleteResult.success) {
							console.log('[deleteSite] ✓ Deleted database and worker from Cloudflare');
						} else {
							console.warn('[deleteSite] Database deletion returned error:', deleteResult.error);
						}
					} else {
						console.warn('[deleteSite] Missing Cloudflare credentials, skipping database deletion');
					}
				} catch (deleteDbError) {
					console.error('[deleteSite] Failed to delete database from Cloudflare:', deleteDbError);
					// Continue anyway - site is already deleted from org DB
				}
			}
			
			// Step 3.5: Delete R2 bucket from Cloudflare
			if (site.r2BucketName) {
				try {
					const apiToken = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN || env.KURATCHI_CF_API_TOKEN;
					const accountId = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || env.KURATCHI_CF_ACCOUNT_ID;
					
					if (apiToken && accountId) {
						// Remove custom domain first if it exists
						if (site.r2StorageDomain) {
							try {
								await r2.removeCustomDomain(site.r2BucketName, site.r2StorageDomain, { apiToken, accountId });
								console.log('[deleteSite] ✓ Removed custom storage domain:', site.r2StorageDomain);
							} catch (domainErr) {
								console.warn('[deleteSite] Failed to remove custom domain:', domainErr);
							}
						}
						
						const deleteR2Result = await r2.deleteBucket(site.r2BucketName, { apiToken, accountId });
						
						if (deleteR2Result.success) {
							console.log('[deleteSite] ✓ Deleted R2 bucket:', site.r2BucketName);
						} else {
							console.warn('[deleteSite] R2 bucket deletion returned error:', deleteR2Result.error);
						}
					} else {
						console.warn('[deleteSite] Missing Cloudflare credentials, skipping R2 bucket deletion');
					}
				} catch (deleteR2Error) {
					console.error('[deleteSite] Failed to delete R2 bucket:', deleteR2Error);
					// Continue anyway
				}
			}

			// Step 4: Delete from admin DB (databases and tokens tables)
			if (databaseId) {
				try {
					const adminDb = await getAdminDatabase(locals);
					
					// Delete database record
					await adminDb.databases.delete({ databaseId });
					
					// Delete token records
					await adminDb.dbApiTokens.delete({ databaseId });
					
					console.log('[deleteSite] Cleaned up admin DB records');
				} catch (adminErr) {
					console.error('[deleteSite] Error cleaning up admin DB:', adminErr);
					// Continue anyway
				}
			}

			// Step 5: Delete KV mapping
			if (site.subdomain) {
				try {
					const kv = (locals.kuratchi as any)?.kv?.default;
					if (kv) {
						await kv.delete(`site:subdomain:${site.subdomain}`);
						console.log('[deleteSite] Deleted KV mapping');
					}
				} catch (kvErr) {
					console.error('[deleteSite] Error deleting KV mapping:', kvErr);
					// Continue anyway
				}
			}

			console.log('[deleteSite] Successfully deleted site:', data.id);
			
			// Refresh sites list
			await getSites().refresh();

			return {
				success: true,
				message: 'Site deleted successfully'
			};
		} catch (err) {
			console.error('Error deleting site:', err);
			error(500, 'Failed to delete site');
		}
	}
);
