import { getRequestEvent, query, form, command } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db-context';

// Helper to check permissions
const requirePermission = (permission: string) => {
	const { locals } = getRequestEvent();
	const kur = locals.kuratchi as any;
	
	if (!kur?.roles?.hasPermission?.(permission)) {
		error(403, `Missing required permission: ${permission}`);
	}
};

// Helper to log activity
const logActivity = async (action: string, data?: any) => {
	const { locals } = getRequestEvent();
	const kur = locals.kuratchi as any;
	const session = locals.session;
	const organizationId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;

	try {
		await kur?.activity?.log?.({
			action,
			data,
			organizationId
		});
	} catch (err) {
		console.error('[logActivity] Failed to log activity:', err);
	}
};

// Guarded query with permission check (organization-level)
const guardedQuery = <R>(permission: string, fn: (db: any) => Promise<R>) => {
	return query(async () => {
		const { locals } = getRequestEvent();
		const session = locals.session;
		if (!session?.user) error(401, 'Unauthorized');
		
		requirePermission(permission);

		const db = await getDatabase(locals);
		return fn(db);
	});
};

// Guarded command with permission check and activity logging (organization-level)
const guardedCommand = <T, R>(
	permission: string,
	schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
	activityType: string,
	fn: (data: T, db: any) => Promise<R>
) => {
	return command(schema, async (data: T) => {
		const { locals } = getRequestEvent();
		const session = locals.session;
		if (!session?.user) error(401, 'Unauthorized');

		requirePermission(permission);

		const db = await getDatabase(locals);
		const output = await fn(data, db);

		await logActivity(activityType, {
			input: data,
			output
		});

		return output;
	});
};

// ============================================================================
// SCHEMAS
// ============================================================================

const formFieldOptionSchema = v.object({
	id: v.string(),
	label: v.string(),
	value: v.string()
});

const formFieldSchema = v.object({
	id: v.string(),
	type: v.picklist(['text', 'email', 'tel', 'number', 'textarea', 'select', 'checkbox', 'radio', 'date', 'file']),
	label: v.string(),
	placeholder: v.optional(v.string()),
	required: v.boolean(),
	name: v.string(),
	options: v.optional(v.array(formFieldOptionSchema)),
	defaultValue: v.optional(v.string()),
	helpText: v.optional(v.string()),
	validation: v.optional(v.object({
		min: v.optional(v.number()),
		max: v.optional(v.number()),
		pattern: v.optional(v.string()),
		errorMessage: v.optional(v.string())
	})),
	width: v.optional(v.picklist(['25', '33', '50', '66', '75', '100']))
});

const formSettingsSchema = v.object({
	formName: v.string(),
	submitButtonText: v.string(),
	successMessage: v.string(),
	errorMessage: v.string(),
	recipients: v.array(v.string()),
	autoResponder: v.object({
		enabled: v.boolean(),
		subject: v.string(),
		message: v.string(),
		replyTo: v.optional(v.string())
	}),
	styling: v.object({
		buttonColor: v.optional(v.string()),
		buttonTextColor: v.optional(v.string()),
		borderRadius: v.optional(v.string()),
		spacing: v.optional(v.picklist(['compact', 'normal', 'relaxed']))
	}),
	redirectUrl: v.optional(v.string()),
	submitEndpoint: v.optional(v.string())
});

const stylingSchema = v.object({
	buttonColor: v.optional(v.string()),
	buttonTextColor: v.optional(v.string()),
	borderRadius: v.optional(v.string()),
	spacing: v.optional(v.picklist(['compact', 'normal', 'relaxed']))
});

const createFormSchema = v.object({
	name: v.string(),
	description: v.optional(v.string()),
	fields: v.array(formFieldSchema),
	settings: formSettingsSchema,
	styling: v.optional(stylingSchema)
});

const updateFormSchema = v.object({
	id: v.string(),
	name: v.optional(v.string()),
	description: v.optional(v.string()),
	fields: v.optional(v.array(formFieldSchema)),
	settings: v.optional(formSettingsSchema),
	styling: v.optional(stylingSchema)
});

const deleteFormSchema = v.object({
	id: v.string()
});

const attachFormSchema = v.object({
	formId: v.string(),
	siteId: v.string(),
	overrides: v.optional(v.record(v.string(), v.any()))
});

const detachFormSchema = v.object({
	formId: v.string(),
	siteId: v.string()
});

const submitFormSchema = v.object({
	formId: v.string(),
	siteId: v.string(),
	data: v.record(v.string(), v.any())
});

