import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getThemeHomepage } from '@kuratchi/editor';
import * as v from 'valibot';
import { database } from 'kuratchi-sdk';
import { sitesSchema } from '$lib/schemas/sites';

const RequestSchema = v.object({
	subdomain: v.string(),
	slug: v.optional(v.string()),
	pageType: v.optional(v.string())
});

/**
 * Public API endpoint for site-renderer to fetch page data
 * Mirrors /api/sites/resolve but adds page query
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Validate API token
		const authHeader = request.headers.get('authorization');
		const token = authHeader?.replace('Bearer ', '');
		
		if (!token || token !== env.SITE_RENDERER_API_TOKEN) {
			error(401, 'Unauthorized');
		}

		const body = await request.json();
		const parsed = v.safeParse(RequestSchema, body);
		if (!parsed.success) {
			console.error('[api/sites/pages] Validation failed:', parsed.issues);
			error(400, 'Invalid request payload');
		}

		const { subdomain, slug, pageType } = parsed.output;
		console.log('[api/sites/pages] Fetching page:', { slug, pageType, subdomain });

		// Step 1: Get site mapping from KV (same as /api/sites/resolve)
		const kv = locals.kuratchi?.kv?.default;
		if (!kv) {
			console.error('[api/sites/pages] KV not available');
			error(500, 'KV storage not available');
		}

		const kvKey = `site:subdomain:${subdomain}`;
		const kvData = await kv.get(kvKey, 'text');

		if (!kvData) {
			console.error('[api/sites/pages] Site not found in KV:', subdomain);
			error(404, 'Site not found');
		}

		const siteMapping = JSON.parse(kvData);
		console.log('[api/sites/pages] Found site mapping:', siteMapping);

		// Step 2: Get org database and fetch site + catalog data
		const orgDb = await locals.kuratchi?.orgDatabaseClient?.(siteMapping.orgId);
		if (!orgDb) {
			console.error('[api/sites/pages] Org database not available:', siteMapping.orgId);
			error(500, 'Organization database not available');
		}

		const siteResult = await orgDb.sites
			.where({ id: siteMapping.siteId, deleted_at: { isNullish: true } })
			.one();

		if (!siteResult.success || !siteResult.data) {
			console.error('[api/sites/pages] Site not found in org DB:', siteMapping.siteId);
			error(404, 'Site not found');
		}

		const site = siteResult.data;

		// Fetch catalog data from org database (OEMs and published vehicles)
		let catalogOems: any[] = [];
		let catalogVehicles: any[] = [];

		try {
			console.log('[api/sites/pages] Fetching catalog data...');
			
			// Fetch OEMs
			const oemsResult = await orgDb.catalogOems
				.where({ deleted_at: { isNullish: true } })
				.all();
			console.log('[api/sites/pages] OEMs result:', oemsResult);
			
			if (oemsResult.success && oemsResult.data) {
				catalogOems = oemsResult.data;
			}

			// Fetch published vehicles
			const vehiclesResult = await orgDb.catalogVehicles
				.where({ status: 'published', deleted_at: { isNullish: true } })
				.all();
			console.log('[api/sites/pages] Vehicles result:', vehiclesResult);
			
			if (vehiclesResult.success && vehiclesResult.data) {
				// Join with OEM names
				catalogVehicles = vehiclesResult.data.map((vehicle: any) => {
					const oem = catalogOems.find(o => o.id === vehicle.oem_id);
					return {
						...vehicle,
						oem_name: oem?.name || vehicle.oem_name || 'Unknown'
					};
				});
			}
			
			console.log('[api/sites/pages] Catalog data:', { 
				oemsCount: catalogOems.length, 
				vehiclesCount: catalogVehicles.length 
			});
		} catch (catalogErr) {
			console.error('[api/sites/pages] Error fetching catalog data:', catalogErr);
			// Continue without catalog data - tables may not be migrated yet
		}

		// Step 3: Get site database token from admin DB using site's databaseId
		const adminOrm = await locals.kuratchi?.getAdminDb?.();
		if (!adminOrm) {
			console.error('[api/sites/pages] Admin database not available');
			error(500, 'Admin database not available');
		}

		const siteDatabaseId = site.databaseId || siteMapping.databaseId;
		if (!siteDatabaseId) {
			console.error('[api/sites/pages] Site missing databaseId');
			error(500, 'Site database reference missing');
		}

		const tokenResult = await adminOrm.dbApiTokens
			.where({
				databaseId: siteDatabaseId,
				revoked: false,
				deleted_at: { isNullish: true }
			})
			.one();

		if (!tokenResult.success || !tokenResult.data) {
			console.error('[api/sites/pages] Database token not found for databaseId:', siteDatabaseId);
			error(500, 'Database token not found');
		}

		// Step 4: Get database record to ensure we have correct name
		const dbRecordResult = await adminOrm.databases
			.where({ id: siteDatabaseId, deleted_at: { isNullish: true } })
			.one();

		if (!dbRecordResult.success || !dbRecordResult.data) {
			console.error('[api/sites/pages] Database record not found');
			error(500, 'Database record not found');
		}

		const dbRecord = dbRecordResult.data;
		const databaseName = dbRecord.name || dbRecord.dbuuid || dbRecord.workerName;
		
		if (!databaseName) {
			console.error('[api/sites/pages] Database name missing');
			error(500, 'Database name missing');
		}

		// Step 5: Connect to site database
		const gatewayKey = env.KURATCHI_GATEWAY_KEY;
		if (!gatewayKey) {
			error(500, 'KURATCHI_GATEWAY_KEY not configured');
		}

		console.log('[api/sites/pages] Connecting to database:', { databaseName, databaseId: siteDatabaseId });

		const orm = await database.client({
			databaseName,
			dbToken: tokenResult.data.token,
			schema: sitesSchema,
			gatewayKey,
			scriptName: dbRecord.workerName,
			skipMigrations: true
		});

		// Build base query. If slug is specified, don't require status=true to allow drafts of the homepage.
        let query = orm.pages.where({ deleted_at: { isNullish: true } });

        if (slug) {
            query = query.where({ slug });
        } else {
            query = query.where({ status: true });
            if (pageType) {
                query = query.where({ pageType });
            }
        }

		const pageResult = await query.first();
		console.log('[api/sites/pages] Query result:', pageResult);

        if (!pageResult.success || !pageResult.data) {
            // Persist a homepage from theme if missing so future reads succeed
            const metadata = site.metadata && typeof site.metadata === 'object'
                ? (site.metadata as Record<string, unknown>)
                : {};
            const themeId = typeof metadata.themeId === 'string' ? metadata.themeId : null;
            const themeTemplate = getThemeHomepage(themeId);

            const now = new Date().toISOString();
            const insertPayload = {
                id: crypto.randomUUID(),
                title: themeTemplate.title || 'Homepage',
                seoTitle: themeTemplate.seoTitle || themeTemplate.title || 'Homepage',
                seoDescription: themeTemplate.seoDescription || '',
                slug: 'homepage',
                pageType: 'homepage',
                isSpecialPage: true,
                status: true,
                data: {
                    content: themeTemplate.content,
                    header: themeTemplate.header,
                    footer: themeTemplate.footer,
                    metadata: themeTemplate.metadata
                },
                created_at: now,
                updated_at: now,
                deleted_at: null
            };

            // If a homepage exists, return it as-is (do NOT overwrite user content)
            const existingHome = await orm.pages
                .where({ slug: 'homepage', deleted_at: { isNullish: true } })
                .first();
            if (existingHome.success && existingHome.data) {
                return json({ page: existingHome.data, catalogOems, catalogVehicles });
            }

            const inserted = await orm.pages.insert(insertPayload as any);
            if (inserted.success && inserted.data) {
                return json({ page: inserted.data, catalogOems, catalogVehicles });
            }

            // As a last resort, still return the theme template (non-persisted)
            return json({
                page: {
                    ...themeTemplate,
                    pageType: 'homepage',
                    isSpecialPage: true,
                    status: true,
                    data: insertPayload.data
                },
                catalogOems,
                catalogVehicles
            });
        }

		return json({ page: pageResult.data, catalogOems, catalogVehicles });
	} catch (err) {
		console.error('[api/sites/pages] Error:', err);
		error(500, 'Internal server error');
	}
};
