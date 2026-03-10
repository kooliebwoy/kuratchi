import type { RouteContext } from '@kuratchi/js';
import { jsonResponse, requirePlatformToken, handleCorsPreflight } from '$server/api/utils';
import { db } from '$server/api/db';

export async function GET(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;
  const result = await db.kvNamespaces.where({ isActive: true, organizationId: auth.organizationId }).many();
  return jsonResponse({ success: true, data: result.data ?? [] });
}

export async function POST(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;
  const body = await ctx.request.json() as any;
  const form = new FormData();
  form.set('name', body.name || '');
  const { createKvNamespace } = await import('$server/database/kv');
  try {
    await createKvNamespace(form);
    const result = await db.kvNamespaces.where({ name: body.name, isActive: true, organizationId: auth.organizationId }).first();
    return jsonResponse({ success: true, data: result.data });
  } catch (e: any) {
    return jsonResponse({ success: false, error: e.message }, 400);
  }
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
