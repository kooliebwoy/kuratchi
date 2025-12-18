import { getRequestEvent, query, command } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { getDatabase, getSiteDatabase } from '$lib/server/db-context';

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

const navigationItemSchema: v.BaseSchema<any, any, v.BaseIssue<unknown>> = v.object({
	id: v.string(),
	label: v.string(),
	url: v.string(),
	target: v.optional(v.picklist(['_self', '_blank'])),
	icon: v.optional(v.string()),
	children: v.optional(v.array(v.lazy(() => navigationItemSchema)))
});

const createMenuSchema = v.object({
	name: v.string(),
	description: v.optional(v.string()),
	items: v.array(navigationItemSchema)
});

const updateMenuSchema = v.object({
	id: v.string(),
	name: v.optional(v.string()),
	description: v.optional(v.string()),
	items: v.optional(v.array(navigationItemSchema)),
	status: v.optional(v.boolean())
});

const deleteMenuSchema = v.object({
	id: v.string()
});

const attachMenuSchema = v.object({
	menuId: v.string(),
	siteId: v.string(),
	region: v.picklist(['header', 'footer']),
	overrides: v.optional(v.record(v.string(), v.any()))
});

const detachMenuSchema = v.object({
	menuId: v.string(),
	siteId: v.string(),
	region: v.picklist(['header', 'footer'])
});

const getMenuByIdSchema = v.object({
	id: v.string()
});

// ============================================================================
// TYPES
// ============================================================================

interface NavigationItem {
	id: string;
	label: string;
	url: string;
	target?: '_self' | '_blank';
	icon?: string;
	children?: NavigationItem[];
}

interface Menu {
	id: string;
	name: string;
	description: string | null;
	items: NavigationItem[];
	status: boolean;
	created_at: string;
	updated_at: string;
}

interface MenuSite {
	id: string;
	menuId: string;
	siteId: string;
	region: 'header' | 'footer';
	overrides: Record<string, unknown>;
	status: boolean;
}

// ============================================================================
// TRANSFORM HELPERS
// ============================================================================

function transformDbMenu(row: any): Menu {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []),
		status: row.status,
		created_at: row.created_at,
		updated_at: row.updated_at
	};
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all menus for the organization (with attached sites)
 */
export const getMenus = guardedQuery('sites.read', async (db) => {
	const result = await db.menus
		.where({ deleted_at: { isNullish: true } })
		.many();
	
	if (!result.success) {
		console.error('[getMenus] Database error:', result.error);
		error(500, 'Failed to fetch menus');
	}

	const menus = (result.data || []).map(transformDbMenu);

	// Get all menu-site attachments
	const attachmentsResult = await db.menuSites
		.where({ status: true, deleted_at: { isNullish: true } })
		.many();

	// Get all sites for name lookup
	const sitesResult = await db.sites
		.where({ deleted_at: { isNullish: true } })
		.many();

	const sitesMap = new Map((sitesResult.data || []).map((s: any) => [s.id, s]));

	// Group attachments by menuId
	const attachmentsByMenu = new Map<string, Array<{ siteId: string; siteName: string; subdomain: string; region: string }>>();
	for (const att of (attachmentsResult.data || []) as any[]) {
		const site = sitesMap.get(att.siteId) as any;
		if (!site) continue;
		
		if (!attachmentsByMenu.has(att.menuId)) {
			attachmentsByMenu.set(att.menuId, []);
		}
		attachmentsByMenu.get(att.menuId)!.push({
			siteId: att.siteId,
			siteName: site.name,
			subdomain: site.subdomain,
			region: att.region
		});
	}

	// Add attachedSites to each menu
	return menus.map(menu => ({
		...menu,
		attachedSites: attachmentsByMenu.get(menu.id) || []
	}));
});

/**
 * Get a single menu by ID
 */
export const getMenu = guardedQuery('sites.read', async (db) => {
	const { params } = getRequestEvent();
	const menuId = params.menuId || params.id;
	
	if (!menuId) {
		error(400, 'Menu ID is required');
	}

	const result = await db.menus
		.where({ id: menuId, deleted_at: { isNullish: true } })
		.first();
	
	if (!result.success || !result.data) {
		error(404, 'Menu not found');
	}

	return transformDbMenu(result.data);
});

/**
 * Get menu by ID (command version for use in page load)
 */
export const getMenuById = command(getMenuByIdSchema, async (data) => {
	const { locals } = getRequestEvent();
	const session = locals.session;
	if (!session?.user) error(401, 'Unauthorized');

	const db = await getDatabase(locals);
	
	const result = await db.menus
		.where({ id: data.id, deleted_at: { isNullish: true } })
		.first();
	
	if (!result.success || !result.data) {
		error(404, 'Menu not found');
	}

	return transformDbMenu(result.data);
});

