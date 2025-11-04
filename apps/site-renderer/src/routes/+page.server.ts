import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const load = async ({ locals }: RequestEvent) => {
	const { site, siteDatabase } = locals;

	if (!site || !siteDatabase) {
		return {
			page: null
		};
	}

	try {
		// Call dashboard API to fetch homepage
		const dashboardUrl = env.DASHBOARD_API_URL || 'http://localhost:5173';
		const apiToken = env.SITE_RENDERER_API_TOKEN;

		if (!apiToken) {
			console.error('[site-renderer] SITE_RENDERER_API_TOKEN not configured');
			return { page: null };
		}

		const response = await fetch(`${dashboardUrl}/api/sites/pages`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiToken}`
			},
			body: JSON.stringify({
				dbuuid: siteDatabase.dbuuid,
				workerName: siteDatabase.workerName,
				dbToken: siteDatabase.token,
				pageType: 'homepage'
			})
		});

		if (!response.ok) {
			console.error('[site-renderer] API error fetching page:', response.status);
			return { page: null };
		}

		const data = await response.json();
		return {
			page: data.page
		};
	} catch (err) {
		console.error('[site-renderer] Error loading homepage:', err);
		return {
			page: null
		};
	}
};
