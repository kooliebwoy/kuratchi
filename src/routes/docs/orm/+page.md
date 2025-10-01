---
layout: docs
---

# ORM Overview

Kuratchi's lightweight ORM provides type-safe queries with a chainable API, built specifically for Cloudflare Workers and Durable Objects.

## Features

- ✅ Chainable query builder
- ✅ Type-safe with TypeScript
- ✅ JSON schema-based models
- ✅ Relations with `.include()`
- ✅ Advanced where clauses (eq, ne, gt, like, in, etc.)
- ✅ SQL injection protection
- ✅ JSON column auto-serialization

## Quick Start

```typescript
import { database } from 'kuratchi-sdk';

const db = database.client(schema, 'my-database', env.KURATCHI_GATEWAY_KEY);

// Simple query
const result = await db.users.many();
const users = result.data; // Row[]

// With filters
const active = await db.users
  .where({ active: true })
  .orderBy('createdAt', 'desc')
  .limit(10)
  .many();
```

## Query Methods

### Fetching Data

```typescript
// Get all rows
const result = await db.users.many();

// Get first row (or undefined)
const result = await db.users.where({ email: 'user@example.com' }).first();

// Get exactly one row (errors if 0 or >1)
const result = await db.users.where({ id: 1 }).one();

// Check if exists
const exists = await db.users.where({ email: 'user@example.com' }).exists();

// Count rows
const result = await db.users.count({ active: true });
```

### Inserting Data

```typescript
// Insert single row
await db.users.insert({
  email: 'user@example.com',
  name: 'John Doe'
});

// Insert multiple rows
await db.users.insert([
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' }
]);
```

### Updating Data

```typescript
// Update single row (finds first match by id)
await db.users
  .where({ id: 1 })
  .update({ name: 'Jane Doe' });

// Update multiple rows
await db.users
  .where({ active: false })
  .updateMany({ status: 'inactive' });
```

### Deleting Data

```typescript
await db.users.delete({ id: 1 });
```

## Where Clauses

### Simple Equality

```typescript
await db.users.where({ email: 'user@example.com' }).many();
```

### Advanced Operators

```typescript
await db.users.where({
  age: { gt: 18, lte: 65 },
  email: { like: '%@example.com' },
  status: { in: ['active', 'pending'] },
  deletedAt: { is: null }
}).many();
```

Available operators:
- `eq` - Equal
- `ne` - Not equal
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `like` - SQL LIKE pattern
- `in` - IN array
- `notIn` - NOT IN array
- `is` - IS NULL / IS NOT NULL

### OR Conditions

```typescript
await db.users
  .where({ role: 'admin' })
  .orWhere({ role: 'moderator' })
  .many();
```

### Raw SQL Conditions

```typescript
await db.users
  .where({ active: true })
  .sql({ query: 'createdAt > ?', params: [Date.now() - 86400000] })
  .many();
```

## Relations

```typescript
// One-to-many: Load user with their posts
const result = await db.users
  .where({ id: 1 })
  .include({ posts: true })
  .one();

// Many-to-one: Load post with its author
const result = await db.posts
  .where({ id: 1 })
  .include({ user: true })
  .one();
```

[Learn more about relations →](/docs/orm/relations)

## Ordering & Pagination

```typescript
// Order by column
await db.users.orderBy('createdAt', 'desc').many();

// Multiple order columns
await db.users.orderBy([
  { createdAt: 'desc' },
  { name: 'asc' }
]).many();

// Pagination
await db.users
  .orderBy('id')
  .limit(20)
  .offset(2) // Page 2 (offset is page number, not row count)
  .many();
```

## Select Specific Columns

```typescript
await db.users
  .select(['id', 'email', 'name'])
  .many();
```

## Result Format

All query methods return a `QueryResult`:

```typescript
type QueryResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const result = await db.users.many();
if (result.success) {
  const users = result.data; // Row[]
} else {
  console.error(result.error);
}
```

## Best Practices

- ✅ Always check `result.success` before using `result.data`
- ✅ Use operators (`{ age: { gt: 18 } }`) instead of raw SQL when possible
- ✅ Use `.whereIn()` for IN clauses with large arrays
- ✅ Chain methods for complex queries
- ❌ Don't bypass the ORM for simple CRUD operations
- ❌ Don't use string concatenation in `.sql()` - use params array

## Next Steps

1. [Define your schema](/docs/orm/schema)
2. [Learn advanced queries](/docs/orm/queries)
3. [Set up relations](/docs/orm/relations)
4. [Generate migrations](/docs/orm/migrations)
