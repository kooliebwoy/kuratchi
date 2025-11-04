import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Site Renderer Hooks
 * 
 * Resolves which site to render based on the incoming hostname.
 * Communicates with the dashboard API instead of directly accessing databases.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const hostname = event.request.headers.get('host') || '';
	
	// Extract subdomain from hostname
	// Examples: 
	// - localhost:5173 -> 'localhost' (dev)
	// - mysite.kuratchi.com -> 'mysite'
	// - mysite-preview.kuratchi.com -> 'mysite-preview'
	const subdomain = hostname.split('.')[0].split(':')[0];
	
	console.log('[site-renderer] Incoming request:', { hostname, subdomain });

	try {
		let siteData = null;
		let siteDatabase = null;

		if (subdomain && subdomain !== 'localhost') {
			// Call dashboard API to resolve the site
			const dashboardUrl = env.DASHBOARD_API_URL || 'http://localhost:5173';
			const apiToken = env.SITE_RENDERER_API_TOKEN;

			if (!apiToken) {
				console.error('[site-renderer] SITE_RENDERER_API_TOKEN not configured');
			} else {
				const response = await fetch(`${dashboardUrl}/api/sites/resolve`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${apiToken}`
					},
					body: JSON.stringify({ subdomain })
				});

				if (response.ok) {
					const data = await response.json();
					siteData = data.site;
					siteDatabase = data.siteDatabase;

					if (siteData) {
						console.log('[site-renderer] Site resolved:', {
							id: siteData.id,
							name: siteData.name,
							subdomain: siteData.subdomain
						});
					}
				} else {
					console.error('[site-renderer] API error:', response.status, response.statusText);
				}
			}
		}

		// Attach site data to event.locals for use in routes
		event.locals.site = siteData;
		event.locals.siteDatabase = siteDatabase;

		if (!siteData) {
			console.warn('[site-renderer] No site found for subdomain:', subdomain);
		}
	} catch (error) {
		console.error('[site-renderer] Error in hooks:', error);
		// Continue anyway, routes can handle missing site data
	}

	return resolve(event);
};
