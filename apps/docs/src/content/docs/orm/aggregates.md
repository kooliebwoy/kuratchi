---
title: Aggregates
description: Count, exists, and distinct operations.
---

## exists()

Returns boolean indicating if any rows match. Uses `SELECT EXISTS()` for optimal performance.

```typescript
const hasAdmin = await db.users.where({ role: 'admin' }).exists();
// true or false
```

## count()

### Table-level count
```typescript
const result = await db.users.count({ status: true });
// { success: true, data: [{ count: 42 }] }
```

### Chainable count
```typescript
const result = await db.users.where({ status: true }).count();
// { success: true, data: 42 }
```

## distinct()

Get distinct values for a column.

```typescript
const roles = await db.users.distinct('role');
// { success: true, data: ['admin', 'member', 'viewer'] }
```

## Performance Tips

1. **Use `first()` instead of `many()[0]`** - Adds `LIMIT 1` automatically
2. **Use `exists()` for boolean checks** - Uses `SELECT EXISTS()` subquery
3. **Use `select()` to limit columns** - Reduces data transfer
4. **Use `whereIn()` for batch lookups** - Single query instead of N queries
5. **Batch inserts** - Pass array to `insert()` for single statement
