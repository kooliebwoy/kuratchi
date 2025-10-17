# Kuratchi Platform API - SDK Usage Guide

The Kuratchi SDK provides a unified client that handles both **database operations** and **platform management** through Kuratchi's managed infrastructure.

## Installation

```bash
npm install kuratchi-sdk
```

## Quick Start

```typescript
import { KuratchiClient } from 'kuratchi-sdk';

// Single client for everything - database queries AND platform management
const client = new KuratchiClient({
  apiKey: process.env.KURATCHI_API_KEY,
  databaseId: process.env.DATABASE_ID,
  schema: {
    users: {
      id: { type: 'integer', primaryKey: true },
      name: { type: 'text', notNull: true }
    }
  }
});

// Use the database (routed through Kuratchi's managed infrastructure)
await client.orm.users.insert({ name: 'Alice' });
const users = await client.query('SELECT * FROM users');

// Manage platform resources (databases, analytics, etc.)
const databases = await client.platform.databases.list();
const analytics = await client.platform.databases.analytics('db-id', { days: 7 });
```

## Key Concept: Managed vs Self-Hosted

The `KuratchiClient` is the **managed/pro version** that routes all operations through Kuratchi's APIs:

- ✅ **Database queries** → Routed to `/api/v1/databases` (uses Kuratchi's infrastructure)
- ✅ **Platform management** → Routed to `/api/v1/platform/*` (manage databases, get analytics)
- ✅ **Single API key** → No need for Cloudflare API keys, Resend keys, etc.
- ✅ **Automatic bookmark management** → Read-after-write consistency handled for you

## Database Operations

All database operations work exactly as documented, but are routed through Kuratchi's managed infrastructure:

```typescript
// ORM operations
await client.orm.users.insert({ name: 'Bob' });
const users = await client.orm.users.where({ name: 'Bob' }).many();

// Raw SQL
await client.query('INSERT INTO users (name) VALUES (?)', ['Charlie']);
const result = await client.query('SELECT * FROM users WHERE name = ?', ['Charlie']);

// Batch operations
await client.batch([
  { query: 'INSERT INTO users (name) VALUES (?)', params: ['Dave'] },
  { query: 'INSERT INTO users (name) VALUES (?)', params: ['Eve'] }
]);

// Drizzle ORM support
import { drizzle } from 'drizzle-orm/sqlite-proxy';
const db = drizzle(client.getDrizzleProxy());
```

## Platform Management API

Access platform management features through `client.platform`:

### List Databases

```typescript
const result = await client.platform.databases.list({
  organizationId: 'org-123',  // Optional: filter by organization
  includeArchived: false       // Optional: include archived databases
});

if (result.success) {
  console.log('Databases:', result.data);
  console.log('Count:', result.data.length);
}
```

### Create Database

```typescript
const result = await client.platform.databases.create({
  name: 'my-new-database',
  description: 'Production database for my app',
  organizationId: 'org-123'  // Optional
});

if (result.success) {
  console.log('Created database:', result.data.id);
  console.log('Database name:', result.data.name);
  console.log('Cloudflare D1 ID:', result.data.databaseId);
}
```

### Get Database Details

```typescript
const result = await client.platform.databases.get('db-uuid');

if (result.success) {
  console.log('Database:', result.data);
  console.log('Active:', result.data.isActive);
  console.log('Created:', result.data.created_at);
}
```

### Update Database

```typescript
const result = await client.platform.databases.update('db-uuid', {
  isActive: false,
  needsSchemaUpdate: true
});

if (result.success) {
  console.log('Database updated:', result.data);
}
```

### Delete Database

```typescript
// Soft delete (archive) - default
const result = await client.platform.databases.delete('db-uuid');

// Hard delete (permanent) - removes from Cloudflare
const result = await client.platform.databases.delete('db-uuid', { hard: true });

if (result.success) {
  console.log('Database deleted');
}
```

### Get Analytics

```typescript
const result = await client.platform.databases.analytics('db-uuid', {
  days: 14  // Optional: 1-30 days, default 7
});

if (result.success) {
  console.log('Read queries:', result.data.readQueries);
  console.log('Write queries:', result.data.writeQueries);
  console.log('Rows read:', result.data.rowsRead);
  console.log('Rows written:', result.data.rowsWritten);
  console.log('Period:', result.data.period);
}
```

## Error Handling

All platform methods return a consistent response format:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  issues?: Array<{ field: string; message: string }>;
}
```

**Example:**

```typescript
const result = await client.platform.databases.create({
  name: 'invalid name!',  // Invalid: contains space and special char
  description: 'Test'
});