/**
 * Get menus attached to a specific site
 */
export const getMenusBySite = guardedQuery('sites.read', async (db) => {
	const { params } = getRequestEvent();
	const siteId = params.siteId || params.id;
	
	if (!siteId) {
		error(400, 'Site ID is required');
	}

	// Get menu attachments for this site
	const attachments = await db.menuSites
		.where({ siteId, status: true, deleted_at: { isNullish: true } })
		.many();
	
	if (!attachments.success || !attachments.data?.length) {
		return [];
	}

	// Get the actual menus
	const menuIds = attachments.data.map((a: any) => a.menuId);
	const menus = await db.menus
		.where({ deleted_at: { isNullish: true } })
		.many();
	
	if (!menus.success) {
		return [];
	}

	// Filter and merge with region info
	const attachmentMap = new Map(attachments.data.map((a: any) => [a.menuId, a]));
	return menus.data
		.filter((m: any) => menuIds.includes(m.id))
		.map((m: any) => {
			const attachment = attachmentMap.get(m.id);
			return {
				...transformDbMenu(m),
				region: attachment?.region || 'header',
				overrides: attachment?.overrides || {}
			};
		});
});

/**
 * Get sites that have a specific menu attached
 */
export const getMenuSites = guardedQuery('sites.read', async (db) => {
	const { params } = getRequestEvent();
	const menuId = params.menuId || params.id;
	
	if (!menuId) {
		error(400, 'Menu ID is required');
	}

	const attachments = await db.menuSites
		.where({ menuId, status: true, deleted_at: { isNullish: true } })
		.many();
	
	if (!attachments.success || !attachments.data?.length) {
		return [];
	}

	const siteIds = attachments.data.map((a: any) => a.siteId);
	const sites = await db.sites
		.where({ deleted_at: { isNullish: true } })
		.many();
	
	if (!sites.success) {
		return [];
	}

	const attachmentMap = new Map(attachments.data.map((a: any) => [a.siteId, a]));
	return sites.data
		.filter((s: any) => siteIds.includes(s.id))
		.map((s: any) => {
			const attachment = attachmentMap.get(s.id);
			return {
				id: s.id,
				name: s.name,
				subdomain: s.subdomain,
				region: attachment?.region || 'header'
			};
		});
});

// ============================================================================
// SITE PAGES (for internal linking)
// ============================================================================

const getSitePagesSchema = v.object({
	siteId: v.string()
});

/**
 * Get pages for a site (for internal link selection in menu editor)
 */
export const getSitePages = command(getSitePagesSchema, async (data) => {
	const { locals } = getRequestEvent();
	const session = locals.session;
	if (!session?.user) error(401, 'Unauthorized');

	requirePermission('sites.read');

	try {
		const { siteDb } = await getSiteDatabase(locals, data.siteId);
		
		const result = await siteDb.pages
			.where({ deleted_at: { isNullish: true }, status: true })
			.select(['id', 'title', 'slug', 'pageType', 'isSpecialPage'])
			.orderBy({ title: 'asc' })
			.many();

		if (!result.success) {
			console.error('[getSitePages] Failed to fetch pages:', result.error);
			return [];
		}

		// Transform to simple format for menu linking
		return (result.data || []).map((page: any) => ({
			id: page.id,
			title: page.title,
			slug: page.slug,
			url: page.slug === 'homepage' ? '/' : `/${page.slug}`,
			pageType: page.pageType,
			isSpecialPage: page.isSpecialPage
		}));
	} catch (err) {
		console.error('[getSitePages] Error:', err);
		return [];
	}
});

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * Create a new menu
 */
export const createMenu = guardedCommand(
	'sites.write',
	createMenuSchema,
	'menu.created',
	async (data, db) => {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		const result = await db.menus.insert({
			id,
			name: data.name,
			description: data.description || null,
			items: JSON.stringify(data.items),
			status: true,
			created_at: now,
			updated_at: now
		});

		if (!result.success) {
			console.error('[createMenu] Failed to create menu:', result.error);
			error(500, 'Failed to create menu');
		}

		return { id, name: data.name };
	}
);

/**
 * Update an existing menu
 */
