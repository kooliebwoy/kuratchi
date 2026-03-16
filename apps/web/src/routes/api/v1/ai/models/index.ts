import type { RouteContext } from '@kuratchi/js';
import { handleCorsPreflight, jsonResponse, requirePlatformToken } from '$server/api/utils';
import { DEFAULT_KURATCHI_AI_MODEL, KURATCHI_AI_MODELS } from '$server/ai/models';

export async function GET(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;

  return jsonResponse({
    success: true,
    data: {
      defaultModel: DEFAULT_KURATCHI_AI_MODEL,
      models: KURATCHI_AI_MODELS,
    },
  });
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
