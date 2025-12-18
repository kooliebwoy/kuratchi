---
title: Mutations
description: Insert, update, and delete operations.
---

## Insert

### `insert(values)`
Insert one or more rows.

```typescript
// Single insert
await db.users.insert({ id: '123', name: 'John', email: 'john@example.com' });

// Batch insert
await db.users.insert([
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' }
]);
```

## Update

Updates support interchangeable chaining - both patterns work:

### Where First
```typescript
await db.users.where({ id: '123' }).update({ name: 'New Name' });
```

### Update First
```typescript
await db.users.update({ name: 'New Name' }).where({ id: '123' });
```

### `updateMany(values)`
Update all rows matching the where clause.

```typescript
await db.users.where({ status: false }).updateMany({ 
  deleted_at: new Date().toISOString() 
});
```

### Single vs Many
- `update()` - Fetches first matching row, updates by `id` if present
- `updateMany()` - Updates all matching rows directly

## Delete

Deletes also support interchangeable chaining:

### With Where Object
```typescript
await db.users.delete({ id: '123' });
```

### Chainable
```typescript
await db.users.where({ id: '123' }).delete();
```

**Safety:** Chainable `delete()` requires a where clause and will fail without one.

## JSON Columns

JSON columns are automatically serialized on insert/update and deserialized on read:

```typescript
// Schema definition
{
  name: 'settings',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'preferences', type: 'json' }
  ]
}

// Usage - objects are auto-serialized
await db.settings.insert({
  id: '1',
  preferences: { theme: 'dark', notifications: true }
});

// Reading - auto-deserialized
const result = await db.settings.first();
console.log(result.data.preferences.theme); // 'dark'
```
