import type { RouteContext } from '@kuratchi/js';
import { jsonResponse, requirePlatformToken, handleCorsPreflight } from '$server/api/utils';
import { db } from '$server/api/db';
import { getSitePreviewUrl } from '$server/database/sites';

export async function GET(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;
  const result = await db.sites.where({ isActive: true, organizationId: auth.organizationId }).many();
  const sites = ((result.data ?? []) as any[]).map((site) => ({ ...site, previewUrl: getSitePreviewUrl(site) }));
  return jsonResponse({ success: true, data: sites });
}

export async function POST(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;
  const body = await ctx.request.json() as any;
  const form = new FormData();
  form.set('name', body.name || '');
  const { createSite } = await import('$server/database/sites');
  try {
    await createSite(form);
    const result = await db.sites.where({ name: body.name, isActive: true, organizationId: auth.organizationId }).first();
    const site = result.data ? { ...(result.data as any), previewUrl: getSitePreviewUrl(result.data as any) } : null;
    return jsonResponse({ success: true, data: site });
  } catch (e: any) {
    return jsonResponse({ success: false, error: e.message }, 400);
  }
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
