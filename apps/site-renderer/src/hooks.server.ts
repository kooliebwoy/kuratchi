import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

interface FormField {
	id: string;
	type: string;
	label: string;
	name: string;
	placeholder?: string;
	required?: boolean;
}

interface SiteForm {
	id: string;
	name: string;
	fields: FormField[];
	settings: {
		formName?: string;
		submitButtonText?: string;
		successMessage?: string;
	};
}

interface ResolveResponse {
	site: Record<string, unknown> | null;
	orgId?: string;
	siteDatabase: Record<string, unknown> | null;
	forms?: SiteForm[];
}

export const handle: Handle = async ({ event, resolve }) => {
	const hostname = event.url.hostname;
	const subdomain = hostname.split('.')[0];
	const pathname = event.url.pathname;
	
	console.log('[site-renderer] Incoming request:', { hostname, subdomain, pathname });

	// Skip site resolution entirely for Cloudflare validation endpoints
	if (pathname.startsWith('/.well-known/')) {
		console.log('[site-renderer] Skipping site resolution for:', pathname);
		return resolve(event);
	}

	// For API routes, we still need site context but won't redirect on failure
	const isApiRoute = pathname.startsWith('/api/');

	if (!subdomain) {
		if (isApiRoute) {
			// Let the API handler deal with missing site
			return resolve(event);
		}
		throw redirect(307, 'https://kuratchi.com');
	}

	const dashboardUrl = env.DASHBOARD_API_URL || 'http://localhost:5173';
	const apiToken = env.SITE_RENDERER_API_TOKEN;

	if (!apiToken) {
		if (isApiRoute) {
			return resolve(event);
		}
		throw redirect(307, 'https://kuratchi.com');
	}

	try {
		const response = await fetch(`${dashboardUrl}/api/sites/resolve`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiToken}`
			},
			body: JSON.stringify({ subdomain, hostname })
		});

		if (!response.ok) {
			console.error('[site-renderer] Failed to resolve site:', response.status);
			if (isApiRoute) {
				return resolve(event);
			}
			throw redirect(307, 'https://kuratchi.com');
		}

		const data = (await response.json()) as ResolveResponse;
		console.log('[site-renderer] Site resolved:', true);

		if (!data.site) {
			console.warn('[site-renderer] No site found for subdomain:', subdomain);
			if (isApiRoute) {
				return resolve(event);
			}
			throw redirect(307, 'https://kuratchi.com');
		}

		const siteId = typeof data.site.id === 'string' ? data.site.id : null;
		if (!siteId) {
			console.error('[site-renderer] Resolved site missing id');
			if (isApiRoute) {
				return resolve(event);
			}
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
			// For API routes, continue without database token - let handler deal with it
			if (!isApiRoute) {
				throw redirect(307, 'https://kuratchi.com');
			}
		} else {
			event.locals.siteDatabase = {
				token,
				dbuuid: typeof databaseInfo?.dbuuid === 'string' ? databaseInfo.dbuuid : null,
				workerName: typeof databaseInfo?.workerName === 'string' ? databaseInfo.workerName : null
			};
		}

		// Store forms and orgId in locals for sections and API to access
		event.locals.forms = Array.isArray(data.forms) ? data.forms : [];
		event.locals.orgId = typeof data.orgId === 'string' ? data.orgId : undefined;
	} catch (error) {
		// Re-throw redirects
		if (error && typeof error === 'object' && 'status' in error) {
			throw error;
		}
		console.error('[site-renderer] Error in hooks:', error);
		if (isApiRoute) {
			return resolve(event);
		}
		throw redirect(307, 'https://kuratchi.com');
	}

	return resolve(event);
};