if (!result.success) {
  console.error('Error:', result.error);
  if (result.issues) {
    result.issues.forEach(issue => {
      console.error(`${issue.field}: ${issue.message}`);
    });
  }
}
```

## Complete Example: Database Lifecycle

```typescript
import { KuratchiClient } from 'kuratchi-sdk';

const client = new KuratchiClient({
  apiKey: process.env.KURATCHI_API_KEY,
  databaseId: process.env.DATABASE_ID
});

async function databaseLifecycle() {
  // 1. List existing databases
  const { data: databases } = await client.platform.databases.list();
  console.log('Existing databases:', databases.length);

  // 2. Create a new database
  const createResult = await client.platform.databases.create({
    name: 'my-app-db',
    description: 'Production database',
    organizationId: 'org-123'
  });

  if (!createResult.success) {
    console.error('Failed to create:', createResult.error);
    return;
  }

  const newDbId = createResult.data.id;
  console.log('Created database:', newDbId);

  // 3. Get database details
  const { data: db } = await client.platform.databases.get(newDbId);
  console.log('Database info:', db);

  // 4. Wait a bit for some activity...
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 5. Get analytics
  const { data: analytics } = await client.platform.databases.analytics(newDbId, {
    days: 1
  });
  console.log('Analytics:', analytics);

  // 6. Archive the database
  const deleteResult = await client.platform.databases.delete(newDbId);
  console.log('Archived:', deleteResult.success);
}

databaseLifecycle();
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import { 
  KuratchiClient,
  type Database,
  type DatabaseAnalytics,
  type CreateDatabaseRequest,
  type UpdateDatabaseRequest,
  type ApiResponse
} from 'kuratchi-sdk';

const client = new KuratchiClient({ apiKey, databaseId });

// Typed responses
const result: ApiResponse<Database[]> = await client.platform.databases.list();
const analytics: ApiResponse<DatabaseAnalytics> = await client.platform.databases.analytics('id');
```

## Benefits of Managed Infrastructure

When using `KuratchiClient`, you get:

1. **No Cloudflare API keys needed** - Kuratchi handles D1 database creation/deletion
2. **No Resend API keys needed** - Email sending routed through Kuratchi
3. **Automatic scaling** - Kuratchi manages infrastructure
4. **Built-in analytics** - Database metrics without extra setup
5. **Centralized billing** - One invoice for all services
6. **Simplified deployment** - Just API key + database ID

## Migration from Self-Hosted

If you're migrating from self-hosted to managed:

**Before (self-hosted):**
```typescript
import { database } from 'kuratchi-sdk';

const { orm } = await database.connect({
  databaseName: 'my-db',
  dbToken: process.env.CLOUDFLARE_DB_TOKEN,
  gatewayKey: process.env.CLOUDFLARE_GATEWAY_KEY,
  schema
});
```

**After (managed):**
```typescript
import { KuratchiClient } from 'kuratchi-sdk';

const client = new KuratchiClient({
  apiKey: process.env.KURATCHI_API_KEY,  // Single API key
  databaseId: process.env.DATABASE_ID,
  schema
});

// Same ORM interface!
const { orm } = client;
```

## Next Steps

- Check out the [API Reference](./README.md) for detailed documentation
- See [Platform API Endpoints](../../apps/dashboard/src/routes/api/v1/platform/README.md) for HTTP API details
- Join our [Discord](https://discord.gg/kuratchi) for support
