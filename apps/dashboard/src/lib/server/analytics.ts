import { env } from '$env/dynamic/private';

export interface AnalyticsData {
  pageviews: number;
  visits: number;
  visitors: number;
  topPages: { path: string; views: number }[];
  topReferrers: { referrer: string; visits: number }[];
  topCountries: { country: string; visits: number }[];
  topBrowsers: { browser: string; visits: number }[];
  topDevices: { device: string; visits: number }[];
  timeseries: { date: string; pageviews: number; visits: number }[];
}

export interface AnalyticsError {
  error?: string;
  noToken?: boolean;
  message?: string;
}

export type AnalyticsResult = AnalyticsData | AnalyticsError;

/**
 * Fetch analytics data from Cloudflare Web Analytics for a specific hostname
 * Uses the httpRequestsAdaptiveGroups query which supports hostname filtering
 */
export async function getAnalyticsForHostname(
  hostname: string,
  period: '1d' | '7d' | '30d' | '90d' = '7d'
): Promise<AnalyticsResult> {
  const cfAccountId = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;
  const cfApiToken = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN;
  const zoneTag = env.CF_ANALYTICS_ZONE_TAG || env.CF_ANALYTICS_SITE_TAG;

  if (!cfAccountId || !cfApiToken) {
    return { error: 'Cloudflare credentials not configured' };
  }

  if (!zoneTag) {
    return { 
      noToken: true,
      message: 'Zone analytics not configured. Set CF_ANALYTICS_ZONE_TAG in environment.'
    };
  }

  // Calculate date range
  const now = new Date();
  const days = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  const dateStart = startDate.toISOString().split('T')[0];
  const dateEnd = now.toISOString().split('T')[0];

  console.log('[analytics] Querying for hostname:', hostname, 'period:', period);

  // Use rumPageloadEventsAdaptiveGroups but filter results client-side by hostname
  // The siteTag filter ensures we only get data for our zone
  const graphqlQuery = `
    query GetRumAnalytics($accountTag: String!, $siteTag: String!, $dateStart: Date!, $dateEnd: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          rumPageloadEventsAdaptiveGroups(
            filter: {
              AND: [
                { siteTag: $siteTag }
                { date_geq: $dateStart }
                { date_leq: $dateEnd }
              ]
            }
            limit: 10000
          ) {
            count
            sum {
              visits
            }
            dimensions {
              date
              refererHost
              countryName
              userAgentBrowser
              deviceType
              requestPath
              requestHost
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfApiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: {
          accountTag: cfAccountId,
          siteTag: zoneTag,
          dateStart,
          dateEnd
        }
      })
    });

    if (!response.ok) {
      console.error('[analytics] Cloudflare API error:', response.status);
      return { error: 'Failed to fetch analytics data' };
    }

    const result = await response.json() as any;
    
    if (result.errors?.length > 0) {
      console.error('[analytics] GraphQL errors:', result.errors);
      return { error: 'Analytics query failed: ' + result.errors[0]?.message };
    }

    const groups = result.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || [];

    // Filter by hostname and aggregate data
    let totalPageviews = 0;
    let totalVisits = 0;
    const pageMap = new Map<string, number>();
    const referrerMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const browserMap = new Map<string, number>();
    const deviceMap = new Map<string, number>();
    const dateMap = new Map<string, { pageviews: number; visits: number }>();

    for (const group of groups) {
      const dims = group.dimensions || {};
      
      // Filter by hostname - only include data for this specific site
      if (dims.requestHost && dims.requestHost !== hostname) {
        continue;
      }

      const count = group.count || 0;
      const visits = group.sum?.visits || 0;

      totalPageviews += count;
      totalVisits += visits;

      // Aggregate by path
      if (dims.requestPath) {
        pageMap.set(dims.requestPath, (pageMap.get(dims.requestPath) || 0) + count);
      }

      // Aggregate by referrer
      if (dims.refererHost) {
        referrerMap.set(dims.refererHost, (referrerMap.get(dims.refererHost) || 0) + visits);
      }

      // Aggregate by country
      if (dims.countryName) {
        countryMap.set(dims.countryName, (countryMap.get(dims.countryName) || 0) + visits);
      }

      // Aggregate by browser
      if (dims.userAgentBrowser) {
        browserMap.set(dims.userAgentBrowser, (browserMap.get(dims.userAgentBrowser) || 0) + visits);
      }

      // Aggregate by device
      if (dims.deviceType) {
        deviceMap.set(dims.deviceType, (deviceMap.get(dims.deviceType) || 0) + visits);
      }

      // Aggregate by date
      if (dims.date) {
        const existing = dateMap.get(dims.date) || { pageviews: 0, visits: 0 };
        dateMap.set(dims.date, {
          pageviews: existing.pageviews + count,
          visits: existing.visits + visits
        });
      }
    }

    // Convert maps to sorted arrays
    const topPages = Array.from(pageMap.entries())
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const topReferrers = Array.from(referrerMap.entries())
      .map(([referrer, visits]) => ({ referrer, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

    const topCountries = Array.from(countryMap.entries())
      .map(([country, visits]) => ({ country, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

    const topBrowsers = Array.from(browserMap.entries())
      .map(([browser, visits]) => ({ browser, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 5);

    const topDevices = Array.from(deviceMap.entries())
      .map(([device, visits]) => ({ device, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 5);

    const timeseries = Array.from(dateMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Estimate unique visitors (rough approximation)
    const visitors = Math.round(totalVisits * 0.85);

    return {
      pageviews: totalPageviews,
      visits: totalVisits,
      visitors,
      topPages,
      topReferrers,
      topCountries,
      topBrowsers,
      topDevices,
      timeseries
    };
  } catch (err: any) {
    console.error('[analytics] error:', err);
    return { error: err.message || 'Failed to fetch analytics' };
  }
}
