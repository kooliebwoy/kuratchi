import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { getThemeHomepage } from '@kuratchi/editor';

import { getSiteDatabase, getDatabase, type SiteDatabaseContext } from '$lib/server/db-context';

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

const JsonRecordSchema = v.record(v.string(), v.unknown());

const PageDataSchema = v.object({
	id: v.optional(v.string()),
	title: v.string(),
	seoTitle: v.string(),
	seoDescription: v.string(),
	slug: v.string(),
	content: v.array(v.unknown()),
	pageType: v.optional(v.string())
});

type PageData = v.InferOutput<typeof PageDataSchema>;

export interface SiteSummary {
	id: string;
	name: string | null;
	subdomain: string | null;
	description: string | null;
	databaseId: string | null;
	dbuuid: string | null;
	workerName: string | null;
	metadata: Record<string, unknown> | null;
}

export interface AttachedForm {
	id: string;
	name: string;
	description: string;
	fields: any[];
	settings: any;
	styling: any;
}

export interface SiteEditorResult {
	site: SiteSummary;
	page: PageData;
	forms: AttachedForm[];
}

export interface SaveSitePageResult {
	id: string;
	updated_at: string;
}

type SiteContext = SiteDatabaseContext;

const SavePayloadSchema = v.object({
	siteId: v.string(),
	page: PageDataSchema
});

type SavePayload = v.InferOutput<typeof SavePayloadSchema>;

const SaveSiteMetadataSchema = v.object({
	siteId: v.string(),
	metadata: JsonRecordSchema
});

type SaveSiteMetadataPayload = v.InferOutput<typeof SaveSiteMetadataSchema>;

type PageRow = {
	id: string;
	title: string | null;
	seoTitle: string | null;
	seoDescription: string | null;
	slug: string | null;
	pageType: string | null;
	status: boolean | null;
	data: any;
};

async function resolveSiteContext(siteId: string): Promise<SiteContext> {
	const { locals } = getRequestEvent();
	return getSiteDatabase(locals, siteId);
}

function toPageData(row: PageRow | null, site: SiteContext['site']): PageData {
	const data = (row?.data && typeof row.data === 'object') ? row.data : {};
	const content = Array.isArray((data as any).content)
		? (data as any).content.map((item: unknown) =>
			item && typeof item === 'object'
				? item as Record<string, unknown>
				: ({} as Record<string, unknown>)
		  )
		: [];

	return {
		id: row?.id,
		title: row?.title ?? site.name ?? 'Untitled Page',
		seoTitle: row?.seoTitle ?? row?.title ?? site.name ?? '',
		seoDescription: row?.seoDescription ?? '',
		slug: row?.slug ?? 'homepage',
		content,
		pageType: row?.pageType
	};
}

async function getOrCreateHomepage(siteDb: SiteContext['siteDb'], site: SiteContext['site'], themeId?: string | null): Promise<PageRow> {
    // Resolve homepage by slug to avoid reliance on pageType consistency
    const existing = await siteDb.pages
        .where({ slug: 'homepage', deleted_at: { isNullish: true } })
        .first();

	    if (existing.success && existing.data) {
        // Normalize accidental pageType drift
        if (existing.data.pageType !== 'homepage') {
            await siteDb.pages
                .where({ id: existing.data.id })
                .update({ pageType: 'homepage' });
        }
        return existing.data as PageRow;
    }

	// Load default homepage template from theme
	const themeHomepage = getThemeHomepage(themeId);
	const now = new Date().toISOString();
	const defaultData = {
		content: themeHomepage.content as Record<string, unknown>[]
	};

	const pageId = crypto.randomUUID();
	const insertResult = await siteDb.pages.insert({
		id: pageId,
		title: themeHomepage.title || site.name || 'Untitled Page',
		seoTitle: themeHomepage.seoTitle || site.name || 'Homepage',
		seoDescription: themeHomepage.seoDescription || site.description || '',
		slug: themeHomepage.slug || 'homepage',
		pageType: 'homepage',
		isSpecialPage: true,
		status: true,
		data: defaultData,
		created_at: now,
		updated_at: now,
		deleted_at: null
	});

	if (!insertResult.success || !insertResult.data) {
		error(500, `Unable to create homepage: ${insertResult.error ?? 'unknown error'}`);
	}

	return insertResult.data as PageRow;
}

