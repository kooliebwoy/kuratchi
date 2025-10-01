---
layout: docs
---

# Database Clients

Connect to databases with typed ORM clients.

## ORM Client

```typescript
const client = database.client(
  schema,
  'org-123',
  env.KURATCHI_GATEWAY_KEY
);

const users = await client.users.all();
```

## SQL Client

```typescript
const sql = database.forDatabase('org-123', env.KURATCHI_GATEWAY_KEY);

const result = await sql.prepare('SELECT * FROM users').all();
```

## Combined Client

```typescript
const instance = database.instance();

// ORM
const users = await instance.users.all();

// SQL
const result = await instance.prepare('SELECT...').all();

// KV
await instance.kv.put('key', 'value');
```

[View ORM docs →](/docs/orm)
