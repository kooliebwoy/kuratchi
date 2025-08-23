export interface PullOptions {
  batchSize?: number;
  visibilityTimeoutMs?: number;
}

export interface AckOptions {
  acks?: Array<string | { lease_id: string }>;
  retries?: Array<{ lease_id: string; delay_seconds?: number }>;
}

export interface KuratchiQueuesPullHttpClientOptions {
  accountId: string;
  apiToken: string;
  queueId: string;
  endpointBase?: string; // defaults to Cloudflare v4 API base
}

/**
 * Minimal HTTP client for Cloudflare Queues Pull Consumers.
 * Uses the Cloudflare v4 REST API to pull messages and acknowledge/retry them.
 */
export class KuratchiQueuesPullHttpClient {
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly queueId: string;
  private readonly base: string;

  constructor(opts: KuratchiQueuesPullHttpClientOptions) {
    this.accountId = opts.accountId;
    this.apiToken = opts.apiToken;
    this.queueId = opts.queueId;
    this.base = (opts.endpointBase ?? 'https://api.cloudflare.com/client/v4').replace(/\/$/, '');
  }

  private authHeaders(): Record<string, string> {
    return {
      'content-type': 'application/json',
      'authorization': `Bearer ${this.apiToken}`,
    };
  }

  async pull(options: PullOptions = {}) {
    const url = `${this.base}/accounts/${this.accountId}/queues/${this.queueId}/messages/pull`;
    const body: any = {};
    if (typeof options.visibilityTimeoutMs === 'number') body.visibility_timeout_ms = options.visibilityTimeoutMs;
    if (typeof options.batchSize === 'number') body.batch_size = options.batchSize;

    const res = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Queues pull failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  async ack({ acks = [], retries = [] }: AckOptions) {
    const url = `${this.base}/accounts/${this.accountId}/queues/${this.queueId}/messages/ack`;
    const normAcks = acks.map((a) => (typeof a === 'string' ? { lease_id: a } : a));
    const body = { acks: normAcks, retries };

    const res = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Queues ack failed (${res.status}): ${text}`);
    }
    return res.json();
  }
}
