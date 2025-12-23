---
title: ORM
description: Lightweight, type-safe query builder for Cloudflare D1 with native API support.
---

The Kuratchi ORM is a minimal runtime query builder designed for Cloudflare D1 and Workers. It provides a fluent API with standard SQL semantics and leverages native database APIs for optimal performance.

## Quick Start

```typescript
import { createOrmClient } from '@kuratchi/sdk';

// With explicit adapter (recommended)
const db = await createOrmClient({
  schema: mySchema,
  databaseName: 'my-database',
  bindingName: 'MY_DB',
  adapter: 'd1'  // or 'rpc'
});

// Query examples
const users = await db.users.many();
const user = await db.users.where({ id: '123' }).first();
await db.users.where({ id: '123' }).update({ name: 'New Name' });
```

## Features

- **Native API optimization** - Uses `first()`, `batch()`, `exec()` when available
- **Adapter-aware** - Works with D1, RPC, and HTTP adapters
- **Standard SQL semantics** - `where`, `orderBy`, `limit`, `offset`
- **Interchangeable chaining** - `.update(values).where({...})` or `.where({...}).update(values)`
- **JSON column handling** - Auto-serialize/deserialize JSON columns
- **Type-safe** - Full TypeScript support with schema inference
- **Lightweight** - No heavy dependencies, safe for Workers runtime

## Adapter Support

The ORM automatically uses native APIs based on the adapter:

| Adapter | `first()` | `many()` | Migrations |
|---------|-----------|----------|------------|
| D1 | `stmt.first()` | `stmt.all()` | `db.exec()` |
| RPC | `binding.first()` | `binding.run()` | `binding.exec()` |
| HTTP | `POST /api/first` | `POST /api/run` | `POST /api/exec` |

## Documentation

- [Automatic Migrations](/orm/migrations/) - How migrations are automatically accepted and run
- [Query Builder](/orm/query-builder/) - Building queries with where, orderBy, limit, etc.
- [Mutations](/orm/mutations/) - Insert, update, and delete operations
- [Aggregates](/orm/aggregates/) - Count, exists, and distinct
- [Relationships](/orm/relationships/) - Include and eager loading
