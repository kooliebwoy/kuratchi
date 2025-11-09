import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const load = async ({ locals, params }: RequestEvent) => {
	const { site } = locals as {
		site: Record<string, unknown> | null;
	};

	if (!site) {
		return {
			site: null,
			page: null
		};
	}

	const subdomain = typeof site.subdomain === 'string' ? site.subdomain : null;
	if (!subdomain) {
		return {
			site,
			page: null
		};
	}

	// Get the slug from params and normalize (strip slashes, lowercase)
    const raw = params.slug || '';
    const slug = raw.replace(/^\/+|\/+$/g, '').toLowerCase();

	try {
		// Call dashboard API to fetch page by slug
		const dashboardUrl = env.DASHBOARD_API_URL || 'http://localhost:5173';
		const apiToken = env.SITE_RENDERER_API_TOKEN;

		if (!apiToken) {
			console.error('[site-renderer] SITE_RENDERER_API_TOKEN not configured');
			return { site, page: null };
		}

		const response = await fetch(`${dashboardUrl}/api/sites/pages`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiToken}`
			},
			body: JSON.stringify({
				subdomain,
				slug,
				pageType: undefined // Let the API find by slug
			})
		});

		if (!response.ok) {
			console.error('[site-renderer] API error fetching page:', response.status);
			return { site, page: null };
		}

		const data = await response.json();
		return {
			site,
			page: data.page
		};
	} catch (err) {
		console.error('[site-renderer] Error loading page:', err);
		return { site, page: null };
	}
};
