import type { RouteContext } from '@kuratchi/js';
import { jsonResponse, requirePlatformToken, handleCorsPreflight } from '$server/api/utils';
import { db } from '$server/api/db';

export async function POST(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;
  const orgId = auth.organizationId;

  const body = await ctx.request.json() as any;
  const type = body.type; // 'database' | 'kv' | 'r2'

  if (type === 'database') {
    const check = await db.databases.where({ id: body.databaseId, organizationId: orgId }).first();
    if (!check.data) return jsonResponse({ error: 'Database not found' }, 404);
    const form = new FormData();
    form.set('name', body.name || '');
    form.set('databaseId', body.databaseId || '');
    const { createDbToken } = await import('$server/database/tokens');
    try {
      await createDbToken(form);
      return jsonResponse({ success: true });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message }, 400);
    }
  }

  if (type === 'kv') {
    const check = await db.kvNamespaces.where({ id: body.kvNamespaceId, organizationId: orgId }).first();
    if (!check.data) return jsonResponse({ error: 'KV namespace not found' }, 404);
    const form = new FormData();
    form.set('name', body.name || '');
    form.set('kvNamespaceId', body.kvNamespaceId || '');
    const { createKvToken } = await import('$server/database/tokens');
    try {
      await createKvToken(form);
      return jsonResponse({ success: true });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message }, 400);
    }
  }

  if (type === 'r2') {
    const check = await db.r2Buckets.where({ id: body.r2BucketId, organizationId: orgId }).first();
    if (!check.data) return jsonResponse({ error: 'R2 bucket not found' }, 404);
    const form = new FormData();
    form.set('name', body.name || '');
    form.set('r2BucketId', body.r2BucketId || '');
    const { createR2Token } = await import('$server/database/tokens');
    try {
      await createR2Token(form);
      return jsonResponse({ success: true });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message }, 400);
    }
  }

  return jsonResponse({ error: 'Invalid token type. Use "database", "kv", or "r2"' }, 400);
}

export async function DELETE(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;

  const body = await ctx.request.json() as any;
  const tokenId = body.tokenId;
  if (!tokenId) return jsonResponse({ error: 'tokenId required' }, 400);

  const { revokeDbToken, revokeKvToken, revokeR2Token } = await import('$server/database/tokens');
  const form = new FormData();
  form.set('tokenId', tokenId);
  form.set('databaseId', '');
  form.set('kvNamespaceId', '');
  form.set('r2BucketId', '');
  try {
    await Promise.allSettled([
      revokeDbToken(form),
      revokeKvToken(form),
      revokeR2Token(form),
    ]);
    return jsonResponse({ success: true });
  } catch (e: any) {
    return jsonResponse({ success: false, error: e.message }, 400);
  }
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
