---
layout: docs
---

# Migrations

Generate SQL migrations automatically from schema changes.

## Generate Migration

```bash
npx kuratchi-sdk migrations generate --schema=./schema.ts
```

This creates a migration file in `migrations/`.

## Apply Migrations

Migrations are applied automatically when creating a database:

```typescript
const db = await database.create({
  name: 'my-db',
  schema,
  gatewayKey: env.KURATCHI_GATEWAY_KEY
});
```

## Migration Files

```sql
-- migrations/001_initial.sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT
);

CREATE INDEX idx_users_email ON users(email);
```

## Best Practices

- ✅ Version control migrations
- ✅ Never edit applied migrations
- ✅ Test migrations in development
- ✅ Keep migrations small and focused

[View CLI docs →](/docs/cli)
