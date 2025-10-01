---
layout: docs
---

# Database Provisioning

Create and manage Durable Object databases.

## Create Database

```typescript
const db = await database.create({
  name: 'org-123',
  schema,
  gatewayKey: env.KURATCHI_GATEWAY_KEY
});
```

## With Migrations

```typescript
const db = await database.create({
  name: 'org-123',
  schema,
  gatewayKey: env.KURATCHI_GATEWAY_KEY,
  migrations: ['CREATE TABLE...', 'CREATE INDEX...']
});
```

## Check if Exists

```typescript
const exists = await database.exists('org-123', env.KURATCHI_GATEWAY_KEY);
```

## Delete Database

```typescript
await database.delete('org-123', env.KURATCHI_GATEWAY_KEY);
```

[Next: Use clients →](/docs/database/clients)
