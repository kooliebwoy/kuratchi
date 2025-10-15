# KuratchiClient - Batteries-Included Database Client

## Overview

`KuratchiClient` is the simplest way to use Kuratchi databases. Just provide your API key and database ID, and you get:

- ✅ **ORM** - Type-safe query builder
- ✅ **Raw SQL** - Full SQL access with parameterized queries
- ✅ **Drizzle Support** - Use Drizzle ORM if you prefer
- ✅ **Automatic Bookmarks** - Read-after-write consistency handled automatically
- ✅ **Zero Config** - No environment variables, no complex setup

## Installation

```bash
npm install kuratchi-sdk
```

## Quick Start

### With ORM (Recommended)

```typescript
import { KuratchiClient } from 'kuratchi-sdk';

// 1. Define your schema
const schema = {
  users: {
    id: { type: 'integer', primaryKey: true },
    name: { type: 'text', notNull: true },
    email: { type: 'text', unique: true },
    created_at: { type: 'text' }
  },
  posts: {
    id: { type: 'integer', primaryKey: true },
    userId: { type: 'integer', notNull: true },
    title: { type: 'text', notNull: true },
    content: { type: 'text' }
  }
};

// 2. Create client
const client = new KuratchiClient({
  apiKey: process.env.KURATCHI_API_KEY!,
  databaseId: process.env.DATABASE_ID!,
  schema
});

// 3. Destructure what you need
const { orm, query, exec, batch } = client;

// 4. Use the ORM
await orm.users.insert({
  name: 'Alice',
  email: 'alice@example.com',
  created_at: new Date().toISOString()
});

const users = await orm.users
  .where({ name: 'Alice' })
  .many();

// 5. Or use raw SQL
const result = await query('SELECT * FROM users WHERE email = ?', ['alice@example.com']);
```

### Without Schema (Raw SQL Only)

```typescript
import { KuratchiClient } from 'kuratchi-sdk';

const client = new KuratchiClient({
  apiKey: process.env.KURATCHI_API_KEY!,
  databaseId: process.env.DATABASE_ID!
});

// Create tables
await client.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  )
`);

// Insert data
await client.query(
  'INSERT INTO users (name, email) VALUES (?, ?)',
  ['Alice', 'alice@example.com']
);

// Query data
const users = await client.query('SELECT * FROM users');
console.log(users.results);
```

## Usage Patterns

### Pattern 1: Destructure Everything

```typescript
const client = new KuratchiClient({ apiKey, databaseId, schema });

// Destructure what you need
const { orm, query, exec, batch, first } = client;

// Use directly
await orm.users.insert({ name: 'Alice' });
const users = await query('SELECT * FROM users');
```

### Pattern 2: Use Client Directly

```typescript
const client = new KuratchiClient({ apiKey, databaseId, schema });

// Use via client
await client.orm.users.insert({ name: 'Alice' });
const users = await client.query('SELECT * FROM users');
```

### Pattern 3: Functional Style

```typescript
import { createKuratchiClient } from 'kuratchi-sdk';

const client = createKuratchiClient({ apiKey, databaseId, schema });
```

## API Reference

### ORM Methods

When you provide a schema, you get a fully-featured ORM:

```typescript
const { orm } = client;

// Insert
await orm.users.insert({ name: 'Alice', email: 'alice@example.com' });

// Insert many
await orm.users.insertMany([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' }
]);

// Find many
const users = await orm.users.many();
const activeUsers = await orm.users.where({ status: 'active' }).many();

// Find first
const user = await orm.users.where({ email: 'alice@example.com' }).first();

// Find by ID
const user = await orm.users.where({ id: 1 }).first();

// Update
await orm.users
  .where({ id: 1 })
  .update({ name: 'Alice Updated' });

// Delete
await orm.users
  .where({ id: 1 })
  .delete();

// Complex queries
const users = await orm.users
  .where({ 
    status: 'active',
    created_at: { gte: '2024-01-01' }
  })
  .orderBy({ created_at: 'desc' })
  .limit(10)
  .many();
```

### Raw SQL Methods

```typescript
// query() - Parameterized queries
const users = await client.query(
  'SELECT * FROM users WHERE status = ?',
  ['active']
);

// exec() - Raw SQL (DDL, multiple statements)
await client.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
  CREATE INDEX idx_name ON users(name);
`);

// batch() - Multiple queries in transaction
await client.batch([
  { query: 'INSERT INTO users (name) VALUES (?)', params: ['Alice'] },
  { query: 'INSERT INTO users (name) VALUES (?)', params: ['Bob'] },
  { query: 'UPDATE settings SET updated = 1' }
]);

// raw() - Get results as arrays
const rows = await client.raw('SELECT id, name FROM users');
// Returns: [[1, 'Alice'], [2, 'Bob']]

// first() - Get single value
const count = await client.first(
  'SELECT COUNT(*) as count FROM users',
  [],
  'count'
);
```

### Drizzle ORM Support

If you prefer Drizzle ORM, you can use it with KuratchiClient:

```typescript
import { KuratchiClient } from 'kuratchi-sdk';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// 1. Define Drizzle schema
const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique()
});

// 2. Create Kuratchi client (no schema needed for Drizzle)
const client = new KuratchiClient({
  apiKey: process.env.KURATCHI_API_KEY!,
  databaseId: process.env.DATABASE_ID!
});

// 3. Create Drizzle instance with proxy
const db = drizzle(client.getDrizzleProxy(), { schema: { users } });

// 4. Use Drizzle ORM
const allUsers = await db.select().from(users);
await db.insert(users).values({ name: 'Alice', email: 'alice@example.com' });
```

### Bookmark Management (Advanced)

