---
title: Database Adapters
description: Configure D1, RPC, or HTTP adapters for database access.
---

Kuratchi supports multiple database adapters for different deployment scenarios. The adapter determines how the SDK communicates with your Cloudflare D1 databases.

## Adapter Types

| Adapter | Use Case | Performance | Setup |
|---------|----------|-------------|-------|
| **D1** | Direct D1 binding in Workers | Fastest | Requires D1 binding |
| **RPC** | Worker-to-Worker service binding | Fast | Requires service binding |
| **HTTP** | REST API (dev/external access) | Slower | Requires API tokens |

## D1 Adapter

Use when you have direct access to D1 bindings in your Worker.

```typescript
import { d1Adapter } from '@kuratchi/sdk/adapters';

adminPlugin({
  adminDatabase: 'ADMIN_DB',
  adminSchema,
  adapter: d1Adapter({ binding: 'ADMIN_DB' })
})
```

**wrangler.toml:**
```toml
[[d1_databases]]
binding = "ADMIN_DB"
database_name = "kuratchi-admin"
database_id = "your-database-id"
```

### Native D1 APIs

The D1 adapter uses native D1 APIs for optimal performance:

- `first()` → `binding.prepare(sql).first()` - Single row optimization
- `all()` → `binding.prepare(sql).all()` - Standard query
- `run()` → `binding.prepare(sql).run()` - INSERT/UPDATE/DELETE
- `exec()` → `binding.exec(sql)` - DDL/migrations
- `batch()` → `binding.batch([...])` - Transaction batching

## RPC Adapter

Use when accessing databases via Worker-to-Worker RPC (service bindings).

```typescript
import { rpcAdapter } from '@kuratchi/sdk/adapters';

adminPlugin({
  adminDatabase: 'admin',
  adminSchema,
  adapter: rpcAdapter({ binding: 'KURATCHI_DATABASE' })
})
```

**wrangler.toml:**
```toml
[[services]]
binding = "KURATCHI_DATABASE"
service = "kuratchi-backend"
```

### RPC Benefits

- **No tokens needed** - Direct Worker-to-Worker communication
- **Full API access** - `run`, `exec`, `batch`, `first`, `raw` methods
- **Multi-database** - Single binding serves all org databases via `dbName` parameter

## HTTP Adapter

Use for development or when direct bindings aren't available.

```typescript
import { httpAdapter } from '@kuratchi/sdk/adapters';

adminPlugin({
  adminDatabase: 'admin',
  adminSchema,
  adapter: httpAdapter({
    baseUrl: 'https://your-worker.workers.dev',
    gatewayKey: env.KURATCHI_GATEWAY_KEY
  })
})
```

### HTTP Endpoints

The HTTP adapter calls these REST endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/run` | POST | Execute query, return results |
| `/api/exec` | POST | Execute DDL (migrations) |
| `/api/batch` | POST | Batch multiple queries |
| `/api/first` | POST | Get first row only |
| `/api/raw` | POST | Raw array results |

## DatabaseContext

The `DatabaseContext` abstraction provides adapter-agnostic database access. Plugins use this interface without knowing which adapter is active.

```typescript
import { createDatabaseContext } from '@kuratchi/sdk/adapters';

const dbContext = createDatabaseContext({
  adapter: 'd1',           // 'd1', 'rpc', 'http', or 'auto'
  bindingName: 'ADMIN_DB', // Binding name in platform.env
  env: platform?.env       // Platform environment
});

// Get admin database
const adminDb = await dbContext.getAdminDatabase({
  schema: adminSchema,
  skipMigrations: false
});

// Get organization database
const orgDb = await dbContext.getOrgDatabase({
  organizationId: 'org-123',
  schema: organizationSchema,
  skipMigrations: false
});
```

### DatabaseContext Interface

```typescript
interface DatabaseContext {
  readonly adapter: 'rpc' | 'http' | 'd1' | 'do' | 'auto';
  readonly isRpc: boolean;
  
  setAdminDbGetter(getter: () => Promise<OrmClient | null>): void;
  
  getAdminDatabase(options: {
    schema: SchemaType;
    skipMigrations?: boolean;
  }): Promise<OrmClient>;
  
  getOrgDatabase(options: {
    organizationId: string;
    schema: SchemaType;
    skipMigrations?: boolean;
  }): Promise<OrmClient | null>;
  
  createOrgDatabase(options: {
    organizationId: string;
    organizationName: string;
    schema: SchemaType;
    migrate?: boolean;
  }): Promise<{ databaseName: string; organizationId: string }>;
  
  resolveDatabaseName(organizationId: string): Promise<string | null>;
}
```

## Auto-Detection

When `adapter: 'auto'` is used, the SDK detects the best adapter:

1. If `bindingName` is set and binding exists → **RPC** or **D1**
2. Otherwise → **HTTP**

```typescript
createDatabaseContext({
  adapter: 'auto',
  bindingName: 'KURATCHI_DATABASE',
  env: platform?.env
});
```

## Configuration Reference

### DatabaseContextConfig

```typescript
interface DatabaseContextConfig {
  /** Adapter type: 'rpc', 'http', 'd1', 'do', or 'auto' */
  adapter: DatabaseAdapterType;
  
  /** Binding name in platform.env (for d1, rpc, do adapters) */
  bindingName?: string;
  
  /** Platform environment (for accessing bindings) */
  env?: Record<string, any>;
  
  /** Cloudflare credentials (for HTTP mode) */
  cloudflare?: {
    accountId?: string;
    apiToken?: string;
    workersSubdomain?: string;
    gatewayKey?: string;
  };
}
```

## Migration from httpClient

The `httpClient` parameter is deprecated. Use explicit adapters instead:

**Before:**
```typescript
createOrmClient({
  httpClient,
  schema,
  databaseName: 'my-db'
})
```

**After:**
```typescript
createOrmClient({
  schema,
  databaseName: 'my-db',
  bindingName: 'MY_DB',
  adapter: 'd1'  // or 'rpc'
})
```
