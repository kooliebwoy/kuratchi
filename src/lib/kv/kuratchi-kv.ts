import { CloudflareClient } from '../cloudflare.js';
import { DEFAULT_KV_WORKER_SCRIPT } from './worker-template.js';
import { KuratchiKVHttpClient } from './internal-http-client.js';

export interface KVOptions {
  apiToken: string;
  accountId: string;
  endpointBase?: string;
  workersSubdomain: string;
}

export class KuratchiKV {
  private cf: CloudflareClient;
  private workersSubdomain: string;

  constructor(config: KVOptions) {
    this.cf = new CloudflareClient({
      apiToken: config.apiToken,
      accountId: config.accountId,
      endpointBase: config.endpointBase,
    });
    this.workersSubdomain = config.workersSubdomain;
    try {
      Object.defineProperty(this, 'cf', { enumerable: false, configurable: false, writable: true });
    } catch {}
  }

  async createNamespace(title: string) {
    const nsResp = await this.cf.createKVNamespace(title);
    const namespace = (nsResp as any)?.result ?? nsResp;
    if (!namespace || !namespace.id) {
      throw new Error('Failed to create KV namespace in Cloudflare');
    }

    const apiToken = crypto.randomUUID();

    const bindings = [
      { type: 'kv_namespace', name: 'KV', namespace_id: namespace.id },
      { type: 'secret_text', name: 'API_KEY', text: apiToken },
    ];

    const scriptName = namespace.title || title;
    await this.cf.uploadWorkerModule(scriptName, DEFAULT_KV_WORKER_SCRIPT, bindings as any);
    await this.cf.enableWorkerSubdomain(scriptName);

    // Wait for Worker to be live
    await this.waitForWorkerEndpoint(scriptName, apiToken);

    return { namespace, apiToken };
  }

  async deleteNamespace(namespaceId: string) {
    await this.cf.deleteKVNamespace(namespaceId);
  }

  getClient(cfg: { namespaceName: string; apiToken: string }) {
    const client = new KuratchiKVHttpClient({
      namespaceName: cfg.namespaceName,
      workersSubdomain: this.workersSubdomain,
      apiToken: cfg.apiToken,
    });
    return client;
  }

  namespace(cfg: { namespaceName: string; apiToken: string }) {
    const client = this.getClient(cfg);
    return {
      get: <T = unknown>(key: string, options?: { json?: boolean; cacheTtl?: number }) => client.get<T>(key, options),
      put: (key: string, value: string | object, options?: { expiration?: number; expirationTtl?: number; metadata?: any }) => client.put(key, value, options),
      delete: (key: string) => client.delete(key),
      list: (options?: { prefix?: string; limit?: number; cursor?: string }) => client.list(options),
      getClient: () => client,
    };
  }

  private async waitForWorkerEndpoint(namespaceName: string, apiToken: string) {
    const client = this.getClient({ namespaceName, apiToken });
    const deadline = Date.now() + 30_000;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    while (true) {
      try {
        const res: any = await client.list({ limit: 1 });
        if (!res || res.success === false) {
          if (Date.now() > deadline) break;
          await sleep(500);
          continue;
        }
        return true;
      } catch {
        if (Date.now() > deadline) break;
        await sleep(500);
      }
    }
    return false;
  }

  toJSON() {
    return { namespace: '[api]' } as any;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toJSON();
  }
}
