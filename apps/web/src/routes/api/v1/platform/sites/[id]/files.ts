import type { RouteContext } from '@kuratchi/js';
import { jsonResponse, requirePlatformToken, handleCorsPreflight } from '$server/api/utils';
import { db } from '$server/api/db';

export async function POST(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;
  const siteId = ctx.params.id;

  // Verify ownership
  const site = await db.sites.where({ id: siteId, isActive: true, organizationId: auth.organizationId }).first();
  if (!site.data) return jsonResponse({ success: false, error: 'Site not found' }, 404);

  const contentType = ctx.request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return jsonResponse({ success: false, error: 'Content-Type must be multipart/form-data' }, 400);
  }

  const formData = await ctx.request.formData();
  formData.set('siteId', siteId);

  const { uploadSiteFilesForOrganization } = await import('$server/database/sites');
  try {
    await uploadSiteFilesForOrganization(formData, auth.organizationId);
    return jsonResponse({ success: true });
  } catch (e: any) {
    return jsonResponse({ success: false, error: e.message }, 400);
  }
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