Bookmarks are handled automatically, but you can control them manually if needed:

```typescript
// Get current bookmark
const bookmark = client.getBookmark();

// Save to external storage (e.g., Redis, session)
await redis.set(`session:${sessionId}:bookmark`, bookmark);

// Later: restore bookmark
const savedBookmark = await redis.get(`session:${sessionId}:bookmark`);
client.setBookmark(savedBookmark);

// Clear bookmark (start fresh)
client.clearBookmark();
```

## Real-World Examples

### Example 1: Express.js API

```typescript
import express from 'express';
import { KuratchiClient } from 'kuratchi-sdk';

const app = express();
app.use(express.json());

const schema = {
  users: {
    id: { type: 'integer', primaryKey: true },
    name: { type: 'text', notNull: true },
    email: { type: 'text', unique: true }
  }
};

const client = new KuratchiClient({
  apiKey: process.env.KURATCHI_API_KEY!,
  databaseId: process.env.DATABASE_ID!,
  schema
});

const { orm } = client;

// Create user
app.post('/users', async (req, res) => {
  const { name, email } = req.body;
  
  await orm.users.insert({ name, email });
  const user = await orm.users.where({ email }).first();
  
  res.json({ user: user.data });
});

// Get users
app.get('/users', async (req, res) => {
  const users = await orm.users.many();
  res.json({ users: users.data });
});

// Get user by ID
app.get('/users/:id', async (req, res) => {
  const user = await orm.users.where({ id: parseInt(req.params.id) }).first();
  
  if (!user.data) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({ user: user.data });
});

app.listen(3000);
```

### Example 2: Next.js API Route

```typescript
// app/api/users/route.ts
import { KuratchiClient } from 'kuratchi-sdk';
import { NextResponse } from 'next/server';

const schema = {
  users: {
    id: { type: 'integer', primaryKey: true },
    name: { type: 'text', notNull: true },
    email: { type: 'text', unique: true }
  }
};

const client = new KuratchiClient({
  apiKey: process.env.KURATCHI_API_KEY!,
  databaseId: process.env.DATABASE_ID!,
  schema
});

export async function GET() {
  const users = await client.orm.users.many();
  return NextResponse.json({ users: users.data });
}

export async function POST(request: Request) {
  const { name, email } = await request.json();
  
  await client.orm.users.insert({ name, email });
  const user = await client.orm.users.where({ email }).first();
  
  return NextResponse.json({ user: user.data });
}
```

### Example 3: Cloudflare Worker

```typescript
import { KuratchiClient } from 'kuratchi-sdk';

const schema = {
  visits: {
    id: { type: 'integer', primaryKey: true },
    path: { type: 'text' },
    timestamp: { type: 'text' }
  }
};

export default {
  async fetch(request: Request, env: Env) {
    const client = new KuratchiClient({
      apiKey: env.KURATCHI_API_KEY,
      databaseId: env.DATABASE_ID,
      schema
    });
    
    const url = new URL(request.url);
    
    // Log visit
    await client.orm.visits.insert({
      path: url.pathname,
      timestamp: new Date().toISOString()
    });
    
    // Get recent visits
    const visits = await client.orm.visits
      .orderBy({ timestamp: 'desc' })
      .limit(10)
      .many();
    
    return Response.json({ visits: visits.data });
  }
};
```

## Comparison: SDK vs Client

### Traditional SDK Approach

```typescript
import { database } from 'kuratchi-sdk';

// Requires environment variables
const { orm } = await database.client({
  databaseName: process.env.DATABASE_NAME!,
  dbToken: process.env.DB_TOKEN!,
  gatewayKey: process.env.GATEWAY_KEY!,
  schema
});

await orm.users.insert({ name: 'Alice' });
```

### New Client Approach ✨

```typescript
import { KuratchiClient } from 'kuratchi-sdk';

// Just API key + database ID
const client = new KuratchiClient({
  apiKey: process.env.KURATCHI_API_KEY!,
  databaseId: process.env.DATABASE_ID!,
  schema
});

await client.orm.users.insert({ name: 'Alice' });
```

**Benefits:**
- ✅ Simpler configuration (2 params vs 4)
- ✅ No need to manage gateway keys or database names
- ✅ Works with BaaS API (handles auth internally)
- ✅ Automatic bookmark management
- ✅ Drizzle support built-in

## TypeScript Support

Full TypeScript support with type inference:

```typescript
import { KuratchiClient, type KuratchiClientConfig } from 'kuratchi-sdk';

const config: KuratchiClientConfig = {
  apiKey: process.env.KURATCHI_API_KEY!,
  databaseId: process.env.DATABASE_ID!,
  schema: {
    users: {
      id: { type: 'integer', primaryKey: true },
      name: { type: 'text', notNull: true }
    }
  }
};

const client = new KuratchiClient(config);

// TypeScript knows about your schema
await client.orm.users.insert({
  name: 'Alice' // ✅ Type-safe
  // email: 'alice@example.com' // ❌ Error: email not in schema
});
```

## Best Practices

1. **One client per application** - Create once, reuse everywhere
2. **Use environment variables** - Never hardcode API keys
3. **Leverage ORM when possible** - Safer and more maintainable
4. **Use transactions for related writes** - Use `batch()` for atomicity
5. **Let bookmarks work automatically** - Don't manually manage unless needed

## Migration from SDK

```typescript
// Before (SDK)
import { database } from 'kuratchi-sdk';
const { orm } = await database.client({ databaseName, dbToken, gatewayKey, schema });

// After (Client)
import { KuratchiClient } from 'kuratchi-sdk';
const client = new KuratchiClient({ apiKey, databaseId, schema });
const { orm } = client;
```

That's it! Everything else works the same. 🎉
