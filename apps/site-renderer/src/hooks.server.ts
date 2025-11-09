import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

interface ResolveResponse {
	site: Record<string, unknown> | null;
	siteDatabase: Record<string, unknown> | null;
}

export const handle: Handle = async ({ event, resolve }) => {
	const hostname = event.url.hostname;
	const subdomain = hostname.split('.')[0];
	console.log('[site-renderer] Incoming request:', { hostname, subdomain });

	if (!subdomain) {
		throw redirect(307, 'https://kuratchi.com');
	}

	const dashboardUrl = env.DASHBOARD_API_URL || 'http://localhost:5173';
	const apiToken = env.SITE_RENDERER_API_TOKEN;

	if (!apiToken) {
		throw redirect(307, 'https://kuratchi.com');
	}

	try {
		const response = await fetch(`${dashboardUrl}/api/sites/resolve`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiToken}`
			},
			body: JSON.stringify({ subdomain })
		});

		if (!response.ok) {
			console.error('[site-renderer] Failed to resolve site:', response.status);
			throw redirect(307, 'https://kuratchi.com');
		}

		const data = (await response.json()) as ResolveResponse;
		console.log('[site-renderer] Site resolved:', true);

		if (!data.site) {
			console.warn('[site-renderer] No site found for subdomain:', subdomain);
			throw redirect(307, 'https://kuratchi.com');
		}

		const siteId = typeof data.site.id === 'string' ? data.site.id : null;
		if (!siteId) {
			console.error('[site-renderer] Resolved site missing id');
			throw redirect(307, 'https://kuratchi.com');
		}

		// Populate locals for downstream page loads
		event.locals.site = {
			id: siteId,
			name: typeof data.site.name === 'string' ? data.site.name : null,
			subdomain: typeof data.site.subdomain === 'string' ? data.site.subdomain : subdomain,
			description: typeof data.site.description === 'string' ? data.site.description : null,
			domain: typeof data.site.domain === 'string' ? data.site.domain : null,
			environment: typeof data.site.environment === 'string' ? data.site.environment : null,
			theme: typeof data.site.theme === 'string' ? data.site.theme : null,
			metadata:
				typeof data.site.metadata === 'object' && data.site.metadata !== null
					? (data.site.metadata as Record<string, unknown>)
					: null
		};

		const databaseInfo = data.siteDatabase && typeof data.siteDatabase === 'object'
			? (data.siteDatabase as Record<string, unknown>)
			: null;

		const token = databaseInfo && typeof databaseInfo.token === 'string' ? databaseInfo.token : null;
		if (!token) {
			console.error('[site-renderer] Resolved site missing database token');
			throw redirect(307, 'https://kuratchi.com');
		}

		event.locals.siteDatabase = {
			token,
			dbuuid: typeof databaseInfo?.dbuuid === 'string' ? databaseInfo.dbuuid : null,
			workerName: typeof databaseInfo?.workerName === 'string' ? databaseInfo.workerName : null
		};
	} catch (error) {
		console.error('[site-renderer] Error in hooks:', error);
		throw redirect(307, 'https://kuratchi.com');
	}

	return resolve(event);
};
