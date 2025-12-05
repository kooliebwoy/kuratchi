import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { createDefaultBlogData, type BlogData } from '@kuratchi/editor';
import { getDatabase, getSiteDatabase } from '$lib/server/db-context';

const requirePermission = (permission: string) => {
	const { locals } = getRequestEvent();
	const kur = locals.kuratchi as any;

	if (!kur?.roles?.hasPermission?.(permission)) {
		error(403, `Missing required permission: ${permission}`);
	}
};

const ensureAuthenticated = () => {
	const { locals } = getRequestEvent();
	if (!locals?.session?.user) {
		error(401, 'Unauthorized');
	}
	return locals;
};

const parseMetadata = (raw: unknown): Record<string, unknown> => {
	if (!raw) return {};

	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
		} catch {
			return {};
		}
	}

	return typeof raw === 'object' ? ((raw as Record<string, unknown>) ?? {}) : {};
};

const normalizeBlogData = (raw: unknown): BlogData => {
	const base = createDefaultBlogData();
	if (!raw || typeof raw !== 'object') return base;

	const data = raw as Partial<BlogData>;
	return {
		categories: Array.isArray(data.categories) ? data.categories : base.categories,
		tags: Array.isArray(data.tags) ? data.tags : base.tags,
		posts: Array.isArray(data.posts) ? data.posts : base.posts,
		settings: {
			...base.settings,
			...(data.settings ?? {})
		}
	};
};

const BlogLoadSchema = v.object({
	siteId: v.string()
});

const BlogSaveSchema = v.object({
	siteId: v.string(),
	blog: v.record(v.string(), v.unknown())
});

export const loadBlogModule = query(BlogLoadSchema, async ({ siteId }) => {
	const locals = ensureAuthenticated();
	requirePermission('sites.read');

	const db = await getDatabase(locals);
	const siteResult = await db.sites.where({ id: siteId, deleted_at: { isNullish: true } }).first();

	if (!siteResult.success || !siteResult.data) {
		error(404, 'Site not found');
	}

	const metadata = parseMetadata(siteResult.data.metadata);
	const blog = normalizeBlogData((metadata as any).blog);

	return {
		blog,
		metadataUpdatedAt: siteResult.data.updated_at ?? null
	};
});

export const saveBlogModule = command(BlogSaveSchema, async ({ siteId, blog }) => {
	const locals = ensureAuthenticated();
	requirePermission('sites.update');

	const db = await getDatabase(locals);
	const siteResult = await db.sites.where({ id: siteId, deleted_at: { isNullish: true } }).first();

	if (!siteResult.success || !siteResult.data) {
		error(404, 'Site not found');
	}

	const metadata = parseMetadata(siteResult.data.metadata);
	const now = new Date().toISOString();

	const updateResult = await db.sites
		.where({ id: siteId })
		.update({ metadata: { ...metadata, blog }, updated_at: now });

	if (!updateResult.success) {
		error(500, `Failed to save blog settings: ${updateResult.error ?? 'unknown error'}`);
	}

	return { updated_at: now };
});

export const listSitePagesForBlog = query(BlogLoadSchema, async ({ siteId }) => {
	const locals = ensureAuthenticated();
	requirePermission('sites.read');

	const { siteDb } = await getSiteDatabase(locals, siteId);
	const result = await siteDb.pages
		.where({ deleted_at: { isNullish: true } })
		.orderBy({ updated_at: 'desc' })
		.many();

	if (!result.success) {
		error(500, `Failed to load site pages: ${result.error ?? 'unknown error'}`);
	}

	return (result.data || []).map((page: any) => ({
		id: page.id as string,
		title: (page.title as string) || 'Untitled Page',
		slug: (page.slug as string) || '',
		pageType: (page.pageType as string | null) ?? null,
		isSpecialPage: (page.isSpecialPage as boolean | null) ?? null,
		status: (page.status as boolean | null) ?? null,
		updated_at: (page.updated_at as string | null) ?? null
	}));
});