export const loadSiteEditor = query(async (): Promise<SiteEditorResult> => {
	const { params, locals } = getRequestEvent();
	const siteId = params.id;

	if (!siteId) {
		error(400, 'Site ID is required');
	}

	const { site, siteDb } = await resolveSiteContext(siteId);
	
	const siteMetadata = site.metadata;
	const themeId = (siteMetadata?.themeId as string | undefined | null) || null;
	
	const pageRow = await getOrCreateHomepage(siteDb, site, themeId);

	// Load forms attached to this site from org database
	let forms: AttachedForm[] = [];
	try {
		const orgDb = await getDatabase(locals);
		
		// Get form attachments for this site
		const attachments = await orgDb.formSites
			.where({ siteId, status: true, deleted_at: { isNullish: true } })
			.many();
		
		if (attachments.success && attachments.data?.length) {
			const formIds = attachments.data.map((a: any) => a.formId);
			
			// Get the actual forms
			const formsResult = await orgDb.forms
				.where({ deleted_at: { isNullish: true } })
				.many();
			
			if (formsResult.success && formsResult.data) {
				forms = formsResult.data
					.filter((f: any) => formIds.includes(f.id))
					.map((f: any) => ({
						id: f.id,
						name: f.name,
						description: f.description || '',
						fields: typeof f.fields === 'string' ? JSON.parse(f.fields) : f.fields || [],
						settings: typeof f.settings === 'string' ? JSON.parse(f.settings) : f.settings || {},
						styling: typeof f.styling === 'string' ? JSON.parse(f.styling) : f.styling || {}
					}));
			}
		}
	} catch (err) {
		console.error('[loadSiteEditor] Failed to load forms:', err);
		// Continue without forms - they may not exist yet
	}

	return {
		site: {
			id: site.id,
			name: site.name,
			subdomain: site.subdomain,
			description: site.description,
			databaseId: site.databaseId,
			dbuuid: site.dbuuid,
			workerName: site.workerName,
			metadata: siteMetadata
		},
		page: toPageData(pageRow, site),
		forms
	};
});

export const saveSitePage = command(SavePayloadSchema, async ({ siteId, page }: SavePayload): Promise<SaveSitePageResult> => {
	const { site, siteDb } = await resolveSiteContext(siteId);

	const plainPage = typeof structuredClone === 'function' ? structuredClone(page) : JSON.parse(JSON.stringify(page));
	const normalizedContent = Array.isArray(plainPage.content)
		? plainPage.content.map((item) =>
			item && typeof item === 'object'
				? item as Record<string, unknown>
				: ({} as Record<string, unknown>)
		  )
		: [] as Record<string, unknown>[];
	const normalizedMetadata = plainPage.metadata && typeof plainPage.metadata === 'object'
		? plainPage.metadata as Record<string, unknown>
		: {};

	const now = new Date().toISOString();
	const normalizedSlug = (plainPage.slug || '')
		.toString()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'homepage';

	const isHomepage = (plainPage.pageType === 'homepage') || normalizedSlug === 'homepage';
	const payload = {
		title: plainPage.title,
		seoTitle: plainPage.seoTitle,
		seoDescription: plainPage.seoDescription,
		slug: normalizedSlug,
		pageType: isHomepage ? 'homepage' : 'webpage',
		status: true,
		data: {
			content: normalizedContent
		},
		updated_at: now
	};

	const pageId = plainPage.id;

    // Normalize any legacy rows that may still have pageType 'page'
    if (!isHomepage) {
        await siteDb.pages
            .where({ slug: normalizedSlug, pageType: 'page', deleted_at: { isNullish: true } })
            .update({ pageType: 'webpage' });
    }

	if (pageId) {
		const updateResult = await siteDb.pages
			.where({ id: pageId })
			.update(payload);

		if (!updateResult.success) {
			error(500, `Failed to update page: ${updateResult.error ?? 'unknown error'}`);
		}

		await logActivity('editor.page_updated', { siteId, pageId, title: plainPage.title, slug: normalizedSlug });

		return { id: pageId, updated_at: now } satisfies SaveSitePageResult;
	}

	const existing = await siteDb.pages
		.where({ pageType: 'homepage', deleted_at: { isNullish: true } })
		.first();

	if (existing.success && existing.data) {
		const updateResult = await siteDb.pages
			.where({ id: existing.data.id })
			.update(payload);

		if (!updateResult.success) {
			error(500, `Failed to update page: ${updateResult.error ?? 'unknown error'}`);
		}

		return { id: existing.data.id as string, updated_at: now } satisfies SaveSitePageResult;
	}

	const insertResult = await siteDb.pages.insert({
		id: crypto.randomUUID(),
		...payload,
		isSpecialPage: true,
		created_at: now,
		deleted_at: null
	});

	if (!insertResult.success || !insertResult.data) {
		error(500, `Failed to create page: ${insertResult.error ?? 'unknown error'}`);
	}

	await logActivity('editor.page_created', { siteId, pageId: insertResult.data.id, title: plainPage.title, slug: normalizedSlug });

	return { id: insertResult.data.id as string, updated_at: now } satisfies SaveSitePageResult;
});

