import { getRequestEvent, query, form, command } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { database } from 'kuratchi-sdk';
import { getDatabase, getAdminDatabase, getSiteDatabase } from '$lib/server/db-context';
import { sitesSchema } from '$lib/schemas/sites';
import { getThemeHomepage, getThemeTemplate, DEFAULT_THEME_ID } from '@kuratchi/editor';

// Guarded query helper
const guardedQuery = <R>(fn: () => Promise<R>) => {
	return query(async () => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');

		return fn();
	});
};

// Guarded form helper - using unchecked validation
const guardedForm = <R>(
	schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
	fn: (data: any) => Promise<R>
) => {
	return form('unchecked', async (data: any) => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');

		// Validate with valibot
		const result = v.safeParse(schema, data);
		if (!result.success) {
			error(400, 'Validation failed');
		}

		return fn(result.output);
	});
};

// Log route activity
export const logRouteActivity = guardedQuery(async () => {
	// TODO: Implement activity logging
	console.log('Sites route accessed');
});

// Get all sites for the organization
export const getSites = guardedQuery(async () => {
	const { locals } = getRequestEvent();

	console.log('[getSites] locals:', locals.kuratchi);

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
export const getSiteById = guardedQuery(async () => {
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

		console.log('[getSiteById] siteId:', siteId, 'activeOrgId:', activeOrgId);
		
		return result.data;
	} catch (err) {
		console.error('Error fetching site:', err);
		error(404, 'Site not found');
	}
});

// Create site schema
const createSiteSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Site name is required')),
	subdomain: v.pipe(
		v.string(),
		v.minLength(1, 'Subdomain is required'),
		v.regex(/^[a-z0-9-]+$/, 'Subdomain must contain only lowercase letters, numbers, and hyphens')
	),
	description: v.optional(v.string(), ''),
	theme: v.optional(v.string(), 'minimal')
});

// Create a new site
export const createSite = guardedForm(
	createSiteSchema,
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
			const themeId = data.theme || DEFAULT_THEME_ID;

			console.log('[createSite] Creating site:', {
				siteId,
				name: data.name,
				subdomain: data.subdomain,
			});

			// Step 1: Create the site database with sites schema
			// Use siteId prefix (first 8 chars) + subdomain to keep under 63 char limit
			const shortId = siteId.substring(0, 8);
			const dbName = `site-${shortId}-${data.subdomain}`;
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

			// Step 2: Store database info in admin databases table
			const adminDb = await getAdminDatabase(locals);
			const newDB = await adminDb.databases.insert({
				id: dbId,
				name: created.databaseName,
				dbuuid: created.databaseId || created.databaseName,
				workerName: created.workerName,
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
				name: `${data.subdomain}-token`,
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
			const db = await getDatabase(locals);
			const siteResult = await db.sites.insert({
				id: siteId,
				name: data.name,
				subdomain: data.subdomain,
				description: data.description || null,
				status: true,
				domain: `${data.subdomain}.kuratchi.com`,
				environment: 'preview',
				theme: themeId,
				databaseId: dbId,
				dbuuid: created.databaseId || created.databaseName,
				workerName: created.workerName,
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
					seoDescription: themeHomepage.seoDescription || data.description || '',
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
				const kv = locals.kuratchi?.kv?.default;
				if (kv) {
					await kv.put(`site:subdomain:${data.subdomain}`, JSON.stringify({
						siteId,
						orgId: activeOrgId,
						databaseId: dbId,
						dbuuid: created.databaseId || created.databaseName,
						workerName: created.workerName
					}));
					console.log('[createSite] Subdomain mapping stored in KV:', data.subdomain);
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
	updateSiteSchema,
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
	deleteSiteSchema,
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

			// Step 3: Delete database from Cloudflare using SDK
			if (databaseId) {
				try {
					const deleteDbResult = await database.delete({ databaseId });
					if (!deleteDbResult.success) {
						console.error('[deleteSite] Failed to delete database from Cloudflare:', deleteDbResult.error);
						// Continue anyway - site is already deleted from org DB
					} else {
						console.log('[deleteSite] Successfully deleted database from Cloudflare');
					}
				} catch (dbErr) {
					console.error('[deleteSite] Error deleting database:', dbErr);
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
					const kv = locals.kuratchi?.kv?.default;
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
