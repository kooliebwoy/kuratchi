# SDK Architecture

## Clean Separation: Managed vs Self-Hosted

### Managed Infrastructure (`managed/`)

**Thin HTTP wrappers** to Kuratchi's APIs. No local D1 logic needed.

```
managed/
├── database.ts    ← HTTP wrapper for /api/v1/databases
├── platform.ts    ← HTTP wrapper for /api/v1/platform/*
├── client.ts      ← Combines database + platform + optional ORM
└── index.ts       ← Public exports
```

**Key Point:** Managed layer is **pure HTTP** - just authentication + request routing.

```typescript
// managed/database.ts - ~170 lines
class ManagedDatabase {
  async query(sql, params) {
    return fetch('/api/v1/databases', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ query: sql, params })
    });
  }
}
```

### Self-Hosted Infrastructure (`database/`)

**Local D1 operations** for users with their own Cloudflare keys.

```
database/
├── index.ts           ← D1 connection logic
├── clients/
│   └── d1-client.ts   ← Direct D1 operations
├── migrations/        ← Schema migrations
└── orm/               ← ORM layer
```

**Key Point:** Self-hosted layer has **full D1 logic** - migrations, adapters, etc.

## Why This is Clean

### ❌ Before (3 layers of wrapping)

```
managed.Client
  └── createBaasDatabase()
      └── createBaasClient()
          └── HTTP request
```

**Problem:** Multiple layers doing the same thing (HTTP requests)

### ✅ After (Direct HTTP)

```
managed.Client
  └── ManagedDatabase (HTTP wrapper)
      └── HTTP request

managed.Client
  └── PlatformClient (HTTP wrapper)
      └── HTTP request
```

**Solution:** Direct HTTP wrappers, no unnecessary layers

## Code Comparison

### Managed (Thin HTTP Wrapper)

```typescript
// managed/database.ts
class ManagedDatabase {
  async query(sql, params) {
    return fetch(`${baseUrl}/api/v1/databases`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'x-database-id': databaseId
      },
      body: JSON.stringify({ query: sql, params })
    });
  }
}
```

**~170 lines total** - just HTTP requests

### Self-Hosted (Full D1 Logic)

```typescript
// database/index.ts
export const database = {
  async connect({ databaseName, dbToken, gatewayKey, schema }) {
    // Create D1 binding
    const d1 = await createD1Binding(databaseName, dbToken);
    
    // Run migrations
    await runMigrations(d1, schema);
    
    // Create ORM
    const orm = createOrm(d1, schema);
    
    return { orm, query: d1.query, ... };
  }
};
```

**~2000+ lines total** - migrations, adapters, ORM, etc.

## Usage

### Managed (Single API Key)

```typescript
import { managed } from 'kuratchi-sdk';

const client = new managed.Client({
  apiKey: process.env.KURATCHI_API_KEY,  // ← Single key
  databaseId: process.env.DATABASE_ID
});

// All routed to Kuratchi's APIs
await client.query('SELECT * FROM users');
await client.platform.databases.list();
```

### Self-Hosted (Multiple Keys)

```typescript
import { database } from 'kuratchi-sdk';

const { orm } = await database.connect({
  databaseName: 'my-db',
  dbToken: process.env.CLOUDFLARE_DB_TOKEN,      // ← Need this
  gatewayKey: process.env.CLOUDFLARE_GATEWAY_KEY, // ← And this
  schema
});

// Direct D1 operations
await orm.users.insert({ name: 'Alice' });
```

## Dogfooding

### Dashboard App (Self-Hosted)

```typescript
// apps/dashboard uses self-hosted
import { database } from 'kuratchi-sdk';

const { orm } = await database.admin();  // Uses local D1
```

**Why:** Dashboard needs direct D1 access for admin operations

### User Apps (Managed)

```typescript
// User apps use managed
import { managed } from 'kuratchi-sdk';

const client = new managed.Client({ apiKey, databaseId });
```

**Why:** Users don't want to manage Cloudflare keys

## API Endpoints

### `/api/v1/databases` (Database Operations)

```typescript
POST /api/v1/databases
Headers:
  Authorization: Bearer <kuratchi-api-key>
  x-database-id: <database-id>
  x-endpoint: /api/run | /api/exec | /api/batch | ...
Body:
  { query: "SELECT * FROM users", params: [] }
```

**Backend Flow:**
1. Validate API key
2. Look up database by ID
3. Get database token from admin DB
4. Forward to D1 worker with token
5. Return results

### `/api/v1/platform/*` (Platform Management)

```typescript
GET /api/v1/platform/databases
POST /api/v1/platform/databases
DELETE /api/v1/platform/databases
GET /api/v1/platform/databases/:id
PATCH /api/v1/platform/databases/:id
GET /api/v1/platform/databases/:id/analytics
```

**Backend Flow:**
1. Validate API key
2. Perform admin operation (create DB, get analytics, etc.)
3. Return results

## No Duplication

### Database Operations

```
managed.Client.query()
  └── ManagedDatabase.query()
      └── fetch('/api/v1/databases')

// vs

database.connect().query()
  └── D1Client.query()
      └── D1 binding (local)
```

**Different paths, no shared code** ✅

### ORM (Shared)

```
managed.Client.orm
  └── createClientFromJsonSchema()  ← Shared ORM
      └── ManagedDatabase (HTTP)

database.connect().orm
  └── createClientFromJsonSchema()  ← Same ORM
      └── D1Client (local)
```

**ORM is shared, adapters are different** ✅

## File Structure

```
kuratchi-sdk/
├── src/lib/
│   ├── managed/              ← Managed infrastructure (HTTP wrappers)
│   │   ├── database.ts       ← ~170 lines (HTTP only)
│   │   ├── platform.ts       ← ~280 lines (HTTP only)
│   │   ├── client.ts         ← ~220 lines (combines above)
│   │   └── index.ts
│   │
│   ├── database/             ← Self-hosted infrastructure (D1 logic)
│   │   ├── index.ts          ← D1 connection
│   │   ├── clients/
│   │   ├── migrations/
│   │   └── orm/
│   │
│   ├── orm/                  ← Shared ORM (works with both)
│   │   ├── kuratchi-orm.ts
│   │   └── adapters.ts
│   │
│   └── index.ts              ← Public API
│
└── apps/dashboard/
    └── src/routes/api/v1/    ← API endpoints (managed backend)
        ├── databases/        ← Database operations
        └── platform/         ← Platform management
```

## Benefits

1. **✅ Clean separation** - Managed vs self-hosted are clearly separated
2. **✅ No duplication** - Each layer has a single purpose
3. **✅ Thin wrappers** - Managed layer is just HTTP, ~670 lines total
4. **✅ Dogfooding** - Dashboard uses self-hosted, users use managed
5. **✅ Easy to maintain** - Change HTTP endpoints, managed layer updates automatically

## Summary

**Managed = Thin HTTP wrappers to Kuratchi's APIs**
- `managed/database.ts` → `/api/v1/databases`
- `managed/platform.ts` → `/api/v1/platform/*`
- `managed/client.ts` → Combines both + optional ORM

**Self-Hosted = Full D1 logic**
- `database/` → Direct D1 operations
- Migrations, adapters, full ORM

**No overlap, no duplication, clean architecture** 🎉
