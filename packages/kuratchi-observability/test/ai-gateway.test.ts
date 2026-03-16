import { describe, expect, test } from 'bun:test';

import { createCloudflareObservability } from '../src/index.js';

describe('AI Gateway observability', () => {
  test('queries AI gateway usage with bearer auth and maps totals', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({
        data: {
          viewer: {
            accounts: [
              {
                aiGatewayRequestsAdaptiveGroups: [
                  {
                    count: 8,
                    sum: {
                      cachedRequests: 2,
                      erroredRequests: 1,
                      uncachedTokensIn: 1000,
                      uncachedTokensOut: 250,
                      cachedTokensIn: 200,
                      cachedTokensOut: 50,
                      cost: 0.42,
                    },
                    dimensions: {
                      datetimeHour: '2026-03-11T14:00:00.000Z',
                      gateway: 'kuratchi-gateway',
                    },
                  },
                ],
              },
            ],
          },
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const client = createCloudflareObservability({
      accountTag: 'acct-1',
      apiToken: 'token-1',
      fetch: fetchMock,
    });

    const result = await client.aiGateway().timeseries({
      since: '2026-03-10',
      until: '2026-03-11',
      gateway: 'kuratchi-gateway',
      limit: 24,
      metadataFilters: {
        organizationId: 'org-123',
        product: 'drover',
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.cloudflare.com/client/v4/graphql');

    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-1');

    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.query).toContain('aiGatewayRequestsAdaptiveGroups');
    expect(body.variables.accountTag).toBe('acct-1');
    expect(body.variables.filter.gateway).toBe('kuratchi-gateway');
    expect(body.variables.filter.AND).toEqual([
      { metadataKeys_has: 'organizationId' },
      { metadataValues_has: 'org-123' },
      { metadataKeys_has: 'product' },
      { metadataValues_has: 'drover' },
    ]);

    expect(result.totals).toEqual({
      requests: 8,
      cachedRequests: 2,
      erroredRequests: 1,
      inputTokens: 1200,
      outputTokens: 300,
      cost: 0.42,
    });

    expect(result.points[0]).toEqual({
      timestamp: '2026-03-11T14:00:00.000Z',
      gateway: 'kuratchi-gateway',
      requests: 8,
      cachedRequests: 2,
      erroredRequests: 1,
      inputTokens: 1200,
      outputTokens: 300,
      cost: 0.42,
    });
  });
});