export const updateMenu = guardedCommand(
	'sites.write',
	updateMenuSchema,
	'menu.updated',
	async (data, db) => {
		const { id, ...updates } = data;
		const now = new Date().toISOString();

		// Build update object
		const updateObj: Record<string, any> = { updated_at: now };
		if (updates.name !== undefined) updateObj.name = updates.name;
		if (updates.description !== undefined) updateObj.description = updates.description;
		if (updates.items !== undefined) updateObj.items = JSON.stringify(updates.items);
		if (updates.status !== undefined) updateObj.status = updates.status;

		const result = await db.menus.where({ id }).update(updateObj);

		if (!result.success) {
			console.error('[updateMenu] Failed to update menu:', result.error);
			error(500, 'Failed to update menu');
		}

		return { id, updated: true };
	}
);

/**
 * Delete a menu (soft delete)
 */
export const deleteMenu = guardedCommand(
	'sites.write',
	deleteMenuSchema,
	'menu.deleted',
	async (data, db) => {
		const now = new Date().toISOString();

		// Soft delete the menu
		const result = await db.menus
			.update({ deleted_at: now, updated_at: now })
			.where({ id: data.id });

		if (!result.success) {
			console.error('[deleteMenu] Failed to delete menu:', result.error);
			error(500, 'Failed to delete menu');
		}

		// Also soft delete all attachments
		await db.menuSites
			.update({ deleted_at: now, updated_at: now })
			.where({ menuId: data.id });

		return { id: data.id, deleted: true };
	}
);

/**
 * Attach a menu to a site
 */
export const attachMenuToSite = guardedCommand(
	'sites.write',
	attachMenuSchema,
	'menu.attached',
	async (data, db) => {
		const now = new Date().toISOString();

		// Check if attachment already exists for this site+region
		const existing = await db.menuSites
			.where({ 
				siteId: data.siteId, 
				region: data.region,
				deleted_at: { isNullish: true } 
			})
			.first();

		if (existing.success && existing.data) {
			// Update existing attachment to new menu
			const result = await db.menuSites
				.update({
					menuId: data.menuId,
					overrides: JSON.stringify(data.overrides || {}),
					status: true,
					updated_at: now
				})
				.where({ id: existing.data.id });

			if (!result.success) {
				error(500, 'Failed to update menu attachment');
			}

			return { id: existing.data.id, updated: true };
		}

		// Create new attachment
		const id = crypto.randomUUID();
		const result = await db.menuSites.insert({
			id,
			menuId: data.menuId,
			siteId: data.siteId,
			region: data.region,
			overrides: JSON.stringify(data.overrides || {}),
			status: true,
			created_at: now,
			updated_at: now
		});

		if (!result.success) {
			console.error('[attachMenuToSite] Failed to attach menu:', result.error);
			error(500, 'Failed to attach menu to site');
		}

		return { id, created: true };
	}
);

/**
 * Detach a menu from a site
 */
export const detachMenuFromSite = guardedCommand(
	'sites.write',
	detachMenuSchema,
	'menu.detached',
	async (data, db) => {
		const now = new Date().toISOString();

		const result = await db.menuSites
			.update({ deleted_at: now, updated_at: now })
			.where({ 
				menuId: data.menuId, 
				siteId: data.siteId,
				region: data.region
			});

		if (!result.success) {
			console.error('[detachMenuFromSite] Failed to detach menu:', result.error);
			error(500, 'Failed to detach menu from site');
		}

		return { detached: true };
	}
);

/**
 * Get navigation data for a site (resolved menus for header and footer)
 * This is what gets injected into the editor via siteMetadata
 */
export const getSiteNavigation = guardedQuery('sites.read', async (db) => {
	const { params } = getRequestEvent();
	const siteId = params.siteId || params.id;
	
	if (!siteId) {
		error(400, 'Site ID is required');
	}

	// Get all menu attachments for this site
	const attachments = await db.menuSites
		.where({ siteId, status: true, deleted_at: { isNullish: true } })
		.many();

	const result: {
		header: { visible: boolean; menuId?: string; items: NavigationItem[] };
		footer: { visible: boolean; menuId?: string; items: NavigationItem[] };
	} = {
		header: { visible: true, items: [] },
		footer: { visible: true, items: [] }
	};

	if (!attachments.success || !attachments.data?.length) {
		return result;
	}

	// Get menu IDs
	const menuIds = [...new Set(attachments.data.map((a: any) => a.menuId))];
	
	// Fetch all menus
	const menus = await db.menus
		.where({ deleted_at: { isNullish: true } })
		.many();

	if (!menus.success) {
		return result;
	}

	const menuMap = new Map(menus.data.map((m: any) => [m.id, transformDbMenu(m)]));

	// Build result
	for (const attachment of attachments.data) {
		const menu = menuMap.get(attachment.menuId);
		if (!menu) continue;

		const region = attachment.region as 'header' | 'footer';
		result[region] = {
			visible: true,
			menuId: menu.id,
			items: menu.items
		};
	}

	return result;
});
