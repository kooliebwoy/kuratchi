import { env } from '$env/dynamic/private';

/**
 * Cloudflare custom hostname HTTP validation endpoint
 * https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/hostname-validation/pre-validation/
 * 
 * This endpoint proxies the request to the dashboard API which has KV access
 */
export const GET = async ({ params, request }: any) => {
  const { token } = params;
  const hostname = request.headers.get('host') || '';

  console.log(`[CF Validation] Request for token: ${token}, hostname: ${hostname}`);

  try {
    // Call dashboard API to get validation token
    const dashboardUrl = env.DASHBOARD_API_URL || 'http://localhost:5173';
    const validationUrl = `${dashboardUrl}/api/cf-validation/${encodeURIComponent(hostname)}`;
    
    console.log(`[CF Validation] Fetching from: ${validationUrl}`);
    
    const response = await fetch(validationUrl);
    
    if (!response.ok) {
      console.warn(`[CF Validation] Dashboard returned ${response.status} for ${hostname}`);
      return new Response('Not found', { status: 404 });
    }

    const validationBody = await response.text();
    
    // Return the validation body as plain text
    console.log(`[CF Validation] ✓ Returning validation for ${hostname}`);
    return new Response(validationBody, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  } catch (error) {
    console.error('[CF Validation] Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
