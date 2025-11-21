import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * API endpoint for Cloudflare HTTP validation
 * Site-renderer calls this to get the validation token for a hostname
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const { hostname } = params;
  
  if (!hostname) {
    return json({ error: 'hostname is required' }, { status: 400 });
  }

  try {
    // Access KV from locals
    const kv = (locals.kuratchi as any)?.kv?.default;
    if (!kv) {
      console.error('[CF Validation API] KV not available');
      return json({ error: 'KV not available' }, { status: 500 });
    }

    // Look up validation data from KV
    const kvKey = `cf-validation:${hostname}`;
    const validationData = await kv.get(kvKey, 'json');

    if (!validationData) {
      console.warn(`[CF Validation API] No validation data found for: ${hostname}`);
      return json({ error: 'Not found' }, { status: 404 });
    }

    // Return just the http_body that Cloudflare expects
    return new Response(validationData.http_body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  } catch (error) {
    console.error('[CF Validation API] Error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
