---
title: ORM
description: Lightweight, type-safe query builder for Cloudflare D1.
---

The Kuratchi ORM is a minimal runtime query builder designed for Cloudflare D1 and Workers. It provides a fluent API with standard SQL semantics.

## Quick Start

```typescript
import { createOrmClient } from '@kuratchi/sdk';

const db = await createOrmClient({
  httpClient,
  schema: mySchema,
  databaseName: 'my-database'
});

// Query examples
const users = await db.users.many();
const user = await db.users.where({ id: '123' }).first();
await db.users.where({ id: '123' }).update({ name: 'New Name' });
```

## Features

- **Standard SQL semantics** - `where`, `orderBy`, `limit`, `offset`
- **Interchangeable chaining** - `.update(values).where({...})` or `.where({...}).update(values)`
- **JSON column handling** - Auto-serialize/deserialize JSON columns
- **Type-safe** - Full TypeScript support with schema inference
- **Lightweight** - No heavy dependencies, safe for Workers runtime

## Documentation

- [Query Builder](/orm/query-builder/) - Building queries with where, orderBy, limit, etc.
- [Mutations](/orm/mutations/) - Insert, update, and delete operations
- [Aggregates](/orm/aggregates/) - Count, exists, and distinct
- [Relationships](/orm/relationships/) - Include and eager loading
