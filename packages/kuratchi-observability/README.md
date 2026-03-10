# @kuratchi/observability

Cloudflare-first observability client for Kuratchi apps and packages.

This package queries Cloudflare's GraphQL Analytics API over HTTP and starts with D1 observability. Pass your Cloudflare account ID and API token once, then ask for analytics for a specific D1 database ID.

Cloudflare documents D1 observability via the GraphQL Analytics API and lists the D1 datasets as `d1AnalyticsAdaptiveGroups`, `d1StorageAdaptiveGroups`, and `d1QueriesAdaptiveGroups`.

## Install

```bash
npm install @kuratchi/observability
```

## Authentication

Create a Cloudflare API token with `Account | Account Analytics | Read` permission. Cloudflare recommends API tokens for GraphQL Analytics authentication.

## Quick start

```ts
import { createCloudflareObservability } from '@kuratchi/observability';

const observability = createCloudflareObservability({
  accountTag: process.env.CLOUDFLARE_ACCOUNT_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
});

const db = observability.d1('your-d1-database-id');

const overview = await db.overview({
  since: '2026-03-01',
  until: '2026-03-08',
  topN: 10,
});

console.log(overview.analytics.points);
console.log(overview.storage.points);
console.log(overview.insights.queries);
```

## D1 APIs

### `client.d1(databaseId)`

Returns a D1-scoped observability client.

### `await db.timeseries({ since, until, limit })`

Queries `d1AnalyticsAdaptiveGroups` and returns daily metrics for the database:

- `readQueries`
- `writeQueries`
- `rowsRead`
- `rowsWritten`
- `queryBatchResponseBytes`
- `queryBatchTimeMs`
- `avgQueryBatchTimeMs`
- `p90QueryBatchTimeMs`

### `await db.storage({ since, until, limit })`

Queries `d1StorageAdaptiveGroups` and returns daily storage points using `databaseSizeBytes`.

### `await db.insights({ since, until, limit, sortBy, sortDirection, sortType })`

Queries `d1QueriesAdaptiveGroups` for per-query insight rows. The query text is captured by Cloudflare, while bound parameters are not captured.

### `await db.overview({ since, until, topN })`

Fetches timeseries, storage, and insights concurrently.

## Notes

- This package calls Cloudflare's GraphQL endpoint at `https://api.cloudflare.com/client/v4/graphql` using HTTP `POST`.
- D1 observability retention is documented by Cloudflare as up to 31 days.
- D1 observability uses the Cloudflare account ID (`accountTag`) plus the target D1 database ID (`databaseId`).
