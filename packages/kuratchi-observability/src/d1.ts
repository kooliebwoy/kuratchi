import { AiGatewayObservabilityClient } from './ai-gateway.js';
import { CloudflareGraphQLClient, type CloudflareObservabilityClientOptions } from './graphql.js';

export interface D1DateRangeInput {
  since: string | Date;
  until: string | Date;
}

export interface D1TimeseriesOptions extends D1DateRangeInput {
  limit?: number;
}

export interface D1StorageOptions extends D1DateRangeInput {
  limit?: number;
}

export type D1InsightsSortBy = 'time' | 'reads' | 'writes' | 'count';
export type D1InsightsSortDirection = 'ASC' | 'DESC';
export type D1InsightsSortType = 'sum' | 'avg';

export interface D1InsightsOptions extends D1DateRangeInput {
  limit?: number;
  sortBy?: D1InsightsSortBy;
  sortDirection?: D1InsightsSortDirection;
  sortType?: D1InsightsSortType;
}

export interface D1OverviewOptions extends D1DateRangeInput {
  analyticsLimit?: number;
  storageLimit?: number;
  topN?: number;
  sortBy?: D1InsightsSortBy;
  sortDirection?: D1InsightsSortDirection;
  sortType?: D1InsightsSortType;
}

export interface D1AnalyticsPoint {
  date: string;
  databaseId?: string;
  readQueries: number;
  writeQueries: number;
  rowsRead: number;
  rowsWritten: number;
  queryBatchResponseBytes: number;
  queryBatchTimeMs: number;
  avgQueryBatchTimeMs?: number;
  p90QueryBatchTimeMs?: number;
}

export interface D1AnalyticsResult {
  databaseId: string;
  since: string;
  until: string;
  points: D1AnalyticsPoint[];
}

export interface D1StoragePoint {
  date: string;
  databaseId?: string;
  databaseSizeBytes: number;
}

export interface D1StorageResult {
  databaseId: string;
  since: string;
  until: string;
  points: D1StoragePoint[];
}

export interface D1InsightQuery {
  query: string;
  databaseId?: string;
  count: number;
  totalRowsRead: number;
  totalRowsWritten: number;
  totalDurationMs: number;
  avgRowsRead?: number;
  avgRowsWritten?: number;
  avgDurationMs?: number;
  p50DurationMs?: number;
  p95DurationMs?: number;
}

export interface D1InsightsResult {
  databaseId: string;
  since: string;
  until: string;
  sortBy: D1InsightsSortBy;
  sortDirection: D1InsightsSortDirection;
  sortType: D1InsightsSortType;
  queries: D1InsightQuery[];
}

export interface D1OverviewResult {
  analytics: D1AnalyticsResult;
  storage: D1StorageResult;
  insights: D1InsightsResult;
}

interface AnalyticsQueryResponse {
  viewer: {
    accounts: Array<{
      d1AnalyticsAdaptiveGroups: Array<{
        sum?: {
          readQueries?: number;
          writeQueries?: number;
          rowsRead?: number;
          rowsWritten?: number;
          queryBatchResponseBytes?: number;
          queryBatchTimeMs?: number;
        };
        avg?: {
          queryBatchTimeMs?: number;
        };
        quantiles?: {
          queryBatchTimeMsP90?: number;
        };
        dimensions?: {
          date?: string;
          databaseId?: string;
        };
      }>;
    }>;
  };
}

interface StorageQueryResponse {
  viewer: {
    accounts: Array<{
      d1StorageAdaptiveGroups: Array<{
        max?: {
          databaseSizeBytes?: number;
        };
        dimensions?: {
          date?: string;
          databaseId?: string;
        };
      }>;
    }>;
  };
}

interface InsightsQueryResponse {
  viewer: {
    accounts: Array<{
      d1QueriesAdaptiveGroups: Array<{
        count?: number;
        avg?: {
          queryDurationMs?: number;
          rowsRead?: number;
          rowsWritten?: number;
        };
        sum?: {
          queryDurationMs?: number;
          rowsRead?: number;
          rowsWritten?: number;
        };
        quantiles?: {
          queryDurationMsP50?: number;
          queryDurationMsP95?: number;
        };
        dimensions?: {
          query?: string;
        };
      }>;
    }>;
  };
}

const ANALYTICS_QUERY = `query KuratchiD1Analytics($accountTag: string!, $databaseId: string!, $start: Date!, $end: Date!, $limit: Int!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      d1AnalyticsAdaptiveGroups(
        limit: $limit
        filter: { date_geq: $start, date_leq: $end, databaseId: $databaseId }
        orderBy: [date_DESC]
      ) {
        sum {
          readQueries
          writeQueries
          rowsRead
          rowsWritten
          queryBatchResponseBytes
          queryBatchTimeMs
        }
        avg {
          queryBatchTimeMs
        }
        quantiles {
          queryBatchTimeMsP90
        }
        dimensions {
          date
          databaseId
        }
      }
    }
  }
}`;

