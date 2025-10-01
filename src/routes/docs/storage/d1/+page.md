---
layout: docs
---

# D1 (SQL Database)

Serverless SQL database with batteries-included access and built-in ORM.

## Batteries-Included Setup

Configure D1 databases once in your auth handle:

```typescript
// src/hooks.server.ts
import { auth } from 'kuratchi-sdk';

export const handle = auth.handle({
  d1Databases: {
    default: 'MY_DB',
    analytics: 'ANALYTICS_DB'
  }
});
```

## Using the Built-in ORM (Recommended)

The SDK includes a built-in ORM for type-safe queries:

### Define Schema

```typescript
// src/lib/schema/app.ts
import type { SchemaDsl } from 'kuratchi-sdk';

export const appSchema: SchemaDsl = {
  name: 'app',
  version: 1,
  mixins: {
    timestamps: {
      created_at: 'text default now',
      updated_at: 'text default now'
    }
  },
  tables: {
    users: {
      id: 'text primary key not null',
      email: 'text not null unique',
      name: 'text',
      active: 'boolean default 1',
      '...timestamps': true
    },
    posts: {
      id: 'text primary key not null',
      userId: 'text not null -> users.id cascade',
      title: 'text not null',
      content: 'text',
      published: 'boolean default 0',
      '...timestamps': true
    }
  }
};
```

### Query with ORM

```typescript
// src/routes/+page.server.ts
import { d1 } from 'kuratchi-sdk';
import { appSchema } from '$lib/schema/app';

export async function load({ locals }) {
  // Get ORM client (automatically applies migrations)
  const orm = await d1.client('MY_DB', appSchema);
  if (!orm) return { users: [] };
  
  // Type-safe queries
  const result = await orm.users
    .where({ active: true })
    .orderBy('created_at', 'desc')
    .limit(10)
    .many();
  
  return { users: result.data || [] };
}
```

### Insert with ORM

```typescript
const orm = await d1.client('MY_DB', appSchema);
if (orm) {
  await orm.users.insert({
    id: crypto.randomUUID(),
    email: 'user@example.com',
    name: 'John Doe',
    active: true
  });
}
```

### Update with ORM

```typescript
await orm.users
  .where({ id: userId })
  .update({ name: 'Jane Doe', active: false });
```

### Delete with ORM

```typescript
await orm.users.delete({ id: userId });
```

### Relations with ORM

```typescript
// Load user with their posts
const result = await orm.users
  .where({ id: userId })
  .include({ posts: true })
  .one();

if (result.success) {
  const user = result.data;
  console.log(user.name);
  console.log(user.posts); // Array of posts
}
```

### Advanced Queries

```typescript
// Complex where clauses
const result = await orm.posts
  .where({ 
    published: true,
    userId: { in: [id1, id2, id3] }
  })
  .orWhere({ featured: true })
  .include({ user: true })
  .orderBy([{ created_at: 'desc' }])
  .limit(20)
  .offset(1)
  .many();

// Count
const countResult = await orm.users.count({ active: true });
const count = countResult.data[0].count;

// Check existence
const exists = await orm.users
  .where({ email: 'user@example.com' })
  .exists();
```

## Form Actions with ORM

```typescript
// src/routes/posts/+page.server.ts
import { d1 } from 'kuratchi-sdk';
import { appSchema } from '$lib/schema/app';
import type { Actions } from './$types';

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const orm = await d1.client('MY_DB', appSchema);
    if (!orm) {
      return { success: false, error: 'Database not available' };
    }

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;

    const result = await orm.posts.insert({
      id: crypto.randomUUID(),
      userId: locals.session?.user?.id,
      title,
      content,
      published: false
    });

    return { success: result.success };
  },

  update: async ({ request, locals }) => {
    const orm = await d1.client('MY_DB', appSchema);
    if (!orm) {
      return { success: false, error: 'Database not available' };
    }

    const formData = await request.formData();
    const id = formData.get('id') as string;
    const title = formData.get('title') as string;

    await orm.posts
      .where({ id })
      .update({ title });

    return { success: true };
  },

  delete: async ({ request, locals }) => {
    const orm = await d1.client('MY_DB', appSchema);
    if (!orm) {
      return { success: false, error: 'Database not available' };
    }

    const formData = await request.formData();
    const id = formData.get('id') as string;

    await orm.posts.delete({ id });

    return { success: true };
  }
};
```

## Raw SQL (When Needed)

You can still use raw SQL when the ORM isn't sufficient:

```typescript
// Access raw D1 database
const db = locals.kuratchi.d1.default;

if (db) {
  // Query
  const result = await db.prepare('SELECT * FROM users WHERE active = ?')
    .bind(true)
    .all();
  
  // Insert
  await db.prepare('INSERT INTO users (id, email) VALUES (?, ?)')
    .bind(id, email)
    .run();
  
  // Batch (atomic)
  await db.batch([
    db.prepare('INSERT INTO users...').bind(...),
    db.prepare('UPDATE counters...').bind(...)
  ]);
}
```

## Migrations

The ORM automatically applies migrations when you create a client:

```bash
# Generate migrations from schema
npx kuratchi-sdk migrations generate --schema src/lib/schema/app.ts

# Migrations are auto-applied on first ORM client creation
```

The SDK will:
1. Look for bundled migrations in `/migrations-{schema-name}/`
2. Track applied migrations in `migrations_history` table
3. Apply pending migrations atomically

## Multiple Databases

```typescript
// Main database with ORM
const main = await d1.client('MY_DB', appSchema);

// Analytics database with raw SQL
const analytics = locals.kuratchi.d1.analytics;
if (analytics) {
  await analytics.prepare(
    'INSERT INTO page_views (path, timestamp) VALUES (?, ?)'
  )
    .bind('/home', Date.now())
    .run();
}
```

## wrangler.toml

```toml
[[d1_databases]]
binding = "MY_DB"
database_name = "my-production-db"
database_id = "your-database-id"

[[d1_databases]]
binding = "ANALYTICS_DB"
database_name = "analytics"
database_id = "your-analytics-id"
```

## Error Handling

ORM queries return `QueryResult`:

```typescript
const result = await orm.users.many();

if (result.success) {
  const users = result.data;
} else {
  console.error(result.error);
}
```

Raw D1 always check for `null`:

```typescript
const db = locals.kuratchi.d1.default;
if (db) {
  const result = await db.prepare('SELECT...').all();
}
```

## Best Practices

- ✅ Use ORM for CRUD operations
- ✅ Use raw SQL for complex queries or performance
- ✅ Define schemas with proper types and constraints
- ✅ Use mixins for common fields (timestamps, soft delete)
- ✅ Add foreign keys with cascade for cleanup
- ✅ Use batch operations for transactions
- ❌ Don't mix ORM and raw SQL on same table without care
- ❌ Don't forget to check `result.success`

[View full ORM docs →](/docs/orm)