const updateLeadStatusSchema = v.object({
	id: v.string(),
	status: v.picklist(['new', 'contacted', 'qualified', 'converted', 'archived']),
	notes: v.optional(v.string())
});

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all forms for the organization
 */
export const getForms = guardedQuery('forms.read', async (db) => {
	const result = await db.forms
		.where({ deleted_at: { isNullish: true } })
		.many();
	
	if (!result.success) {
		console.error('[getForms] Database error:', result.error);
		error(500, 'Failed to fetch forms');
	}

	return (result.data || []).map(transformDbForm);
});

/**
 * Get a single form by ID
 */
export const getForm = guardedQuery('forms.read', async (db) => {
	const { params } = getRequestEvent();
	const formId = params.formId || params.id;
	
	if (!formId) {
		error(400, 'Form ID is required');
	}

	const result = await db.forms
		.where({ id: formId, deleted_at: { isNullish: true } })
		.first();
	
	if (!result.success || !result.data) {
		error(404, 'Form not found');
	}

	return transformDbForm(result.data);
});

/**
 * Get forms attached to a specific site
 */
export const getFormsBySite = guardedQuery('forms.read', async (db) => {
	const { params } = getRequestEvent();
	const siteId = params.siteId || params.id;
	
	if (!siteId) {
		error(400, 'Site ID is required');
	}

	// Get form attachments for this site
	const attachments = await db.formSites
		.where({ siteId, status: true, deleted_at: { isNullish: true } })
		.many();
	
	if (!attachments.success || !attachments.data?.length) {
		return [];
	}

	// Get the actual forms
	const formIds = attachments.data.map((a: any) => a.formId);
	const forms = await db.forms
		.where({ deleted_at: { isNullish: true } })
		.many();
	
	if (!forms.success) {
		return [];
	}

	// Filter and merge with overrides
	const attachmentMap = new Map(attachments.data.map((a: any) => [a.formId, a]));
	return (forms.data || [])
		.filter((f: any) => formIds.includes(f.id))
		.map((f: any) => {
			const attachment = attachmentMap.get(f.id);
			return {
				...transformDbForm(f),
				attachmentId: attachment?.id,
				overrides: attachment?.overrides ? JSON.parse(attachment.overrides) : {}
			};
		});
});

/**
 * Get all leads (optionally filtered by form or site)
 */
export const getLeads = guardedQuery('leads.read', async (db) => {
	const { params, url } = getRequestEvent();
	const formId = params.formId || url.searchParams.get('formId');
	const siteId = params.siteId || url.searchParams.get('siteId');
	const status = url.searchParams.get('status');
	
	let query = db.leads.where({ deleted_at: { isNullish: true } });
	
	if (formId) {
		query = query.where({ formId });
	}
	if (siteId) {
		query = query.where({ siteId });
	}
	if (status) {
		query = query.where({ status });
	}

	const result = await query.many();
	
	if (!result.success) {
		console.error('[getLeads] Database error:', result.error);
		error(500, 'Failed to fetch leads');
	}

	return (result.data || []).map((lead: any) => ({
		...lead,
		data: typeof lead.data === 'string' ? JSON.parse(lead.data) : lead.data
	}));
});

/**
 * Get sites a form is attached to
 */
