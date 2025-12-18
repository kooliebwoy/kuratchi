---
title: Relationships
description: Include and eager loading related data.
---

## include()

Eager load related data in a single query batch.

### Parent (Many-to-One)

When your table has a foreign key like `userId`, include will fetch the parent:

```typescript
const posts = await db.posts.include({ user: true }).many();
// Each post will have a `user` object attached
```

### Children (One-to-Many)

When a related table has a foreign key pointing to your table:

```typescript
const users = await db.users.include({ posts: true }).many();
// Each user will have a `posts` array attached
```

### Custom Configuration

```typescript
db.posts.include({
  author: { 
    table: 'users',      // Table to query
    foreignKey: 'authorId', // FK column name
    as: 'author'         // Property name on result
  }
}).many()
```

### Include Options

| Option | Description |
|--------|-------------|
| `table` | Table name to query (defaults to key name) |
| `foreignKey` | Foreign key column name |
| `localKey` | Local key column (defaults to 'id') |
| `as` | Property name on result (defaults to key name) |

## How It Works

Include uses batched queries for efficiency:

1. Execute main query
2. Collect all foreign key values
3. Execute single `WHERE id IN (...)` query for related data
4. Map results back to parent rows

This avoids N+1 query problems while keeping the API simple.
