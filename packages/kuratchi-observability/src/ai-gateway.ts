import { CloudflareGraphQLClient } from './graphql.js';

export interface AiGatewayDateRangeInput {
  since: string | Date;
  until: string | Date;
}

export interface AiGatewayTimeseriesOptions extends AiGatewayDateRangeInput {
  gateway?: string;
  limit?: number;
  metadataFilters?: Record<string, string | number | boolean | bigint>;
}

export interface AiGatewayTopModelsOptions extends AiGatewayDateRangeInput {
  gateway?: string;
  limit?: number;
  metadataFilters?: Record<string, string | number | boolean | bigint>;
}

export interface AiGatewayOverviewOptions extends AiGatewayDateRangeInput {
  gateway?: string;
  timeseriesLimit?: number;
  topN?: number;
  metadataFilters?: Record<string, string | number | boolean | bigint>;
}

export interface AiGatewayUsageTotals {
  requests: number;
  cachedRequests: number;
  erroredRequests: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface AiGatewayTimeseriesPoint extends AiGatewayUsageTotals {
  timestamp: string;
  gateway?: string;
}

export interface AiGatewayTimeseriesResult {
  since: string;
  until: string;
  gateway?: string;
  points: AiGatewayTimeseriesPoint[];
  totals: AiGatewayUsageTotals;
}

export interface AiGatewayTopModel extends AiGatewayUsageTotals {
  model: string;
  provider: string;
  gateway?: string;
}

export interface AiGatewayTopModelsResult {
  since: string;
  until: string;
  gateway?: string;
  models: AiGatewayTopModel[];
}

export interface AiGatewayOverviewResult {
  usage: AiGatewayTimeseriesResult;
  topModels: AiGatewayTopModelsResult;
}

interface AiGatewayTimeseriesQueryResponse {
  viewer: {
    accounts: Array<{
      aiGatewayRequestsAdaptiveGroups: Array<{
        count?: number;
        sum?: {
          cachedRequests?: number;
          erroredRequests?: number;
          uncachedTokensIn?: number;
          uncachedTokensOut?: number;
          cachedTokensIn?: number;
          cachedTokensOut?: number;
          cost?: number;
        };
        dimensions?: {
          datetimeHour?: string;
          gateway?: string;
        };
      }>;
    }>;
  };
}

interface AiGatewayTopModelsQueryResponse {
  viewer: {
    accounts: Array<{
      aiGatewayRequestsAdaptiveGroups: Array<{
        count?: number;
        sum?: {
          cachedRequests?: number;
          erroredRequests?: number;
          uncachedTokensIn?: number;
          uncachedTokensOut?: number;
          cachedTokensIn?: number;
          cachedTokensOut?: number;
          cost?: number;
        };
        dimensions?: {
          model?: string;
          provider?: string;
          gateway?: string;
        };
      }>;
    }>;
  };
}

type AiGatewayMetadataClause =
  | { metadataKeys_has: string }
  | { metadataValues_has: string };

const AI_GATEWAY_TIMESERIES_QUERY = `query KuratchiAiGatewayTimeseries($accountTag: string!, $filter: AccountAiGatewayRequestsAdaptiveGroupsFilter_InputObject, $limit: Int!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      aiGatewayRequestsAdaptiveGroups(
        limit: $limit
        filter: $filter
        orderBy: [datetimeHour_DESC]
      ) {
        count
        sum {
          cachedRequests
          erroredRequests
          uncachedTokensIn
          uncachedTokensOut
          cachedTokensIn
          cachedTokensOut
          cost
        }
        dimensions {
          datetimeHour
          gateway
        }
      }
    }
  }
}`;

const AI_GATEWAY_TOP_MODELS_QUERY = `query KuratchiAiGatewayTopModels($accountTag: string!, $filter: AccountAiGatewayRequestsAdaptiveGroupsFilter_InputObject, $limit: Int!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      aiGatewayRequestsAdaptiveGroups(
        limit: $limit
        filter: $filter
        orderBy: [count_DESC]
      ) {
        count
        sum {
          cachedRequests
          erroredRequests
          uncachedTokensIn
          uncachedTokensOut
          cachedTokensIn
          cachedTokensOut
          cost
        }
        dimensions {
          model
          provider
          gateway
        }
      }
    }
  }
}`;

export class AiGatewayObservabilityClient {
  private readonly graphql: CloudflareGraphQLClient;

  constructor(graphql: CloudflareGraphQLClient) {
    this.graphql = graphql;
  }

