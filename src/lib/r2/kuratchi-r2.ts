import { CloudflareClient } from '../cloudflare.js';
import { DEFAULT_R2_WORKER_SCRIPT } from './worker-template.js';
import { KuratchiR2HttpClient } from './internal-http-client.js';

export interface R2Options {
  apiToken: string;
  accountId: string;
  endpointBase?: string;
  workersSubdomain: string;
}

export class KuratchiR2 {
  private cf: CloudflareClient;
  private workersSubdomain: string;

  constructor(config: R2Options) {
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

  async createBucket(name: string) {
    const resp = await this.cf.createR2Bucket(name);
    const bucket = (resp as any)?.result ?? resp;
    if (!bucket) throw new Error('Failed to create R2 bucket in Cloudflare');

    const apiToken = crypto.randomUUID();

    const bindings = [
      { type: 'r2_bucket', name: 'R2', bucket_name: name },
      { type: 'secret_text', name: 'API_KEY', text: apiToken },
    ];

    const scriptName = name;
    await this.cf.uploadWorkerModule(scriptName, DEFAULT_R2_WORKER_SCRIPT, bindings as any);
    await this.cf.enableWorkerSubdomain(scriptName);

    // Wait for Worker to be live
    await this.waitForWorkerEndpoint(scriptName, apiToken);

    return { bucket, apiToken };
  }

  async deleteBucket(name: string) {
    await this.cf.deleteR2Bucket(name);
  }

  getClient(cfg: { bucketName: string; apiToken: string }) {
    const client = new KuratchiR2HttpClient({
      bucketName: cfg.bucketName,
      workersSubdomain: this.workersSubdomain,
      apiToken: cfg.apiToken,
    });
    return client;
  }

  bucket(cfg: { bucketName: string; apiToken: string }) {
    const client = this.getClient(cfg);
    return {
      get: <T = unknown>(key: string, options?: { json?: boolean }) => client.get<T>(key, options),
      put: (key: string, value: string | object, options?: { httpMetadata?: any; customMetadata?: Record<string, string> | null; md5?: string }) => client.put(key, value, options),
      delete: (key: string) => client.delete(key),
      list: (options?: { prefix?: string; limit?: number; cursor?: string; delimiter?: string }) => client.list(options),
      getClient: () => client,
    };
  }

  private async waitForWorkerEndpoint(bucketName: string, apiToken: string) {
    const client = this.getClient({ bucketName, apiToken });
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
    return { bucket: '[api]' } as any;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toJSON();
  }
}
