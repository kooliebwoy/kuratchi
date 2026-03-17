import type { RouteContext } from '@kuratchi/js';
import { jsonResponse, requirePlatformToken, handleCorsPreflight } from '$server/api/utils';
import { db } from '$server/api/db';

export async function GET(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;
  const siteId = ctx.params.id;
  const result = await db.sites.where({ id: siteId, isActive: true, organizationId: auth.organizationId }).first();
  if (!result.data) return jsonResponse({ success: false, error: 'Site not found' }, 404);
  const files = await db.siteFiles.where({ siteId }).many();
  return jsonResponse({ success: true, data: { ...(result.data as any), files: files.data ?? [] } });
}

export async function DELETE(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;
  const siteId = ctx.params.id;
  const form = new FormData();
  form.set('id', siteId);
  const { deleteSite } = await import('$server/database/sites');
  try {
    await deleteSite(form);
    return jsonResponse({ success: true });
  } catch (e: any) {
    return jsonResponse({ success: false, error: e.message }, 400);
  }
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