const STORAGE_QUERY = `query KuratchiD1Storage($accountTag: string!, $databaseId: string!, $start: Date!, $end: Date!, $limit: Int!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      d1StorageAdaptiveGroups(
        limit: $limit
        filter: { date_geq: $start, date_leq: $end, databaseId: $databaseId }
        orderBy: [date_DESC]
      ) {
        max {
          databaseSizeBytes
        }
        dimensions {
          date
          databaseId
        }
      }
    }
  }
}`;

const INSIGHTS_QUERY = `query KuratchiD1Insights($accountTag: string!, $filter: NewD1InsightsFilter_InputObject, $orderBy: string!, $limit: Int!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      d1QueriesAdaptiveGroups(
        limit: $limit
        filter: $filter
        orderBy: [$orderBy]
      ) {
        quantiles {
          queryDurationMsP50
          queryDurationMsP95
        }
        avg {
          queryDurationMs
          rowsRead
          rowsWritten
        }
        sum {
          queryDurationMs
          rowsRead
          rowsWritten
        }
        count
        dimensions {
          query
        }
      }
    }
  }
}`;

export class D1ObservabilityClient {
  private readonly graphql: CloudflareGraphQLClient;
  readonly databaseId: string;

  constructor(graphql: CloudflareGraphQLClient, databaseId: string) {
    this.graphql = graphql;
    this.databaseId = databaseId;
  }

  async timeseries(options: D1TimeseriesOptions): Promise<D1AnalyticsResult> {
    const range = normalizeRange(options);
    const data = await this.graphql.query<AnalyticsQueryResponse, {
      accountTag: string;
      databaseId: string;
      start: string;
      end: string;
      limit: number;
    }>({
      query: ANALYTICS_QUERY,
      variables: {
        accountTag: this.graphql.accountTag,
        databaseId: this.databaseId,
        start: range.since,
        end: range.until,
        limit: options.limit ?? 31,
      },
    });

    const groups = firstAccount(data)?.d1AnalyticsAdaptiveGroups ?? [];
    return {
      databaseId: this.databaseId,
      since: range.since,
      until: range.until,
      points: groups.map((group) => ({
        date: group.dimensions?.date ?? range.since,
        databaseId: group.dimensions?.databaseId,
        readQueries: group.sum?.readQueries ?? 0,
        writeQueries: group.sum?.writeQueries ?? 0,
        rowsRead: group.sum?.rowsRead ?? 0,
        rowsWritten: group.sum?.rowsWritten ?? 0,
        queryBatchResponseBytes: group.sum?.queryBatchResponseBytes ?? 0,
        queryBatchTimeMs: group.sum?.queryBatchTimeMs ?? 0,
        avgQueryBatchTimeMs: group.avg?.queryBatchTimeMs,
        p90QueryBatchTimeMs: group.quantiles?.queryBatchTimeMsP90,
      })),
    };
  }

  async storage(options: D1StorageOptions): Promise<D1StorageResult> {
    const range = normalizeRange(options);
    const data = await this.graphql.query<StorageQueryResponse, {
      accountTag: string;
      databaseId: string;
      start: string;
      end: string;
      limit: number;
    }>({
      query: STORAGE_QUERY,
      variables: {
        accountTag: this.graphql.accountTag,
        databaseId: this.databaseId,
        start: range.since,
        end: range.until,
        limit: options.limit ?? 31,
      },
    });

    const groups = firstAccount(data)?.d1StorageAdaptiveGroups ?? [];
    return {
      databaseId: this.databaseId,
      since: range.since,
      until: range.until,
      points: groups.map((group) => ({
        date: group.dimensions?.date ?? range.since,
        databaseId: group.dimensions?.databaseId,
        databaseSizeBytes: group.max?.databaseSizeBytes ?? 0,
      })),
    };
  }

