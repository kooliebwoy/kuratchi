# How Bookmarks Work in Kuratchi BaaS

## The Problem

D1 databases use eventual consistency across regions. After you write data, it might take a moment to replicate to all read replicas. This means:

```typescript
await db.users.insert({ name: 'Alice' });
const users = await db.users.where({ name: 'Alice' }).many();
// ❌ Might not see Alice yet!
```

## The Solution: Session Bookmarks

Bookmarks ensure **read-after-write consistency** for a specific session. Think of a bookmark as a "version pointer" that says "I want to read from at least this version of the database."

## How It Works Automatically

### 1. **Per-Instance Bookmark Storage**

Each database client instance maintains its own bookmark in memory:

```typescript
// packages/kuratchi-sdk/src/lib/database/clients/http-client.ts
class SessionState {
  private bookmark: string | null = null;
  
  getBookmark(): string | null {
    return this.bookmark;
  }
  
  setBookmark(bookmark: string | null): void {
    this.bookmark = bookmark;
  }
}
```

### 2. **Automatic Header Management**

Every request automatically:
- **Sends** the current bookmark (if exists) in `x-d1-bookmark` header
- **Receives** a new bookmark from the response
- **Stores** it for the next request

```typescript
// In makeRequest() function
const requestHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  // ... other headers ...
};

// Add bookmark if we have one
const bookmark = sessionState.getBookmark();
if (bookmark) {
  requestHeaders['x-d1-bookmark'] = bookmark;
}

// Make request
const response = await fetch(url, { headers: requestHeaders, ... });

// Extract and store new bookmark
const newBookmark = response.headers.get('x-d1-bookmark');
if (newBookmark) {
  sessionState.setBookmark(newBookmark);
}
```

### 3. **Flow Through the Stack**

```
User Code (ORM)
    ↓
    db.users.insert({ name: 'Alice' })
    ↓
ORM Query Builder
    ↓
    Generates SQL: "INSERT INTO users (name) VALUES (?)"
    ↓
createDoHttpAdapter(httpClient)
    ↓
    Calls: httpClient.query(sql, params)
    ↓
httpClient (from createBaasClient)
    ↓
    makeRequest('/api/run', { query, params })
    ↓
SessionState
    ↓
    Adds header: x-d1-bookmark: "v1-abc123..."
    ↓
HTTP Request to BaaS
    ↓
    POST /api/v1/databases
    Headers:
      - Authorization: Bearer API_KEY
      - x-database-id: DB_ID
      - x-d1-bookmark: v1-abc123...  ← Bookmark sent
    ↓
BaaS Server (+server.ts)
    ↓
    Forwards to Worker with bookmark
    ↓
Worker (worker-template.ts)
    ↓
    Creates D1 session: env.DB.withSession(bookmark)
    Executes query
    Returns new bookmark in response header
    ↓
BaaS Server
    ↓
    Forwards bookmark back in response header
    ↓
httpClient receives response
    ↓
SessionState.setBookmark(newBookmark)  ← Stored for next request!
    ↓
User Code
    ↓
    db.users.where({ name: 'Alice' }).many()
    ↓
    Uses stored bookmark → sees Alice immediately! ✅
```

## Multi-User Scenarios

### Scenario 1: Browser Apps (SPA)

Each user's browser has its own client instance = own bookmark:

```typescript
// User A's browser
const dbA = createBaasDatabase({
  apiKey: 'sk_live_...',
  databaseId: 'db-123',
  schema
});

await dbA.users.insert({ name: 'Alice' });
await dbA.users.many(); // Sees Alice ✅

// User B's browser (different instance)
const dbB = createBaasDatabase({
  apiKey: 'sk_live_...',
  databaseId: 'db-123',
  schema
});

await dbB.users.insert({ name: 'Bob' });
await dbB.users.many(); // Sees Bob ✅
```

**Key Point:** Each browser tab/window creates a new instance with its own `SessionState`.

### Scenario 2: Server-Side (Node.js/Backend)

