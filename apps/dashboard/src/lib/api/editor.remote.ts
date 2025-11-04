import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { getThemeHomepage } from '@kuratchi/editor';

import { getSiteDatabase, type SiteDatabaseContext } from '$lib/server/db-context';

const JsonRecordSchema = v.record(v.string(), v.unknown());

const PageDataSchema = v.object({
	id: v.optional(v.string()),
	title: v.string(),
	seoTitle: v.string(),
	seoDescription: v.string(),
	slug: v.string(),
	content: v.array(v.unknown()),
	header: v.nullable(v.unknown()),
	footer: v.nullable(v.unknown()),
	metadata: v.optional(JsonRecordSchema)
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

export interface SiteEditorResult {
	site: SiteSummary;
	page: PageData;
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
		header: (data as any).header ?? null,
		footer: (data as any).footer ?? null,
		metadata: (typeof (data as any).metadata === 'object' && (data as any).metadata !== null)
			? (data as any).metadata as Record<string, unknown>
			: { backgroundColor: '#000000' }
	};
}

async function getOrCreateHomepage(siteDb: SiteContext['siteDb'], site: SiteContext['site'], themeId?: string | null): Promise<PageRow> {
	const existing = await siteDb.pages
		.where({ pageType: 'homepage', deleted_at: { isNullish: true } })
		.first();

	if (existing.success && existing.data) {
		return existing.data as PageRow;
	}

	// Load default homepage template from theme
	const themeHomepage = getThemeHomepage(themeId);
	const now = new Date().toISOString();
	const defaultData = {
		content: themeHomepage.content as Record<string, unknown>[],
		header: themeHomepage.header,
		footer: themeHomepage.footer,
		metadata: themeHomepage.metadata || { backgroundColor: '#ffffff' }
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
	const { params } = getRequestEvent();
	const siteId = params.id;

	if (!siteId) {
		error(400, 'Site ID is required');
	}

	const { site, siteDb } = await resolveSiteContext(siteId);
	
	const siteMetadata = site.metadata;
	const themeId = (siteMetadata?.themeId as string | undefined | null) || null;
	
	const pageRow = await getOrCreateHomepage(siteDb, site, themeId);

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
		page: toPageData(pageRow, site)
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
	const payload = {
		title: plainPage.title,
		seoTitle: plainPage.seoTitle,
		seoDescription: plainPage.seoDescription,
		slug: plainPage.slug || 'homepage',
		pageType: 'homepage',
		status: true,
		data: {
			content: normalizedContent,
			header: plainPage.header ?? null,
			footer: plainPage.footer ?? null,
			metadata: normalizedMetadata
		},
		updated_at: now
	};

	const pageId = plainPage.id;

	if (pageId) {
		const updateResult = await siteDb.pages
			.where({ id: pageId })
			.update(payload);

		if (!updateResult.success) {
			error(500, `Failed to update page: ${updateResult.error ?? 'unknown error'}`);
		}

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

	return { id: insertResult.data.id as string, updated_at: now } satisfies SaveSitePageResult;
});
