---
title: Query Builder
description: Building queries with where, orderBy, limit, and more.
---

## Query Methods

### `many()`
Returns all rows matching the current query.

```typescript
const users = await db.users.many();
// { success: true, data: User[] }
```

### `first()`
Returns the first matching row or undefined. Uses native `first()` API when available for optimal performance.

```typescript
const user = await db.users.where({ email: 'test@example.com' }).first();
// { success: true, data: User | undefined }
```

**Native API optimization:** When using D1 or RPC adapters, `first()` calls the native `stmt.first()` method which is more efficient than fetching all rows and taking the first one.

### `one()`
Returns exactly one row. Fails if zero or multiple rows match.

```typescript
const user = await db.users.where({ id: '123' }).one();
// { success: true, data: User } or { success: false, error: 'Not found' }
```

## Where Clauses

### `where(filter)`
Add WHERE conditions. Multiple calls are AND'ed together.

```typescript
db.users.where({ status: true }).where({ role: 'admin' })
// WHERE status = true AND role = 'admin'
```

### `orWhere(filter)`
Add OR conditions.

```typescript
db.users.where({ role: 'admin' }).orWhere({ role: 'owner' })
// WHERE role = 'admin' OR role = 'owner'
```

### `whereAny(conditions)`
Add parenthetical OR group within AND context.

```typescript
db.users.where({ status: true }).whereAny([{ role: 'admin' }, { role: 'owner' }])
// WHERE status = true AND (role = 'admin' OR role = 'owner')
```

### `whereIn(column, values)`
Add IN clause.

```typescript
db.users.whereIn('id', ['1', '2', '3'])
// WHERE id IN ('1', '2', '3')
```

## Where Operators

```typescript
// Equality (default)
{ status: true }
{ name: 'John' }

// Comparison operators
{ age: { gt: 18 } }       // >
{ age: { gte: 18 } }      // >=
{ age: { lt: 65 } }       // <
{ age: { lte: 65 } }      // <=
{ name: { ne: 'Admin' } } // <>

// Pattern matching
{ name: { like: '%john%' } }
{ email: '%@gmail.com' }  // Auto-detected LIKE

// IN / NOT IN
{ role: { in: ['admin', 'owner'] } }
{ status: { notIn: ['deleted', 'banned'] } }

// NULL checks
{ deleted_at: { isNull: true } }
{ deleted_at: { isNullish: true } }
```

## Ordering & Pagination

### `orderBy(order)`
Sort results.

```typescript
db.users.orderBy('created_at')
db.users.orderBy({ created_at: 'desc' })
db.users.orderBy([{ name: 'asc' }, { created_at: 'desc' }])
```

### `limit(n)`
Limit number of results.

```typescript
db.users.limit(10).many()
```

### `offset(n)`
Skip rows (1-indexed page number when used with limit).

```typescript
db.users.limit(10).offset(2).many() // Page 2
```

## Column Selection

### `select(columns)`
Select specific columns.

```typescript
db.users.select(['id', 'name', 'email']).many()
```

## Raw SQL

### `sql(condition)`
Add raw SQL condition (use with caution).

```typescript
db.users.sql({ query: 'created_at > ?', params: ['2024-01-01'] })
```

## Error Handling

All methods return a `QueryResult` object:

```typescript
interface QueryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

Example:

```typescript
const result = await db.users.where({ id }).first();

if (!result.success) {
  console.error('Query failed:', result.error);
  return;
}

if (!result.data) {
  console.log('User not found');
  return;
}

console.log(result.data.name);
```
