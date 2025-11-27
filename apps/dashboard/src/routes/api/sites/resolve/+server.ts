import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

/**
 * Public API endpoint for site-renderer to resolve sites by subdomain
 * Requires a valid API token for authentication
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
		const { subdomain, hostname } = body;

		if (!subdomain && !hostname) {
			error(400, 'Subdomain or hostname is required');
		}

		console.log('[api/sites/resolve] Resolving:', { subdomain, hostname });

		// Step 1: Check KV for fast lookup (subdomain or custom domain)
        console.log('locals.kuratchi', locals.kuratchi);
		const kv = locals.kuratchi?.kv?.default;
		if (!kv) {
			console.error('[api/sites/resolve] KV not available');
			error(500, 'KV storage not available');
		}

		let kvKey: string;
		let kvData: string | null = null;

		// Try custom domain first if hostname provided
		if (hostname && hostname !== `${subdomain}.kuratchi.com`) {
			kvKey = `site:domain:${hostname}`;
			kvData = await kv.get(kvKey, 'text');
			console.log('[api/sites/resolve] Custom domain lookup:', { hostname, found: !!kvData });
		}

		// Fall back to subdomain lookup
		if (!kvData && subdomain) {
			kvKey = `site:subdomain:${subdomain}`;
			kvData = await kv.get(kvKey, 'text');
			console.log('[api/sites/resolve] Subdomain lookup:', { subdomain, found: !!kvData });
		}
		
		if (!kvData) {
			console.log('[api/sites/resolve] Site not found in KV');
			return json({ site: null, siteDatabase: null });
		}

		const siteMapping = JSON.parse(kvData);
		console.log('[api/sites/resolve] Found site mapping in KV:', siteMapping);

		// Step 2: Fetch full site data from the organization database
		const orgDb = await locals.kuratchi?.orgDatabaseClient?.(siteMapping.orgId);
		if (!orgDb) {
			console.error('[api/sites/resolve] Org database not available:', siteMapping.orgId);
			return json({ site: null, siteDatabase: null });
		}

		const siteResult = await orgDb.sites
			.where({ 
				id: siteMapping.siteId,
				deleted_at: { isNullish: true },
				status: true
			})
			.one();

		if (!siteResult.success || !siteResult.data) {
			console.log('[api/sites/resolve] Site not found in org DB:', siteMapping.siteId);
			return json({ site: null, siteDatabase: null });
		}

		const site = siteResult.data;

		// Step 3: Get the site's database token from admin DB
		const adminOrm = await locals.kuratchi?.getAdminDb?.();
		if (!adminOrm) error(500, 'Admin database not available');

		const siteDbTokenResult = await adminOrm.dbApiTokens
			.where({ 
				databaseId: siteMapping.databaseId,
				revoked: false,
				deleted_at: { isNullish: true }
			})
			.one();

		// Step 4: Get forms attached to this site
		let forms: any[] = [];
		try {
			const attachments = await orgDb.formSites
				.where({ siteId: site.id, status: true, deleted_at: { isNullish: true } })
				.many();
			
			if (attachments.success && attachments.data?.length) {
				const formIds = attachments.data.map((a: any) => a.formId);
				const formsResult = await orgDb.forms
					.where({ deleted_at: { isNullish: true } })
					.many();
				
				if (formsResult.success && formsResult.data) {
					forms = formsResult.data
						.filter((f: any) => formIds.includes(f.id))
						.map((f: any) => ({
							id: f.id,
							name: f.name,
							fields: typeof f.fields === 'string' ? JSON.parse(f.fields) : f.fields || [],
							settings: typeof f.settings === 'string' ? JSON.parse(f.settings) : f.settings || {}
						}));
				}
			}
		} catch (err) {
			console.error('[api/sites/resolve] Error loading forms:', err);
			// Continue without forms
		}

		console.log('[api/sites/resolve] Site resolved:', {
			id: site.id,
			name: site.name,
			subdomain: site.subdomain,
			formsCount: forms.length
		});

		return json({
			site: {
				id: site.id,
				name: site.name,
				subdomain: site.subdomain,
				description: site.description,
				status: site.status,
				domain: site.domain,
				environment: site.environment,
				theme: site.theme,
				metadata: site.metadata
			},
			orgId: siteMapping.orgId,
			siteDatabase: siteDbTokenResult.success && siteDbTokenResult.data ? {
				dbuuid: siteMapping.dbuuid,
				workerName: siteMapping.workerName,
				token: siteDbTokenResult.data.token
			} : null,
			forms
		});
	} catch (err) {
		console.error('[api/sites/resolve] Error:', err);
		error(500, 'Internal server error');
	}
};