export const getFormSites = guardedQuery('forms.read', async (db) => {
	const { params } = getRequestEvent();
	const formId = params.formId || params.id;
	
	if (!formId) {
		error(400, 'Form ID is required');
	}

	const attachments = await db.formSites
		.where({ formId, status: true, deleted_at: { isNullish: true } })
		.many();
	
	if (!attachments.success) {
		return [];
	}

	// Get site details
	const siteIds = (attachments.data || []).map((a: any) => a.siteId);
	if (!siteIds.length) return [];

	const sites = await db.sites
		.where({ deleted_at: { isNullish: true } })
		.many();
	
	return (sites.data || [])
		.filter((s: any) => siteIds.includes(s.id))
		.map((s: any) => ({
			id: s.id,
			name: s.name,
			subdomain: s.subdomain
		}));
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new form (organization-level)
 */
export const createForm = guardedCommand(
	'forms.write',
	createFormSchema,
	'forms.create',
	async (data: any, db) => {
		const { name, description, fields, settings, styling } = data;

		const formId = crypto.randomUUID();
		const now = new Date().toISOString();

		const dbForm = {
			id: formId,
			name,
			description: description || '',
			fields: JSON.stringify(fields),
			settings: JSON.stringify(settings),
			styling: JSON.stringify(styling || {}),
			status: true,
			created_at: now,
			updated_at: now
		};

		const result = await db.forms.insert(dbForm);

		if (!result.success) {
			console.error('[createForm] Database error:', result.error);
			error(500, 'Failed to create form');
		}

		console.log('[createForm] Form created:', formId);

		return {
			success: true,
			message: 'Form created successfully',
			data: { id: formId, name, fields, settings, styling }
		};
	}
);

/**
 * Update an existing form
 */
export const updateForm = guardedCommand(
	'forms.write',
	updateFormSchema,
	'forms.update',
	async (data: any, db) => {
		const { id, name, description, fields, settings, styling } = data;

		const updates: Record<string, any> = {
			updated_at: new Date().toISOString()
		};

		if (name !== undefined) updates.name = name;
		if (description !== undefined) updates.description = description;
		if (fields) updates.fields = JSON.stringify(fields);
		if (settings) updates.settings = JSON.stringify(settings);
		if (styling) updates.styling = JSON.stringify(styling);

		const result = await db.forms.where({ id }).update(updates);

		if (!result.success) {
			console.error('[updateForm] Database error:', result.error);
			error(500, 'Failed to update form');
		}

		console.log('[updateForm] Form updated:', id);

		return {
			success: true,
			message: 'Form updated successfully',
			data: { id }
		};
	}
);

/**
 * Delete a form (soft delete)
 */
export const deleteForm = guardedCommand(
	'forms.write',
	deleteFormSchema,
	'forms.delete',
	async (data: any, db) => {
		const { id } = data;
		const now = new Date().toISOString();

		// Soft delete the form
		const result = await db.forms.where({ id }).update({ deleted_at: now });

		if (!result.success) {
			console.error('[deleteForm] Database error:', result.error);
			error(500, 'Failed to delete form');
		}

		// Also soft delete attachments
		await db.formSites.where({ formId: id }).update({ deleted_at: now });

		console.log('[deleteForm] Form deleted:', id);

		return {
			success: true,
			message: 'Form deleted successfully'
		};
	}
);

/**
 * Attach a form to a site
 */
export const attachFormToSite = guardedCommand(
	'forms.write',
	attachFormSchema,
	'forms.attach',
	async (data: any, db) => {
		const { formId, siteId, overrides } = data;
		const now = new Date().toISOString();

		// Check if already attached
		const existing = await db.formSites
			.where({ formId, siteId, deleted_at: { isNullish: true } })
			.first();

		if (existing.success && existing.data) {
			// Update existing attachment
			await db.formSites.where({ id: existing.data.id }).update({
				overrides: JSON.stringify(overrides || {}),
				status: true,
				updated_at: now
			});
			return { success: true, message: 'Form attachment updated', id: existing.data.id };
		}

		// Create new attachment
		const attachmentId = crypto.randomUUID();
		const result = await db.formSites.insert({
			id: attachmentId,
			formId,
			siteId,
			overrides: JSON.stringify(overrides || {}),
			status: true,
			created_at: now,
			updated_at: now
		});

		if (!result.success) {
			console.error('[attachFormToSite] Database error:', result.error);
			error(500, 'Failed to attach form to site');
		}

		console.log('[attachFormToSite] Form', formId, 'attached to site', siteId);

		return {
			success: true,
			message: 'Form attached to site',
			id: attachmentId
		};
	}
);

/**
 * Detach a form from a site
 */
export const detachFormFromSite = guardedCommand(
	'forms.write',
	detachFormSchema,
	'forms.detach',
	async (data: any, db) => {
		const { formId, siteId } = data;
		const now = new Date().toISOString();

		const result = await db.formSites
			.where({ formId, siteId })
			.update({ deleted_at: now, status: false });

		if (!result.success) {
			console.error('[detachFormFromSite] Database error:', result.error);
			error(500, 'Failed to detach form from site');
		}

		console.log('[detachFormFromSite] Form', formId, 'detached from site', siteId);

		return {
			success: true,
			message: 'Form detached from site'
		};
	}
);

/**
 * Submit form data (creates a lead) - PUBLIC endpoint for site renderer
 */
export const submitForm = form('unchecked', async (data: any) => {
	const result = v.safeParse(submitFormSchema, data);
	if (!result.success) {
		error(400, 'Invalid form submission');
	}

	const { formId, siteId, data: formData } = result.output;
	const { locals, request } = getRequestEvent();

	// Get org database (forms are org-level)
	const db = await getDatabase(locals);

	// Verify form exists and is attached to this site
	const formResult = await db.forms
		.where({ id: formId, deleted_at: { isNullish: true } })
		.first();
	
	if (!formResult.success || !formResult.data) {
		error(404, 'Form not found');
	}

	const formRecord = formResult.data;
	const settings = typeof formRecord.settings === 'string' 
		? JSON.parse(formRecord.settings) 
		: formRecord.settings;

	// Create the lead with site attribution
	const leadId = crypto.randomUUID();
	const now = new Date().toISOString();

	const leadResult = await db.leads.insert({
		id: leadId,
		formId,
		siteId,
		data: JSON.stringify(formData),
		source: request.headers.get('referer') || '',
		ipAddress: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '',
		userAgent: request.headers.get('user-agent') || '',
		status: 'new',
		created_at: now,
		updated_at: now
	});

	if (!leadResult.success) {
		console.error('[submitForm] Failed to create lead:', leadResult.error);
		error(500, 'Failed to submit form');
	}

	console.log('[submitForm] Lead created:', leadId, 'for form:', formId, 'from site:', siteId);

	// TODO: Send email notifications to recipients
	// TODO: Send auto-responder if enabled

	return {
		success: true,
		message: settings?.successMessage || 'Thank you for your submission!',
		leadId
	};
});

/**
 * Update lead status
 */
export const updateLeadStatus = guardedCommand(
	'leads.write',
	updateLeadStatusSchema,
	'leads.update',
	async (data: any, db) => {
		const { id, status, notes } = data;

		const updates: Record<string, any> = {
			status,
			updated_at: new Date().toISOString()
		};

		if (notes !== undefined) {
			updates.notes = notes;
		}

		const result = await db.leads.where({ id }).update(updates);

		if (!result.success) {
			console.error('[updateLeadStatus] Database error:', result.error);
			error(500, 'Failed to update lead');
		}

		return {
			success: true,
			message: 'Lead updated successfully'
		};
	}
);

/**
 * Export leads as CSV
 */
export const exportLeads = guardedQuery('leads.read', async (db) => {
	const { params, url } = getRequestEvent();
	const formId = params.formId || url.searchParams.get('formId');
	const siteId = url.searchParams.get('siteId');
	
	if (!formId) {
		error(400, 'Form ID is required');
	}

	// Get form to get field names
	const formResult = await db.forms.where({ id: formId }).first();
	if (!formResult.success || !formResult.data) {
		error(404, 'Form not found');
	}

	const formRecord = formResult.data;
	const fields = typeof formRecord.fields === 'string' ? JSON.parse(formRecord.fields) : formRecord.fields;

	// Get leads (optionally filtered by site)
	let query = db.leads.where({ formId, deleted_at: { isNullish: true } });
	if (siteId) {
		query = query.where({ siteId });
	}
	const leadsResult = await query.many();
	
	if (!leadsResult.success) {
		error(500, 'Failed to fetch leads');
	}

	const leads = leadsResult.data || [];

	// Build CSV with site attribution
	const headers = ['ID', 'Site', 'Status', 'Submitted At', ...fields.map((f: any) => f.label)];
	const rows = leads.map((lead: any) => {
		const data = typeof lead.data === 'string' ? JSON.parse(lead.data) : lead.data;
		return [
			lead.id,
			lead.siteId || 'Unknown',
			lead.status,
			lead.created_at,
			...fields.map((f: any) => data[f.name] || '')
		];
	});

	const csv = [
		headers.join(','),
		...rows.map((row: any[]) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
	].join('\n');

	return {
		success: true,
		csv,
		filename: `${formRecord.name || 'form'}-leads-${new Date().toISOString().split('T')[0]}.csv`
	};
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Transform database form to API format
 */
function transformDbForm(dbForm: any) {
	return {
		id: dbForm.id,
		name: dbForm.name,
		description: dbForm.description,
		fields: typeof dbForm.fields === 'string' ? JSON.parse(dbForm.fields) : dbForm.fields || [],
		settings: typeof dbForm.settings === 'string' ? JSON.parse(dbForm.settings) : dbForm.settings || {},
		styling: typeof dbForm.styling === 'string' ? JSON.parse(dbForm.styling) : dbForm.styling || {},
		status: dbForm.status,
		created_at: dbForm.created_at,
		updated_at: dbForm.updated_at
	};
}
