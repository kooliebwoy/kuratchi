import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import * as v from 'valibot';

const submitFormSchema = v.object({
	formId: v.string(),
	siteId: v.optional(v.string()),
	orgId: v.string(),
	data: v.record(v.string(), v.unknown())
});

/**
 * Public API endpoint for form submissions from site-renderer
 * Requires valid API token for authentication
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Verify API token
	const authHeader = request.headers.get('Authorization');
	const expectedToken = env.SITE_RENDERER_API_TOKEN;

	if (!expectedToken) {
		console.error('[forms/submit] SITE_RENDERER_API_TOKEN not configured');
		return json({ success: false, message: 'Server configuration error' }, { status: 500 });
	}

	if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const result = v.safeParse(submitFormSchema, body);

		if (!result.success) {
			return json({ success: false, message: 'Invalid form data' }, { status: 400 });
		}

		const { formId, siteId, orgId, data: formData } = result.output;

		// Get org database using orgId
		const db = await locals.kuratchi?.orgDatabaseClient?.(orgId);
		if (!db) {
			console.error('[forms/submit] Failed to get org database for:', orgId);
			return json({ success: false, message: 'Database not available' }, { status: 500 });
		}

		// Verify form exists
		const formResult = await db.forms
			.where({ id: formId, deleted_at: { isNullish: true } })
			.first();

		if (!formResult.success || !formResult.data) {
			return json({ success: false, message: 'Form not found' }, { status: 404 });
		}

		const formRecord = formResult.data;
		const fields = typeof formRecord.fields === 'string'
			? JSON.parse(formRecord.fields)
			: formRecord.fields || [];
		const settings = typeof formRecord.settings === 'string'
			? JSON.parse(formRecord.settings)
			: formRecord.settings || {};

		// Validate required fields
		for (const field of fields) {
			if (field.required && !formData[field.name]) {
				return json({ 
					success: false, 
					message: `${field.label} is required` 
				}, { status: 400 });
			}
		}

		// Create the lead
		const leadId = crypto.randomUUID();
		const now = new Date().toISOString();

		const leadResult = await db.leads.insert({
			id: leadId,
			formId,
			siteId: siteId || null,
			data: JSON.stringify(formData),
			source: request.headers.get('x-origin') || request.headers.get('referer') || '',
			ipAddress: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '',
			userAgent: request.headers.get('user-agent') || '',
			status: 'new',
			created_at: now,
			updated_at: now
		});

		if (!leadResult.success) {
			console.error('[forms/submit] Failed to create lead:', leadResult.error);
			return json({ success: false, message: 'Failed to submit form' }, { status: 500 });
		}

		console.log('[forms/submit] Lead created:', leadId, 'for form:', formId, 'from site:', siteId);

		return json({
			success: true,
			message: settings?.successMessage || 'Thank you for your submission!',
			leadId
		});
	} catch (err) {
		console.error('[forms/submit] Error:', err);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
};
