import type { RouteContext } from '@kuratchi/js';
import { jsonResponse, requirePlatformToken, handleCorsPreflight } from '$server/api/utils';
import { db } from '$server/api/db';

export async function POST(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;

  const siteId = ctx.params.id;
  const domainId = ctx.params.domainId;
  const site = await db.sites.where({ id: siteId, isActive: true, organizationId: auth.organizationId }).first();
  if (!site.data) return jsonResponse({ success: false, error: 'Site not found' }, 404);

  const { refreshSiteCustomDomainForOrganization } = await import('$server/database/sites');
  try {
    const domain = await refreshSiteCustomDomainForOrganization(siteId, domainId, auth.organizationId);
    return jsonResponse({ success: true, data: domain });
  } catch (e: any) {
    return jsonResponse({ success: false, error: e.message }, 400);
  }
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
