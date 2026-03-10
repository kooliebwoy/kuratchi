import { env } from 'cloudflare:workers';
import { createCloudflareObservability } from '@kuratchi/observability';
import { getDatabase } from './databases';

export interface DatabaseObservabilityRange {
  since: string;
  until: string;
}

export async function getDatabaseObservability(databaseId: string, range: Partial<DatabaseObservabilityRange> = {}) {
  const database = await getDatabase(databaseId);
  const normalizedRange = normalizeRange(range);

  if (!database) {
    return {
      database: null,
      range: normalizedRange,
      overview: null,
      error: 'Database not found.',
      unavailableReason: null,
    };
  }

  if (!database.dbuuid) {
    return {
      database,
      range: normalizedRange,
      overview: null,
      error: null,
      unavailableReason: 'This database does not have a Cloudflare D1 UUID yet.',
    };
  }

  const accountTag = (env as any).CLOUDFLARE_ACCOUNT_ID as string | undefined;
  const apiToken = (env as any).CLOUDFLARE_API_TOKEN as string | undefined;

  if (!accountTag || !apiToken) {
    return {
      database,
      range: normalizedRange,
      overview: null,
      error: null,
      unavailableReason: 'Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to load Cloudflare D1 observability.',
    };
  }

  try {
    const client = createCloudflareObservability({ accountTag, apiToken });
    const overview = await client.d1(database.dbuuid).overview({
      since: normalizedRange.since,
      until: normalizedRange.until,
      topN: 5,
      analyticsLimit: 31,
      storageLimit: 31,
      sortBy: 'time',
      sortDirection: 'DESC',
      sortType: 'sum',
    });

    return {
      database,
      range: normalizedRange,
      overview,
      error: null,
      unavailableReason: null,
    };
  } catch (error) {
    return {
      database,
      range: normalizedRange,
      overview: null,
      error: error instanceof Error ? error.message : String(error),
      unavailableReason: null,
    };
  }
}

function normalizeRange(range: Partial<DatabaseObservabilityRange>): DatabaseObservabilityRange {
  const until = normalizeDate(range.until) ?? todayUtc();
  const since = normalizeDate(range.since) ?? daysAgoUtc(6);
  return { since, until };
}

function normalizeDate(value?: string) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoUtc(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

