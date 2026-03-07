import type { RouteContext } from '@kuratchi/js';
import { jsonResponse, requirePlatformToken, handleCorsPreflight } from '$server/api/utils';
import { db } from '$server/api/db';

export async function GET(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;
  const result = await db.kvNamespaces.where({ id: ctx.params.id, isActive: true, organizationId: auth.organizationId }).first();
  if (!result.data) return jsonResponse({ error: 'KV namespace not found' }, 404);
  return jsonResponse({ success: true, data: result.data });
}

export async function DELETE(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;
  const check = await db.kvNamespaces.where({ id: ctx.params.id, organizationId: auth.organizationId }).first();
  if (!check.data) return jsonResponse({ error: 'KV namespace not found' }, 404);
  const form = new FormData();
  form.set('id', ctx.params.id);
  const { deleteKvNamespace } = await import('$server/database/kv');
  try {
    await deleteKvNamespace(form);
    return jsonResponse({ success: true });
  } catch (e: any) {
    return jsonResponse({ success: false, error: e.message }, 400);
  }
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