export const saveSiteMetadata = command(SaveSiteMetadataSchema, async ({ siteId, metadata }: SaveSiteMetadataPayload): Promise<{ updated_at: string }> => {
	const { locals } = getRequestEvent();
	const db = await getDatabase(locals);

	const now = new Date().toISOString();
	const updateResult = await db.sites
		.where({ id: siteId })
		.update({ metadata, updated_at: now });

	if (!updateResult.success) {
		error(500, `Failed to update site metadata: ${updateResult.error ?? 'unknown error'}`);
	}

	await logActivity('editor.site_settings_updated', { siteId });

	return { updated_at: now };
});

// Page Management APIs

export interface PageListItem {
	id: string;
	title: string;
	slug: string;
	pageType: string | null;
	isSpecialPage: boolean | null;
	status: boolean | null;
	updated_at: string | null;
}

const LoadPageSchema = v.object({
	siteId: v.string(),
	pageId: v.string()
});

const CreatePageSchema = v.object({
	siteId: v.string(),
	title: v.string(),
	slug: v.string()
});

const DeletePageSchema = v.object({
	siteId: v.string(),
	pageId: v.string()
});

export const listSitePages = query(async (): Promise<PageListItem[]> => {
	const { params } = getRequestEvent();
	const siteId = params.id;

	if (!siteId) {
		error(400, 'Site ID is required');
	}

	const { siteDb } = await resolveSiteContext(siteId);
	
	// Return all pages (homepage + regular pages)
	const result = await siteDb.pages
		.where({ deleted_at: { isNullish: true } })
		.orderBy({ updated_at: 'desc' })
		.many();

	if (!result.success) {
		error(500, `Failed to load pages: ${result.error ?? 'unknown error'}`);
	}

	return (result.data || []).map((page) => ({
		id: page.id as string,
		title: (page.title as string) || 'Untitled Page',
		slug: (page.slug as string) || 'homepage',
		pageType: (page.pageType as string | null) ?? null,
		isSpecialPage: (page.isSpecialPage as boolean | null) ?? null,
		status: (page.status as boolean | null) ?? null,
		updated_at: (page.updated_at as string | null) ?? null
	}));
});

export const loadSitePage = query(LoadPageSchema, async ({ siteId, pageId }): Promise<PageData> => {
	const { site, siteDb } = await resolveSiteContext(siteId);
	
	const result = await siteDb.pages
		.where({ id: pageId, deleted_at: { isNullish: true } })
		.first();

	if (!result.success || !result.data) {
		error(404, 'Page not found');
	}

	return toPageData(result.data as PageRow, site);
});

export const createSitePage = command(CreatePageSchema, async ({ siteId, title, slug }): Promise<SaveSitePageResult> => {
	const { siteDb } = await resolveSiteContext(siteId);

	// Normalize slug
	const normalizedSlug = (slug || '')
		.toString()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '');

	// Check if slug already exists
	const existing = await siteDb.pages
		.where({ slug: normalizedSlug, deleted_at: { isNullish: true } })
		.first();

	if (existing.success && existing.data) {
		error(400, 'A page with this slug already exists');
	}

	const now = new Date().toISOString();
	const pageId = crypto.randomUUID();
	
	const insertResult = await siteDb.pages.insert({
		id: pageId,
		title,
		seoTitle: title,
		seoDescription: '',
		slug: normalizedSlug,
		pageType: 'webpage',
		isSpecialPage: false,
		status: true,
		data: { content: [] },
		created_at: now,
		updated_at: now,
		deleted_at: null
	});

	if (!insertResult.success || !insertResult.data) {
		error(500, `Failed to create page: ${insertResult.error ?? 'unknown error'}`);
	}

	await logActivity('editor.page_created', { siteId, pageId, title, slug: normalizedSlug });

	return { id: pageId, updated_at: now };
});

export const deleteSitePage = command(DeletePageSchema, async ({ siteId, pageId }): Promise<{ success: boolean }> => {
	const { siteDb } = await resolveSiteContext(siteId);

	// Check if it's a special page (homepage, etc.)
	const page = await siteDb.pages
		.where({ id: pageId })
		.first();

	if (!page.success || !page.data) {
		error(404, 'Page not found');
	}

	if (page.data.isSpecialPage) {
		error(400, 'Cannot delete special pages (homepage, etc.)');
	}

	const now = new Date().toISOString();
	const deleteResult = await siteDb.pages
		.where({ id: pageId })
		.update({ deleted_at: now });

	if (!deleteResult.success) {
		error(500, `Failed to delete page: ${deleteResult.error ?? 'unknown error'}`);
	}

	await logActivity('editor.page_deleted', { siteId, pageId, title: page.data.title, slug: page.data.slug });

	return { success: true };
});
