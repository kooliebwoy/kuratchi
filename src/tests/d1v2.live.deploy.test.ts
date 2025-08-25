// minimal Node typings shim for CI without @types/node
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;
import { describe, it, expect } from 'vitest';
import { env } from '$env/dynamic/private';
import { KuratchiD1v2 } from '../lib/d1v2/kuratchi-d1v2.js';
import { CloudflareClient } from '../lib/cloudflare.js';

// Allow dynamic env via SvelteKit (process.env) with multiple naming schemes.
const LIVE = env.LIVE_CLOUDFLARE === '1' || env.KURATCHI_LIVE === '1';
const CF_API_TOKEN = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN || env.KURATCHI_CF_API_TOKEN;
const CF_ACCOUNT_ID = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || env.KURATCHI_CF_ACCOUNT_ID;
const CF_WORKERS_SUBDOMAIN = env.CF_WORKERS_SUBDOMAIN || env.CLOUDFLARE_WORKERS_SUBDOMAIN || env.KURATCHI_CF_WORKERS_SUBDOMAIN;
// For convenience in tests, we hardcode the router worker script name
const SCRIPT_NAME = 'kuratchi-d1v2-live';

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

(shouldRun ? describe : describe.skip)('D1v2 live deploy (real Cloudflare)', () => {
  it('deploys router worker, creates 3 DBs, patches bindings, migrates, and routes queries correctly', async () => {
    const svc = new KuratchiD1v2({
      apiToken: CF_API_TOKEN!,
      accountId: CF_ACCOUNT_ID!,
      workersSubdomain: CF_WORKERS_SUBDOMAIN!,
      scriptName: SCRIPT_NAME!
    });

    const cf = new CloudflareClient({ apiToken: CF_API_TOKEN!, accountId: CF_ACCOUNT_ID! });

    // Create 3 databases
    const base = `live_${Date.now()}`;
    const dbNames = [1, 2, 3].map((i) => `${base}_${i}`);

    const created: { name: string; token: string; uuid: string }[] = [];
    for (const name of dbNames) {
      const { database, token } = await svc.createDatabase({ databaseName: name, gatewayKey: GATEWAY_KEY!, deferBinding: true });
      created.push({ name, token, uuid: (database as any)?.uuid });
      // eslint-disable-next-line no-console
      console.log('[LIVE] Created DB', name, 'uuid=', (database as any)?.uuid);
    }

    // Bulk deploy router with all bindings in one shot
    await svc.deployRouterWithBindings(GATEWAY_KEY!, created.map((c) => ({ name: c.name, uuid: c.uuid })));

    // Skip introspecting bindings as the public API may not return them consistently for module uploads.
    // Functional verification below ensures routing works per-DB.

    // For each DB: create a table, insert a distinct value, and read it back
    for (const { name, token } of created) {
      const db = svc.database({ databaseName: name, dbToken: token, gatewayKey: GATEWAY_KEY! });

      // Poll readiness
      // eslint-disable-next-line no-console
      console.log('[LIVE] Waiting for router readiness for', name);
      const deadline = Date.now() + 120_000;
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let ok = false;
      let lastErr: any = null;
      while (Date.now() < deadline) {
        const ping = await db.query('SELECT 1 as up');
        if (ping.success) { ok = true; break; }
        lastErr = ping.error;
        await sleep(1500);
      }
      if (!ok) {
        // eslint-disable-next-line no-console
        console.error('[LIVE] Router readiness failed for', name, 'last error:', lastErr);
      }
      expect(ok).toBe(true);

      // Create table and insert unique value = db name
      await db.query('CREATE TABLE IF NOT EXISTS t (k TEXT PRIMARY KEY, v TEXT)');
      await db.query('INSERT OR REPLACE INTO t (k, v) VALUES (?, ?)', ['key', name]);
      const row: any = await db.query('SELECT v FROM t WHERE k = ?', ['key']);
      const val = row?.results?.[0]?.v ?? row?.data?.[0]?.v;
      // eslint-disable-next-line no-console
      console.log(`[LIVE] Queried ${name} ->`, val);
      expect(val).toBe(name);
    }
  }, 180_000);
});
