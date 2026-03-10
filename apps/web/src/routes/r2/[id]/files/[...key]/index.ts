import type { RouteContext } from '@kuratchi/js';
import { proxyR2ObjectDownload } from '$server/database/r2';

export async function GET(ctx: RouteContext): Promise<Response> {
  const bucketId = ctx.params.id || '';
  const key = ctx.params.key || '';
  if (!bucketId || !key) {
    return new Response('Not found', { status: 404 });
  }
  return proxyR2ObjectDownload(bucketId, key);
}
