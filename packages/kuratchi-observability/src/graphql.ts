export interface CloudflareGraphQLErrorLocation {
  line: number;
  column: number;
}

export interface CloudflareGraphQLError {
  message: string;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
  locations?: CloudflareGraphQLErrorLocation[];
}

export interface CloudflareGraphQLResponse<TData> {
  data?: TData;
  errors?: CloudflareGraphQLError[];
}

export interface CloudflareGraphQLRequest<TVariables extends Record<string, unknown>> {
  query: string;
  variables: TVariables;
}

export interface CloudflareObservabilityClientOptions {
  accountTag: string;
  apiToken?: string;
  apiKey?: string;
  email?: string;
  endpoint?: string;
  fetch?: typeof fetch;
}

function getBoundFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) {
    return ((input: RequestInfo | URL, init?: RequestInit) => fetchImpl(input, init)) as typeof fetch;
  }

  return ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init)) as typeof fetch;
}

export class CloudflareObservabilityError extends Error {
  readonly errors?: CloudflareGraphQLError[];
  readonly status?: number;

  constructor(message: string, options: { errors?: CloudflareGraphQLError[]; status?: number } = {}) {
    super(message);
    this.name = 'CloudflareObservabilityError';
    this.errors = options.errors;
    this.status = options.status;
  }
}

export class CloudflareGraphQLClient {
  readonly accountTag: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly apiToken?: string;
  private readonly apiKey?: string;
  private readonly email?: string;

  constructor(options: CloudflareObservabilityClientOptions) {
    this.accountTag = options.accountTag;
    this.apiToken = options.apiToken;
    this.apiKey = options.apiKey;
    this.email = options.email;
    this.endpoint = options.endpoint ?? 'https://api.cloudflare.com/client/v4/graphql';
    this.fetchImpl = getBoundFetch(options.fetch);

    if (!this.apiToken && !(this.apiKey && this.email)) {
      throw new CloudflareObservabilityError('Cloudflare observability requires either apiToken or apiKey + email.');
    }
  }

  async query<TData, TVariables extends Record<string, unknown>>(request: CloudflareGraphQLRequest<TVariables>): Promise<TData> {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: this.createHeaders(),
      body: JSON.stringify(request),
    });

    const payload = await response.json() as CloudflareGraphQLResponse<TData>;

    if (!response.ok) {
      throw new CloudflareObservabilityError(
        payload.errors?.[0]?.message ?? `Cloudflare GraphQL request failed with status ${response.status}.`,
        { errors: payload.errors, status: response.status },
      );
    }

    if (payload.errors?.length) {
      throw new CloudflareObservabilityError(payload.errors[0].message, { errors: payload.errors, status: response.status });
    }

    if (!payload.data) {
      throw new CloudflareObservabilityError('Cloudflare GraphQL response did not include data.', { status: response.status });
    }

    return payload.data;
  }

  private createHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiToken) {
      headers.Authorization = `Bearer ${this.apiToken}`;
      return headers;
    }

    headers['X-AUTH-EMAIL'] = this.email!;
    headers['X-AUTH-KEY'] = this.apiKey!;
    return headers;
  }
}
