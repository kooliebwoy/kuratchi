import { describe, expect, test } from 'bun:test';

import { CloudflareObservabilityError, createCloudflareObservability } from '../src/index.js';

describe('createCloudflareObservability', () => {
  test('queries daily D1 analytics with bearer auth', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({
        data: {
          viewer: {
            accounts: [
              {
                d1AnalyticsAdaptiveGroups: [
                  {
                    sum: {
                      readQueries: 12,
                      writeQueries: 3,
                      rowsRead: 120,
                      rowsWritten: 8,
                      queryBatchResponseBytes: 4096,
                      queryBatchTimeMs: 240,
                    },
                    avg: {
                      queryBatchTimeMs: 20,
                    },
                    quantiles: {
                      queryBatchTimeMsP90: 35,
                    },
                    dimensions: {
                      date: '2026-03-08',
                      databaseId: 'db-123',
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

    const result = await client.d1('db-123').timeseries({
      since: '2026-03-01',
      until: '2026-03-08',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer token-1');

    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.variables.accountTag).toBe('acct-1');
    expect(body.variables.databaseId).toBe('db-123');
    expect(body.query).toContain('d1AnalyticsAdaptiveGroups');

    expect(result.points[0]).toEqual({
      date: '2026-03-08',
      databaseId: 'db-123',
      readQueries: 12,
      writeQueries: 3,
      rowsRead: 120,
      rowsWritten: 8,
      queryBatchResponseBytes: 4096,
      queryBatchTimeMs: 240,
      avgQueryBatchTimeMs: 20,
      p90QueryBatchTimeMs: 35,
    });
  });

  test('queries D1 insights with Cloudflare API key auth', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({
        data: {
          viewer: {
            accounts: [
              {
                d1QueriesAdaptiveGroups: [
                  {
                    count: 4,
                    sum: {
                      rowsRead: 200,
                      rowsWritten: 0,
                      queryBatchTimeMs: 80,
                    },
                    avg: {
                      rowsRead: 50,
                      rowsWritten: 0,
                      queryBatchTimeMs: 20,
                    },
                    dimensions: {
                      query: 'SELECT * FROM users',
                      databaseId: 'db-123',
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
      apiKey: 'key-1',
      email: 'dev@example.com',
      fetch: fetchMock,
    });

    const result = await client.d1('db-123').insights({
      since: '2026-03-01',
      until: '2026-03-08',
      sortBy: 'reads',
      sortType: 'avg',
      sortDirection: 'ASC',
      limit: 5,
    });

    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers['X-AUTH-EMAIL']).toBe('dev@example.com');
    expect(headers['X-AUTH-KEY']).toBe('key-1');

    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.query).toContain('d1QueriesAdaptiveGroups');
    expect(body.variables.orderBy).toEqual(['avg_rowsRead_ASC']);

    expect(result.queries[0]).toEqual({
      query: 'SELECT * FROM users',
      databaseId: 'db-123',
      count: 4,
      totalRowsRead: 200,
      totalRowsWritten: 0,
      totalDurationMs: 80,
      avgRowsRead: 50,
      avgRowsWritten: 0,
      avgDurationMs: 20,
    });
  });

  test('throws on GraphQL errors', async () => {
    const fetchMock: typeof fetch = async () => new Response(JSON.stringify({
      errors: [{ message: 'Unauthorized' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const client = createCloudflareObservability({
      accountTag: 'acct-1',
      apiToken: 'token-1',
      fetch: fetchMock,
    });

    await expect(client.d1('db-123').storage({ since: '2026-03-01', until: '2026-03-08' })).rejects.toBeInstanceOf(CloudflareObservabilityError);
  });
});
