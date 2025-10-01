---
layout: docs
---

# Queries

Build complex queries with the chainable query builder API.

## Basic Queries

### Fetch All

```typescript
const result = await db.users.many();
const users = result.data; // Row[]
```

### Fetch First

```typescript
const result = await db.users
  .where({ email: 'user@example.com' })
  .first();

const user = result.data; // Row | undefined
```

### Fetch One (Exact Match)

```typescript
const result = await db.users.where({ id: 1 }).one();

// Errors if 0 or >1 rows found
if (result.success) {
  const user = result.data; // Row
}
```

### Check Existence

```typescript
const exists = await db.users
  .where({ email: 'user@example.com' })
  .exists(); // boolean
```

## Where Clauses

### Simple Equality

```typescript
await db.users.where({ active: true, role: 'admin' }).many();
```

### Comparison Operators

```typescript
await db.users.where({
  age: { gt: 18 },           // age > 18
  score: { gte: 90 },        // score >= 90
  balance: { lt: 100 },      // balance < 100
  rating: { lte: 5 },        // rating <= 5
  status: { ne: 'deleted' }  // status <> 'deleted'
}).many();
```

### LIKE Patterns

```typescript
await db.users.where({
  email: { like: '%@example.com' }
}).many();
```

### IN / NOT IN

```typescript
await db.users.where({
  role: { in: ['admin', 'moderator'] }
}).many();

await db.users.where({
  status: { notIn: ['deleted', 'banned'] }
}).many();
```

### NULL Checks

```typescript
await db.users.where({
  deletedAt: { is: null }  // IS NULL
}).many();
```

### WHERE IN Helper

```typescript
await db.users.whereIn('id', [1, 2, 3, 4, 5]).many();
```

## OR Conditions

```typescript
await db.users
  .where({ role: 'admin' })
  .orWhere({ role: 'moderator' })
  .orWhere({ permissions: { like: '%admin%' } })
  .many();
```

## Raw SQL Conditions

For complex conditions not covered by operators:

```typescript
await db.users
  .where({ active: true })
  .sql({
    query: 'createdAt > ? AND lastLogin < ?',
    params: [startDate, endDate]
  })
  .many();
```

**Security:** The ORM prevents SQL injection by:
- Blocking template literals (`${...}`)
- Blocking string concatenation
- Requiring `?` placeholders
- Warning about hardcoded values

## Ordering

### Single Column

```typescript
await db.users.orderBy('createdAt', 'desc').many();
```

### Multiple Columns

```typescript
await db.users.orderBy([
  { priority: 'desc' },
  { createdAt: 'asc' }
]).many();
```

## Pagination

```typescript
// Page 1 (first 20 items)
await db.users.limit(20).offset(1).many();

// Page 2 (next 20 items)
await db.users.limit(20).offset(2).many();
```

**Note:** `offset` is the page number, not the row offset. The ORM calculates: `(offset - 1) * limit`

## Select Columns

```typescript
await db.users
  .select(['id', 'email', 'name'])
  .where({ active: true })
  .many();
```

## Insert

### Single Row

```typescript
const result = await db.users.insert({
  email: 'user@example.com',
  name: 'John Doe',
  active: true
});
```

### Multiple Rows

```typescript
const result = await db.users.insert([
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' },
  { email: 'user3@example.com', name: 'User 3' }
]);
```

## Update

### Update Single Row

Finds the first matching row by ID and updates it:

```typescript
await db.users
  .where({ id: 1 })
  .update({ name: 'Jane Doe', active: true });
```

### Update Multiple Rows

```typescript
await db.users
  .where({ active: false })
  .updateMany({ status: 'inactive' });
```

## Delete

```typescript
await db.users.delete({ id: 1 });

// Or with where clause
await db.users.where({ active: false }).delete({});
```

## Count

```typescript
const result = await db.users.count({ active: true });
const count = result.data[0].count;
```

## Complex Example

```typescript
const result = await db.posts
  .where({ published: true })
  .where({ views: { gt: 100 } })
  .orWhere({ featured: true })
  .include({ author: true, comments: true })
  .orderBy([{ createdAt: 'desc' }])
  .limit(10)
  .offset(1)
  .many();

if (result.success) {
  const posts = result.data;
  posts.forEach(post => {
    console.log(post.title, post.author.name, post.comments.length);
  });
}
```

[Next: Learn relations →](/docs/orm/relations)
