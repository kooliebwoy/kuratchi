import { env } from 'cloudflare:workers';
import { createCloudflareObservability } from '@kuratchi/observability';
import { getCurrentUser } from '$server/database/auth';

export interface DroverUsageRange {
  since: string;
  until: string;
}

export async function getDroverUsage(range: Partial<DroverUsageRange> = {}) {
  const normalizedRange = normalizeRange(range);
  const user = await getCurrentUser();
  const gatewayId = (env as any).AI_GATEWAY_ID as string | undefined;
  const accountTag = (env as any).CLOUDFLARE_ACCOUNT_ID as string | undefined;
  const apiToken = (env as any).CLOUDFLARE_API_TOKEN as string | undefined;

  if (!user?.organizationId) {
    return {
      organizationId: null,
      connected: false,
      gatewayId: null,
      range: normalizedRange,
      overview: null,
      error: null,
      unavailableReason: 'You must belong to an organization to view Drover usage.',
    };
  }

  if (!gatewayId) {
    return {
      organizationId: user.organizationId,
      connected: false,
      gatewayId: null,
      range: normalizedRange,
      overview: null,
      error: null,
      unavailableReason: 'Set AI_GATEWAY_ID to show Cloudflare AI Gateway status and usage.',
    };
  }

  if (!accountTag || !apiToken) {
    return {
      organizationId: user.organizationId,
      connected: true,
      gatewayId,
      range: normalizedRange,
      overview: null,
      error: null,
      unavailableReason: 'Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to load AI Gateway usage.',
    };
  }

  try {
    const client = createCloudflareObservability({ accountTag, apiToken });
    const overview = await client.aiGateway().overview({
      since: normalizedRange.since,
      until: normalizedRange.until,
      gateway: gatewayId,
      timeseriesLimit: 168,
      topN: 5,
      metadataFilters: {
        organizationId: user.organizationId,
        product: 'drover',
      },
    });

    return {
      organizationId: user.organizationId,
      connected: true,
      gatewayId,
      range: normalizedRange,
      overview,
      error: null,
      unavailableReason: null,
    };
  } catch (error) {
    return {
      organizationId: user.organizationId,
      connected: true,
      gatewayId,
      range: normalizedRange,
      overview: null,
      error: error instanceof Error ? error.message : String(error),
      unavailableReason: null,
    };
  }
}

function normalizeRange(range: Partial<DroverUsageRange>): DroverUsageRange {
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
