import { CloudflareClient } from '../cloudflare.js';
import { DEFAULT_QUEUES_PRODUCER_WORKER_SCRIPT } from './worker-template.js';
import { KuratchiQueuesHttpClient } from './internal-http-client.js';
import { KuratchiQueuesPullHttpClient } from './pull-http-client.js';

export interface QueuesOptions {
  apiToken: string;
  accountId: string;
  endpointBase?: string;
  workersSubdomain: string;
}

export class KuratchiQueues {
  private cf: CloudflareClient;
  private workersSubdomain: string;
  private accountId: string;
  private apiToken: string;
  private endpointBase?: string;

  constructor(config: QueuesOptions) {
    this.cf = new CloudflareClient({
      apiToken: config.apiToken,
      accountId: config.accountId,
      endpointBase: config.endpointBase,
    });
    this.workersSubdomain = config.workersSubdomain;
    this.accountId = config.accountId;
    this.apiToken = config.apiToken;
    this.endpointBase = config.endpointBase;
    try {
      Object.defineProperty(this, 'cf', { enumerable: false, configurable: false, writable: true });
    } catch {}
  }

  async createQueue(name: string) {
    const resp = await this.cf.createQueue(name);
    const queue = (resp as any)?.result ?? resp;
    if (!queue) throw new Error('Failed to create Queue in Cloudflare');

    const apiToken = crypto.randomUUID();

    const bindings = [
      { type: 'queue', name: 'QUEUE', queue_name: name },
      { type: 'secret_text', name: 'API_KEY', text: apiToken },
    ];

    const scriptName = name;
    await this.cf.uploadWorkerModule(scriptName, DEFAULT_QUEUES_PRODUCER_WORKER_SCRIPT, bindings as any);
    await this.cf.enableWorkerSubdomain(scriptName);

    await this.waitForWorkerEndpoint(scriptName, apiToken);

    return { queue, apiToken };
  }

  async deleteQueue(idOrName: string) {
    await this.cf.deleteQueue(idOrName);
  }

  getClient(cfg: { queueName: string; apiToken: string }) {
    const client = new KuratchiQueuesHttpClient({
      queueName: cfg.queueName,
      workersSubdomain: this.workersSubdomain,
      apiToken: cfg.apiToken,
    });
    return client;
  }

  queue(cfg: { queueName: string; apiToken: string }) {
    const client = this.getClient(cfg);
    return {
      send: (body: any, options?: { contentType?: string; delaySeconds?: number }) => client.send(body, options),
      sendBatch: (messages: Array<{ body: any; contentType?: string; delaySeconds?: number }>) => client.sendBatch(messages),
      health: () => client.health(),
      getClient: () => client,
    };
  }

  getPullClient(cfg: { queueId: string }) {
    const client = new KuratchiQueuesPullHttpClient({
      accountId: this.accountId,
      apiToken: this.apiToken,
      queueId: cfg.queueId,
      endpointBase: this.endpointBase,
    });
    return client;
  }

  pull(cfg: { queueId: string }) {
    const client = this.getPullClient(cfg);
    return {
      pull: (options?: { batchSize?: number; visibilityTimeoutMs?: number }) => client.pull(options),
      ack: (options: { acks?: Array<string | { lease_id: string }>; retries?: Array<{ lease_id: string; delay_seconds?: number }> }) => client.ack(options),
      getClient: () => client,
    };
  }

  private async waitForWorkerEndpoint(queueName: string, apiToken: string) {
    const client = this.getClient({ queueName, apiToken });
    const deadline = Date.now() + 30_000;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    while (true) {
      try {
        const res: any = await client.health();
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
    return { queues: '[api]' } as any;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toJSON();
  }
}
