// minimal Node typings shim for CI without @types/node
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;
import { describe, it, expect } from 'vitest';
import { KuratchiDatabase } from '../lib/database/kuratchi-database.js';
import { adminSchemaDsl } from '../lib/schema/admin.example.js';
import { env } from '$env/dynamic/private';

// Allow dynamic env via SvelteKit (process.env) with multiple naming schemes.
const LIVE = env.LIVE_CLOUDFLARE === '1' || env.KURATCHI_LIVE === '1';
const CF_API_TOKEN = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN || env.KURATCHI_CF_API_TOKEN;
const CF_ACCOUNT_ID = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || env.KURATCHI_CF_ACCOUNT_ID;
const CF_WORKERS_SUBDOMAIN = env.CF_WORKERS_SUBDOMAIN || env.CLOUDFLARE_WORKERS_SUBDOMAIN || env.KURATCHI_CF_WORKERS_SUBDOMAIN;
const SCRIPT_NAME = env.SCRIPT_NAME || env.KURATCHI_DO_SCRIPT_NAME || 'kuratchi-do-live';

// Generate a random gateway key if none provided
const GATEWAY_KEY = env.GATEWAY_KEY || env.KURATCHI_GATEWAY_KEY || (() => {
  const rnd = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(rnd).map((b) => b.toString(16).padStart(2, '0')).join('');
})();

const shouldRun = LIVE && CF_API_TOKEN && CF_ACCOUNT_ID && CF_WORKERS_SUBDOMAIN;

if (!shouldRun) {
  // eslint-disable-next-line no-console
  console.warn('[LIVE][SKIP] Set LIVE_CLOUDFLARE=1 and provide: CF_API_TOKEN, CF_ACCOUNT_ID, CF_WORKERS_SUBDOMAIN. Optional: SCRIPT_NAME, GATEWAY_KEY');
  // eslint-disable-next-line no-console
  console.warn('[LIVE][SKIP] Detected:', {
    LIVE,
    CF_API_TOKEN: !!CF_API_TOKEN,
    CF_ACCOUNT_ID: !!CF_ACCOUNT_ID,
    CF_WORKERS_SUBDOMAIN: !!CF_WORKERS_SUBDOMAIN,
    SCRIPT_NAME,
    GATEWAY_KEY: !!(env.GATEWAY_KEY || env.KURATCHI_GATEWAY_KEY)
  });
}

(shouldRun ? describe : describe.skip)('DO live deploy (real Cloudflare)', () => {
  it('deploys the worker, creates a db token, and responds to a query', async () => {
    const doSvc = new KuratchiDatabase({
      apiToken: CF_API_TOKEN!,
      accountId: CF_ACCOUNT_ID!,
      workersSubdomain: CF_WORKERS_SUBDOMAIN!,
      scriptName: SCRIPT_NAME!
    });

    const databaseName = `live_${Date.now()}`;
    // Use the shared admin schema DSL
    const schema = adminSchemaDsl;
    const { token } = await doSvc.createDatabase({ databaseName, gatewayKey: GATEWAY_KEY!, migrate: true, schema });

    // Log the expected Worker URL so you can check the dashboard
    const url = `https://${SCRIPT_NAME}.${CF_WORKERS_SUBDOMAIN}`;
    // eslint-disable-next-line no-console
    console.log(`[LIVE] Worker URL: ${url}`);
    // eslint-disable-next-line no-console
    console.log(`[LIVE] Database Name: ${databaseName}`);
    // eslint-disable-next-line no-console
    console.log(`[LIVE] Gateway Key: ${GATEWAY_KEY}`);

    const db = await doSvc.database({ databaseName, dbToken: token, gatewayKey: GATEWAY_KEY!, schema });
    
    // Poll for worker readiness before testing queries
    // eslint-disable-next-line no-console
    console.log('[LIVE] Waiting for worker to become ready...');
    
    const deadline = Date.now() + 30_000; // 30s max wait
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    
    let res;
    while (Date.now() < deadline) {
      // Use a lightweight ORM call on an existing table to check readiness
      res = await db.users.count();
      if (res && res.success) {
        // eslint-disable-next-line no-console
        console.log('[LIVE] Worker is ready!');
        break;
      }
      // eslint-disable-next-line no-console
      console.log(`[LIVE] Worker not ready yet, retrying... (${res?.error?.slice(0, 100)})`);
      await sleep(2000); // Wait 2s between attempts
    }

    // Debug the final response
    // eslint-disable-next-line no-console
    console.log('[LIVE] Final Query Response:', JSON.stringify(res, null, 2));

    expect(res!.success).toBe(true);
  }, 120_000);
});