**Option A: One client per request (simple)**

```typescript
// Express.js
app.post('/api/create-user', async (req, res) => {
  // Create new client for this request
  const db = createBaasDatabase({
    apiKey: process.env.KURATCHI_API_KEY,
    databaseId: process.env.DATABASE_ID,
    schema
  });
  
  await db.users.insert({ name: req.body.name });
  const users = await db.users.many(); // Consistent ✅
  
  res.json({ users });
});
```

**Option B: Shared client (advanced - for read-heavy apps)**

```typescript
// Create one shared client
const db = createBaasDatabase({
  apiKey: process.env.KURATCHI_API_KEY,
  databaseId: process.env.DATABASE_ID,
  schema
});

app.post('/api/create-user', async (req, res) => {
  // All requests share the same bookmark
  await db.users.insert({ name: req.body.name });
  const users = await db.users.many(); // Consistent ✅
  
  res.json({ users });
});
```

**Trade-off:** Shared client means all users share one bookmark. This is fine for most apps but might cause slight delays if one user's write affects another user's read timing.

### Scenario 3: Serverless Functions

Each function invocation creates a new client:

```typescript
// Cloudflare Worker / Vercel Function
export default async function handler(req: Request) {
  const db = createBaasDatabase({
    apiKey: env.KURATCHI_API_KEY,
    databaseId: env.DATABASE_ID,
    schema
  });
  
  await db.users.insert({ name: 'Alice' });
  const users = await db.users.many(); // Consistent ✅
  
  return Response.json({ users });
}
```

## When Do You Need Bookmarks?

### ✅ **Use Bookmarks (Automatic - Already Handled!)**

- User writes data and immediately reads it back
- Critical consistency (financial transactions, inventory)
- User expects to see their own changes instantly
- Sequential operations that depend on previous writes

### ❌ **Bookmarks Not Needed**

- Read-only queries
- Eventual consistency is acceptable
- Data written by background jobs, not users
- Performance > immediate consistency

## Advanced: Manual Bookmark Control

For advanced use cases, you can manually control bookmarks:

```typescript
const db = createBaasDatabase({
  apiKey: 'sk_live_...',
  databaseId: 'db-123',
  schema
});

// Get current bookmark
const bookmark = db.getBookmark();
console.log('Current bookmark:', bookmark);

// Save bookmark to external storage (e.g., Redis, session)
await redis.set(`user:${userId}:bookmark`, bookmark);

// Later: restore bookmark
const savedBookmark = await redis.get(`user:${userId}:bookmark`);
db.setBookmark(savedBookmark);

// Clear bookmark (start fresh)
db.clearBookmark();
```

## Performance Considerations

### Bookmark Overhead

- **Size:** ~50-100 bytes per bookmark
- **Latency:** No additional latency (included in existing headers)
- **Storage:** In-memory only (no database/disk storage)

### Best Practices

1. **One client per user session** - Most common pattern
2. **Don't share clients across users** - Unless you understand the trade-offs
3. **Let bookmarks work automatically** - Don't manually manage unless needed
4. **Clear bookmarks on logout** - Prevents stale bookmarks

## Summary

### **Where Bookmarks Are Stored**

```
SessionState class (in-memory)
    ↓
Inside httpClient instance
    ↓
Created by createBaasClient()
    ↓
Used by ORM adapter
    ↓
Transparent to user code
```

### **User Experience**

```typescript
// User writes this simple code:
const db = createBaasDatabase({ apiKey, databaseId, schema });

await db.users.insert({ name: 'Alice' });
const users = await db.users.many();

// Bookmarks handled automatically! ✨
// No session IDs, no manual tracking, just works!
```

### **Key Takeaway**

**Bookmarks are batteries-included!** Each client instance automatically:
- Stores its bookmark in memory
- Sends it with every request
- Updates it from every response
- Ensures read-after-write consistency

Zero configuration, zero manual management. Just create a client and use it! 🎯
