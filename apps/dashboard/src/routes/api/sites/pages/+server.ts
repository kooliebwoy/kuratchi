import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { database } from 'kuratchi-sdk';
import { sitesSchema } from '$lib/schemas/sites';
import { getThemeHomepage } from '@kuratchi/editor';

/**
 * Public API endpoint for site-renderer to fetch page data
 * Requires a valid API token for authentication
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Validate API token
		const authHeader = request.headers.get('authorization');
		const token = authHeader?.replace('Bearer ', '');
		
		if (!token || token !== env.SITE_RENDERER_API_TOKEN) {
			error(401, 'Unauthorized');
		}

		const body = await request.json();
		const { dbuuid, workerName, dbToken, slug, pageType } = body;

		if (!workerName || !dbToken) {
			error(400, 'Database credentials are required');
		}

		console.log('[api/sites/pages] Fetching page:', { slug, pageType, workerName, dbuuid });

		const gatewayKey = env.KURATCHI_GATEWAY_KEY;
		if (!gatewayKey) {
			error(500, 'KURATCHI_GATEWAY_KEY not configured');
		}

		const orm = await database.client({
			databaseName: workerName,
			dbToken,
			schema: sitesSchema,
			gatewayKey,
			scriptName: workerName,
			skipMigrations: true
		});

		let query = orm.pages.where({
			status: true,
			deleted_at: { isNullish: true }
		});

		if (slug) {
			query = query.where({ slug });
		} else if (pageType) {
			query = query.where({ pageType });
		}

		const pageResult = await query.first();

		if (!pageResult.success || !pageResult.data) {
			// No page found - return theme default homepage template
			// Extract themeId from site metadata if available
			const sitesQuery = orm.sites?.where({ 
				workerName,
				deleted_at: { isNullish: true }
			});
			
			let themeId = null;
			if (sitesQuery) {
				const siteResult = await sitesQuery.first();
				if (siteResult.success && siteResult.data) {
					const metadata = (siteResult.data as any).metadata;
					themeId = metadata?.themeId || null;
				}
			}
			
			const themeTemplate = getThemeHomepage(themeId);
			return json({ 
				page: {
					...themeTemplate,
					pageType: 'homepage',
					isSpecialPage: true,
					status: true,
					data: {
						content: themeTemplate.content,
						header: themeTemplate.header,
						footer: themeTemplate.footer,
						metadata: themeTemplate.metadata
					}
				}
			});
		}

		return json({ page: pageResult.data });
	} catch (err) {
		console.error('[api/sites/pages] Error:', err);
		error(500, 'Internal server error');
	}
};
