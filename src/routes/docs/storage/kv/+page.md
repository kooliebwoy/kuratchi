---
layout: docs
---

# KV (Key-Value Storage)

Fast, global key-value storage with batteries-included access via `locals.kuratchi.kv`.

## Batteries-Included Setup

Configure KV namespaces once in your auth handle:

```typescript
// src/hooks.server.ts
import { auth } from 'kuratchi-sdk';

export const handle = auth.handle({
  kvNamespaces: {
    default: 'MY_KV',        // Maps 'default' to MY_KV binding
    cache: 'CACHE_KV',       // Multiple namespaces
    sessions: 'SESSION_STORE'
  }
});
```

## Access in Routes

```typescript
// src/routes/+page.server.ts
export async function load({ locals }) {
  const kv = locals.kuratchi.kv.default;
  
  if (kv) {
    const value = await kv.get('my-key', { type: 'json' });
    return { value };
  }
}
```

## Basic Operations

### Get

```typescript
const kv = locals.kuratchi.kv.default;
if (kv) {
  // Get as text
  const text = await kv.get('key');
  
  // Get as JSON
  const data = await kv.get('key', { type: 'json' });
  
  // Get as ArrayBuffer
  const buffer = await kv.get('key', { type: 'arrayBuffer' });
  
  // Get as Stream
  const stream = await kv.get('key', { type: 'stream' });
}
```

### Put

```typescript
// Simple put
await kv.put('key', 'value');

// Put JSON
await kv.put('key', JSON.stringify({ foo: 'bar' }));

// Put with expiration (60 seconds)
await kv.put('key', 'value', { expirationTtl: 60 });

// Put with metadata
await kv.put('key', 'value', {
  metadata: { userId: 123, type: 'cache' }
});
```

### Delete

```typescript
await kv.delete('key');
```

### List

```typescript
// List all keys
const { keys } = await kv.list();

// List with prefix
const { keys } = await kv.list({ prefix: 'user:' });

// List with limit
const { keys, cursor } = await kv.list({ limit: 100 });
```

## Form Actions

```typescript
// src/routes/cache/+page.server.ts
import type { Actions } from './$types';

export const actions: Actions = {
  set: async ({ request, locals }) => {
    const kv = locals.kuratchi.kv.cache;
    if (!kv) {
      return { success: false, error: 'KV not available' };
    }

    const formData = await request.formData();
    const key = formData.get('key') as string;
    const value = formData.get('value') as string;

    await kv.put(key, value, { expirationTtl: 3600 });

    return { success: true };
  }
};
```

## Multiple Namespaces

```typescript
const main = locals.kuratchi.kv.default;
const cache = locals.kuratchi.kv.cache;
const sessions = locals.kuratchi.kv.sessions;

if (cache) {
  await cache.put('page-data', data, { expirationTtl: 300 });
}

if (sessions) {
  await sessions.put(`session:${id}`, sessionData, { expirationTtl: 86400 });
}
```

## wrangler.toml

```toml
[[kv_namespaces]]
binding = "MY_KV"
id = "your-kv-namespace-id"

[[kv_namespaces]]
binding = "CACHE_KV"
id = "your-cache-kv-id"

[[kv_namespaces]]
binding = "SESSION_STORE"
id = "your-session-kv-id"
```

## Error Handling

Always check for `null`:

```typescript
const kv = locals.kuratchi.kv.default;
if (kv) {
  await kv.put('key', 'value');
} else {
  console.log('KV not available, skipping cache');
}
```

## Use Cases

- ✅ Session storage
- ✅ Caching API responses
- ✅ Rate limiting
- ✅ Feature flags
- ✅ User preferences
- ✅ Temporary data

## Best Practices

- ✅ Use expiration for temporary data
- ✅ Add prefixes for organization (`user:123:settings`)
- ✅ Store metadata for context
- ❌ Don't use for large files (use R2)
- ❌ Don't expect immediate consistency

[Learn about R2 →](/docs/storage/r2)
