export interface QueuesHttpClientConfig {
  queueName: string;
  workersSubdomain: string; // e.g. example.workers.dev
  apiToken: string; // Bearer used to authorize HTTP calls to the producer worker
}

export interface SendOptions {
  contentType?: string;
  delaySeconds?: number;
}

export interface SendBatchMessage extends SendOptions {
  body: any;
}

export interface SendResponse { success: boolean; error?: string }
export interface SendBatchResponse { success: boolean; count?: number; error?: string }
export interface HealthResponse { success: boolean; ok: boolean; error?: string }

export class KuratchiQueuesHttpClient {
  private baseUrl: string;
  private token: string;

  constructor(cfg: QueuesHttpClientConfig) {
    this.baseUrl = `https://${cfg.queueName}.${cfg.workersSubdomain}`;
    this.token = cfg.apiToken;
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
    } as Record<string, string>;
  }

  private async handle<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const ct = res.headers.get('content-type') || '';
      const raw = ct.includes('application/json') ? await res.json().catch(() => undefined) : await res.text();
      return { success: false, error: typeof raw === 'string' ? raw : JSON.stringify(raw) } as any;
    }
    const ct = res.headers.get('content-type') || '';
    return (ct.includes('application/json') ? res.json() : (await res.text())) as T;
  }

  async send(body: any, options?: SendOptions): Promise<SendResponse> {
    const res = await fetch(`${this.baseUrl}/api/send`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ body, ...(options || {}) }),
    });
    return this.handle<SendResponse>(res);
  }

  async sendBatch(messages: SendBatchMessage[]): Promise<SendBatchResponse> {
    const res = await fetch(`${this.baseUrl}/api/send-batch`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ messages }),
    });
    return this.handle<SendBatchResponse>(res);
  }

  async health(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/api/health`, {
      method: 'GET',
      headers: this.headers(),
    });
    return this.handle<HealthResponse>(res);
  }
}
