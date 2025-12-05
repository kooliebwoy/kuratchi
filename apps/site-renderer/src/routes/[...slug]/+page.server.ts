import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const load = async ({ locals, params }: RequestEvent) => {
	const { site } = locals as {
		site: Record<string, unknown> | null;
	};

	if (!site) {
		return {
			site: null,
			page: null,
			catalogOems: [],
			catalogVehicles: []
		};
	}

	const subdomain = typeof site.subdomain === 'string' ? site.subdomain : null;
	if (!subdomain) {
		return {
			site,
			page: null,
			catalogOems: [],
			catalogVehicles: []
		};
	}

	// Derive blog index slug from site metadata (if present)
	const siteMetadata =
		typeof (site as any).metadata === 'object' && (site as any).metadata !== null
			? ((site as any).metadata as Record<string, unknown>)
			: {};
	const blog =
		siteMetadata.blog && typeof (siteMetadata as any).blog === 'object'
			? ((siteMetadata as any).blog as Record<string, unknown>)
			: null;

	let indexSlug = 'blog';
	if (blog && typeof (blog as any).settings === 'object' && (blog as any).settings !== null) {
		const settings = (blog as any).settings as Record<string, unknown>;
		if (typeof settings.indexSlug === 'string' && settings.indexSlug.trim().length > 0) {
			indexSlug = settings.indexSlug.toLowerCase();
		}
	}

	// Get the slug from params and normalize (strip slashes, lowercase)
	const raw = params.slug || '';
	const fullSlug = raw.replace(/^\/+|\/+$/g, '').toLowerCase();

	let pageSlug = fullSlug;

	if (fullSlug) {
		const segments = fullSlug.split('/');
		if (segments.length > 0 && segments[0] === indexSlug) {
			// /{indexSlug} -> blog index page (slug = indexSlug)
			// /{indexSlug}/{postSlug} -> blog post page (slug = postSlug)
			pageSlug = segments.length === 1 ? indexSlug : segments[segments.length - 1];
		}
	}

	try {
		// Call dashboard API to fetch page by slug
		const dashboardUrl = env.DASHBOARD_API_URL || 'http://localhost:5173';
		const apiToken = env.SITE_RENDERER_API_TOKEN;

		if (!apiToken) {
			console.error('[site-renderer] SITE_RENDERER_API_TOKEN not configured');
			return { site, page: null, catalogOems: [], catalogVehicles: [] };
		}

		const response = await fetch(`${dashboardUrl}/api/sites/pages`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiToken}`
			},
			body: JSON.stringify({
				subdomain,
				slug: pageSlug,
				pageType: undefined // Let the API find by slug
			})
		});

		if (!response.ok) {
			console.error('[site-renderer] API error fetching page:', response.status);
			return { site, page: null, catalogOems: [], catalogVehicles: [] };
		}

		const data = await response.json();
		console.log('[site-renderer] Received catalog data:', {
			oemsCount: data.catalogOems?.length || 0,
			vehiclesCount: data.catalogVehicles?.length || 0
		});
		return {
			site,
			page: data.page,
			catalogOems: data.catalogOems || [],
			catalogVehicles: data.catalogVehicles || []
		};
	} catch (err) {
		console.error('[site-renderer] Error loading page:', err);
		return { site, page: null, catalogOems: [], catalogVehicles: [] };
	}
};