  async timeseries(options: AiGatewayTimeseriesOptions): Promise<AiGatewayTimeseriesResult> {
    const range = normalizeDateTimeRange(options);
    const data = await this.graphql.query<AiGatewayTimeseriesQueryResponse, {
      accountTag: string;
      filter: {
        AND?: AiGatewayMetadataClause[];
        datetimeHour_geq: string;
        datetimeHour_leq: string;
        gateway?: string;
      };
      limit: number;
    }>({
      query: AI_GATEWAY_TIMESERIES_QUERY,
      variables: {
        accountTag: this.graphql.accountTag,
        filter: {
          datetimeHour_geq: range.since,
          datetimeHour_leq: range.until,
          ...(options.gateway ? { gateway: options.gateway } : {}),
          ...buildMetadataFilter(options.metadataFilters),
        },
        limit: options.limit ?? 168,
      },
    });

    const groups = firstAccount(data)?.aiGatewayRequestsAdaptiveGroups ?? [];
    const points = groups.map((group) => {
      const uncachedInput = group.sum?.uncachedTokensIn ?? 0;
      const uncachedOutput = group.sum?.uncachedTokensOut ?? 0;
      const cachedInput = group.sum?.cachedTokensIn ?? 0;
      const cachedOutput = group.sum?.cachedTokensOut ?? 0;
      return {
        timestamp: group.dimensions?.datetimeHour ?? range.since,
        gateway: group.dimensions?.gateway,
        requests: group.count ?? 0,
        cachedRequests: group.sum?.cachedRequests ?? 0,
        erroredRequests: group.sum?.erroredRequests ?? 0,
        inputTokens: uncachedInput + cachedInput,
        outputTokens: uncachedOutput + cachedOutput,
        cost: group.sum?.cost ?? 0,
      };
    });

    return {
      since: range.since,
      until: range.until,
      gateway: options.gateway,
      points,
      totals: sumUsage(points),
    };
  }

  async topModels(options: AiGatewayTopModelsOptions): Promise<AiGatewayTopModelsResult> {
    const range = normalizeDateTimeRange(options);
    const data = await this.graphql.query<AiGatewayTopModelsQueryResponse, {
      accountTag: string;
      filter: {
        AND?: AiGatewayMetadataClause[];
        datetimeHour_geq: string;
        datetimeHour_leq: string;
        gateway?: string;
      };
      limit: number;
    }>({
      query: AI_GATEWAY_TOP_MODELS_QUERY,
      variables: {
        accountTag: this.graphql.accountTag,
        filter: {
          datetimeHour_geq: range.since,
          datetimeHour_leq: range.until,
          ...(options.gateway ? { gateway: options.gateway } : {}),
          ...buildMetadataFilter(options.metadataFilters),
        },
        limit: options.limit ?? 5,
      },
    });

    const groups = firstAccount(data)?.aiGatewayRequestsAdaptiveGroups ?? [];
    return {
      since: range.since,
      until: range.until,
      gateway: options.gateway,
      models: groups.map((group) => {
        const uncachedInput = group.sum?.uncachedTokensIn ?? 0;
        const uncachedOutput = group.sum?.uncachedTokensOut ?? 0;
        const cachedInput = group.sum?.cachedTokensIn ?? 0;
        const cachedOutput = group.sum?.cachedTokensOut ?? 0;
        return {
          model: group.dimensions?.model ?? 'Unknown model',
          provider: group.dimensions?.provider ?? 'Unknown provider',
          gateway: group.dimensions?.gateway,
          requests: group.count ?? 0,
          cachedRequests: group.sum?.cachedRequests ?? 0,
          erroredRequests: group.sum?.erroredRequests ?? 0,
          inputTokens: uncachedInput + cachedInput,
          outputTokens: uncachedOutput + cachedOutput,
          cost: group.sum?.cost ?? 0,
        };
      }),
    };
  }

  async overview(options: AiGatewayOverviewOptions): Promise<AiGatewayOverviewResult> {
    const [usage, topModels] = await Promise.all([
      this.timeseries({
        since: options.since,
        until: options.until,
        gateway: options.gateway,
        limit: options.timeseriesLimit,
        metadataFilters: options.metadataFilters,
      }),
      this.topModels({
        since: options.since,
        until: options.until,
        gateway: options.gateway,
        limit: options.topN,
        metadataFilters: options.metadataFilters,
      }),
    ]);

    return { usage, topModels };
  }
}

function firstAccount<T extends { viewer: { accounts: Array<Record<string, unknown>> } }>(response: T) {
  return response.viewer.accounts[0] as T['viewer']['accounts'][number] | undefined;
}

function normalizeDateTimeRange(range: AiGatewayDateRangeInput) {
  return {
    since: normalizeDateTime(range.since, 'start'),
    until: normalizeDateTime(range.until, 'end'),
  };
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

function sumUsage(points: AiGatewayUsageTotals[]): AiGatewayUsageTotals {
  return points.reduce((totals, point) => ({
    requests: totals.requests + point.requests,
    cachedRequests: totals.cachedRequests + point.cachedRequests,
    erroredRequests: totals.erroredRequests + point.erroredRequests,
    inputTokens: totals.inputTokens + point.inputTokens,
    outputTokens: totals.outputTokens + point.outputTokens,
    cost: totals.cost + point.cost,
  }), {
    requests: 0,
    cachedRequests: 0,
    erroredRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
  });
}

function buildMetadataFilter(metadataFilters?: Record<string, string | number | boolean | bigint>) {
  if (!metadataFilters) return {};

  const and = Object.entries(metadataFilters).flatMap(([key, value]) => ([
    { metadataKeys_has: key },
    { metadataValues_has: String(value) },
  ]));

  return and.length > 0 ? { AND: and } : {};
}