  async insights(options: D1InsightsOptions): Promise<D1InsightsResult> {
    const range = normalizeDateTimeRange(options);
    const sortBy = options.sortBy ?? 'time';
    const sortDirection = options.sortDirection ?? 'DESC';
    const sortType = options.sortType ?? 'sum';
    const limit = options.limit ?? 20;
    const data = await this.graphql.query<InsightsQueryResponse, {
      accountTag: string;
      filter: {
        databaseId: string;
        datetimeFifteenMinutes_geq: string;
        datetimeFifteenMinutes_leq: string;
      };
      orderBy: string;
      limit: number;
    }>({
      query: INSIGHTS_QUERY,
      variables: {
        accountTag: this.graphql.accountTag,
        filter: {
          databaseId: this.databaseId,
          datetimeFifteenMinutes_geq: range.since,
          datetimeFifteenMinutes_leq: range.until,
        },
        orderBy: buildInsightsOrder(sortBy, sortType, sortDirection),
        limit,
      },
    });

    const groups = firstAccount(data)?.d1QueriesAdaptiveGroups ?? [];
    return {
      databaseId: this.databaseId,
      since: range.since,
      until: range.until,
      sortBy,
      sortDirection,
      sortType,
      queries: groups.map((group) => ({
        query: group.dimensions?.query ?? '',
        count: group.count ?? 0,
        totalRowsRead: group.sum?.rowsRead ?? 0,
        totalRowsWritten: group.sum?.rowsWritten ?? 0,
        totalDurationMs: group.sum?.queryDurationMs ?? 0,
        avgRowsRead: group.avg?.rowsRead,
        avgRowsWritten: group.avg?.rowsWritten,
        avgDurationMs: group.avg?.queryDurationMs,
        p50DurationMs: group.quantiles?.queryDurationMsP50,
        p95DurationMs: group.quantiles?.queryDurationMsP95,
      })),
    };
  }

  async overview(options: D1OverviewOptions): Promise<D1OverviewResult> {
    const since = normalizeDate(options.since);
    const until = normalizeDate(options.until);
    const insightsOptions = {
      since,
      until,
      limit: options.topN,
      sortBy: options.sortBy,
      sortDirection: options.sortDirection,
      sortType: options.sortType,
    } satisfies D1InsightsOptions;

    const [analyticsResult, storageResult, insightsResult] = await Promise.allSettled([
      this.timeseries({ since, until, limit: options.analyticsLimit }),
      this.storage({ since, until, limit: options.storageLimit }),
      this.insights(insightsOptions),
    ]);

    if (analyticsResult.status !== 'fulfilled') throw analyticsResult.reason;
    if (storageResult.status !== 'fulfilled') throw storageResult.reason;

    const insights = insightsResult.status === 'fulfilled'
      ? insightsResult.value
      : createEmptyInsightsResult(this.databaseId, insightsOptions);

    return {
      analytics: analyticsResult.value,
      storage: storageResult.value,
      insights,
    };
  }
}

export class CloudflareObservabilityClient {
  private readonly graphql: CloudflareGraphQLClient;

  constructor(options: CloudflareObservabilityClientOptions) {
    this.graphql = new CloudflareGraphQLClient(options);
  }

  d1(databaseId: string) {
    return new D1ObservabilityClient(this.graphql, databaseId);
  }

  aiGateway() {
    return new AiGatewayObservabilityClient(this.graphql);
  }
}

export function createCloudflareObservability(options: CloudflareObservabilityClientOptions) {
  return new CloudflareObservabilityClient(options);
}

function firstAccount<T extends { viewer: { accounts: Array<Record<string, unknown>> } }>(response: T) {
  return response.viewer.accounts[0] as T['viewer']['accounts'][number] | undefined;
}

function normalizeRange(range: D1DateRangeInput) {
  return {
    since: normalizeDate(range.since),
    until: normalizeDate(range.until),
  };
}

function normalizeDateTimeRange(range: D1DateRangeInput) {
  return {
    since: normalizeDateTime(range.since, 'start'),
    until: normalizeDateTime(range.until, 'end'),
  };
}

function normalizeDate(value: string | Date) {
  if (typeof value === 'string') return value;
  return value.toISOString().slice(0, 10);
}

function normalizeDateTime(value: string | Date, boundary: 'start' | 'end') {
  if (value instanceof Date) return value.toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return boundary === 'start'
      ? value + 'T00:00:00.000Z'
      : value + 'T23:59:59.999Z';
  }
  return value;
}

function createEmptyInsightsResult(databaseId: string, options: D1InsightsOptions): D1InsightsResult {
  return {
    databaseId,
    since: normalizeDateTime(options.since, 'start'),
    until: normalizeDateTime(options.until, 'end'),
    sortBy: options.sortBy ?? 'time',
    sortDirection: options.sortDirection ?? 'DESC',
    sortType: options.sortType ?? 'sum',
    queries: [],
  };
}

function buildInsightsOrder(sortBy: D1InsightsSortBy, sortType: D1InsightsSortType, sortDirection: D1InsightsSortDirection) {
  if (sortBy === 'count') return `count_${sortDirection}`;
  if (sortBy === 'reads') return `${sortType}_rowsRead_${sortDirection}`;
  if (sortBy === 'writes') return `${sortType}_rowsWritten_${sortDirection}`;
  if (sortType === 'avg') return `avg_queryDurationMs_${sortDirection}`;
  return `quantiles_queryDurationMsP95_${sortDirection}`;
}
