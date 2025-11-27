import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

/**
 * Form submission endpoint for site-renderer
 * Validates form data locally, then proxies to dashboard API
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const site = locals.site;
	const forms = locals.forms || [];
	const orgId = locals.orgId;
	
	if (!site) {
		return json({ success: false, message: 'Site not found' }, { status: 404 });
	}

	if (!orgId) {
		console.error('[site-renderer/forms] Missing orgId');
		return json({ success: false, message: 'Organization not found' }, { status: 500 });
	}

	const dashboardUrl = env.DASHBOARD_API_URL || 'http://localhost:5173';
	const apiToken = env.SITE_RENDERER_API_TOKEN;

	if (!apiToken) {
		console.error('[site-renderer/forms] SITE_RENDERER_API_TOKEN not configured');
		return json({ success: false, message: 'Server configuration error' }, { status: 500 });
	}

	try {
		const body = await request.json();
		const { formId, data } = body;

		if (!formId || !data || typeof data !== 'object') {
			return json({ success: false, message: 'Missing formId or data' }, { status: 400 });
		}

		// Find the form in our cached forms
		const form = forms.find(f => f.id === formId);
		if (!form) {
			return json({ success: false, message: 'Form not found or not attached to this site' }, { status: 404 });
		}

		// Validate required fields locally before sending to dashboard
		for (const field of form.fields) {
			if (field.required && !data[field.name]) {
				return json({ 
					success: false, 
					message: `${field.label} is required` 
				}, { status: 400 });
			}
		}

		// Only include fields that exist in the form definition (prevent injection)
		const validFieldNames = new Set(form.fields.map(f => f.name));
		const sanitizedData: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(data)) {
			if (validFieldNames.has(key)) {
				sanitizedData[key] = value;
			}
		}

		// Forward to dashboard API with site context
		const response = await fetch(`${dashboardUrl}/api/forms/submit`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiToken}`,
				'X-Origin': request.headers.get('origin') || '',
				'X-Forwarded-For': request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || '',
				'User-Agent': request.headers.get('user-agent') || ''
			},
			body: JSON.stringify({
				formId,
				siteId: site.id,
				orgId,
				data: sanitizedData
			})
		});

		const result = await response.json();

		if (!response.ok) {
			console.error('[site-renderer/forms] Dashboard API error:', response.status, result);
			return json(result, { status: response.status });
		}

		return json(result);
	} catch (err) {
		console.error('[site-renderer/forms] Error:', err);
		return json({ success: false, message: 'Failed to submit form' }, { status: 500 });
	}
};
