# Kuratchi Managed Infrastructure

Clean, namespaced API for Kuratchi's managed services. All operations routed through Kuratchi's infrastructure with a single API key.

## Quick Start

```typescript
import { managed } from 'kuratchi-sdk';

const client = new managed.Client({
  apiKey: process.env.KURATCHI_API_KEY,
  databaseId: process.env.DATABASE_ID,
  schema: {
    users: {
      id: { type: 'integer', primaryKey: true },
      name: { type: 'text', notNull: true }
    }
  }
});

// Database operations (routed through Kuratchi)
await client.orm.users.insert({ name: 'Alice' });
await client.query('SELECT * FROM users');

// Platform management
const databases = await client.platform.databases.list();
const analytics = await client.platform.databases.analytics('db-id');
```

## Structure

```
managed/
├── Client          - Main managed client (database + platform)
├── PlatformClient  - Platform management (internal)
└── Types          - TypeScript types
```

## Benefits

### ✅ Clean Namespace
```typescript
import { managed } from 'kuratchi-sdk';

// Clear structure
const client = new managed.Client({ ... });
```

### ✅ No Code Duplication
The managed client is a **thin wrapper** that reuses existing database methods:
- Database operations → `createBaasDatabase()` (existing)
- Platform management → `PlatformClient` (new)
- No duplicated logic!

### ✅ Single API Key
```typescript
// Only need Kuratchi API key
const client = new managed.Client({
  apiKey: process.env.KURATCHI_API_KEY,  // ✅ Single key
  databaseId: process.env.DATABASE_ID
});

// vs self-hosted (multiple keys needed)
const db = await database.connect({
  databaseName: 'my-db',
  dbToken: process.env.CLOUDFLARE_DB_TOKEN,      // ❌
  gatewayKey: process.env.CLOUDFLARE_GATEWAY_KEY, // ❌
  schema
});
```

## API Reference

### Database Operations

All standard database methods work exactly the same, just routed through Kuratchi:

```typescript
// ORM
await client.orm.users.insert({ name: 'Alice' });
const users = await client.orm.users.where({ name: 'Alice' }).many();

// Raw SQL
await client.query('SELECT * FROM users WHERE id = ?', [1]);
await client.exec('CREATE TABLE posts (id INTEGER PRIMARY KEY)');
await client.batch([
  { query: 'INSERT INTO users (name) VALUES (?)', params: ['Bob'] },
  { query: 'INSERT INTO users (name) VALUES (?)', params: ['Charlie'] }
]);

// Drizzle ORM
import { drizzle } from 'drizzle-orm/sqlite-proxy';
const db = drizzle(client.getDrizzleProxy());
```

### Platform Management

```typescript
// List databases
const { data: databases } = await client.platform.databases.list({
  organizationId: 'org-123',
  includeArchived: false
});

// Create database
const result = await client.platform.databases.create({
  name: 'my-new-db',
  description: 'Production database',
  organizationId: 'org-123'
});

// Get database details
const { data: db } = await client.platform.databases.get('db-uuid');

// Update database
await client.platform.databases.update('db-uuid', {
  isActive: false
});

// Delete database
await client.platform.databases.delete('db-uuid');        // Soft delete
await client.platform.databases.delete('db-uuid', { hard: true }); // Hard delete

// Get analytics
const { data: analytics } = await client.platform.databases.analytics('db-uuid', {
  days: 14
});
console.log('Read queries:', analytics.readQueries);
console.log('Write queries:', analytics.writeQueries);
```

### Bookmark Management

```typescript
// Get current bookmark (for session persistence)
const bookmark = client.getBookmark();

// Restore bookmark (from external storage)
client.setBookmark(bookmark);

// Clear bookmark (start fresh)
client.clearBookmark();
```

## TypeScript Support

```typescript
import { managed, type managed.ClientConfig } from 'kuratchi-sdk';

const config: managed.ClientConfig = {
  apiKey: process.env.KURATCHI_API_KEY!,
  databaseId: process.env.DATABASE_ID!,
  schema: {
    users: {
      id: { type: 'integer', primaryKey: true },
      name: { type: 'text', notNull: true }
    }
  }
};

const client = new managed.Client(config);

// Typed responses
const result: managed.ApiResponse<managed.Database[]> = 
  await client.platform.databases.list();
```

## Migration from KuratchiClient

If you're using the legacy `KuratchiClient`, migration is simple:

**Before:**
```typescript
import { KuratchiClient } from 'kuratchi-sdk';

const client = new KuratchiClient({
  apiKey: process.env.KURATCHI_API_KEY,
  databaseId: process.env.DATABASE_ID,
  schema
});
```

**After:**
```typescript
import { managed } from 'kuratchi-sdk';

const client = new managed.Client({
  apiKey: process.env.KURATCHI_API_KEY,
  databaseId: process.env.DATABASE_ID,
  schema
});
```

All methods work exactly the same! The only difference is the cleaner namespace.

## Functional Alternative

Prefer functions over classes? Use `createClient`:

```typescript
import { managed } from 'kuratchi-sdk';

const client = managed.createClient({
  apiKey: process.env.KURATCHI_API_KEY,
  databaseId: process.env.DATABASE_ID,
  schema
});
```

## Examples

### Complete CRUD Example

```typescript
import { managed } from 'kuratchi-sdk';

const client = new managed.Client({
  apiKey: process.env.KURATCHI_API_KEY,
  databaseId: process.env.DATABASE_ID,
  schema: {
    users: {
      id: { type: 'integer', primaryKey: true },
      name: { type: 'text', notNull: true },
      email: { type: 'text', unique: true }
    }
  }
});

// Create
await client.orm.users.insert({
  name: 'Alice',
  email: 'alice@example.com'
});

// Read
const users = await client.orm.users.where({ name: 'Alice' }).many();

// Update
await client.orm.users
  .where({ email: 'alice@example.com' })
  .update({ name: 'Alice Smith' });

// Delete
await client.orm.users
  .where({ email: 'alice@example.com' })
  .delete();
```

### Database Lifecycle Management

```typescript
import { managed } from 'kuratchi-sdk';

const client = new managed.Client({
  apiKey: process.env.KURATCHI_API_KEY,
  databaseId: process.env.DATABASE_ID
});

// Create a new database
const { data: newDb } = await client.platform.databases.create({
  name: 'staging-db',
  description: 'Staging environment database',
  organizationId: 'org-123'
});

console.log('Created:', newDb.id);

// Monitor analytics
const { data: analytics } = await client.platform.databases.analytics(newDb.id, {
  days: 7
});

console.log('Usage:', {
  reads: analytics.readQueries,
  writes: analytics.writeQueries
});

// Archive when done
await client.platform.databases.delete(newDb.id);
```

## Architecture

The managed client is a **thin wrapper** with zero code duplication:

```
managed.Client
├── Database Operations → createBaasDatabase() [existing]
│   ├── query()
│   ├── exec()
│   ├── batch()
│   ├── orm.*
│   └── getDrizzleProxy()
│
└── Platform Management → PlatformClient [new]
    └── platform.databases.*
```

**Key Points:**
- Reuses existing `createBaasDatabase()` for all database operations
- Adds `PlatformClient` for management features
- No duplicated code anywhere
- All operations route to Kuratchi's APIs with your API key

## Next Steps

- See [PLATFORM_API.md](./PLATFORM_API.md) for detailed API documentation
- Check [examples/](../../examples/) for more examples
- Join our [Discord](https://discord.gg/kuratchi) for support
