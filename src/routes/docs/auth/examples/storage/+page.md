---
layout: docs
---

# Auth + Storage Example

Authentication with Cloudflare storage (KV, R2, D1) access.

## What You Get

- ✅ Everything from Simple Auth
- ✅ KV, R2, D1 bindings
- ✅ File uploads
- ✅ Caching
- ❌ No multi-tenancy

## Setup

### 1. Configure Auth with Storage

```typescript
// src/hooks.server.ts
import { createAuthHandle, sessionPlugin, storagePlugin, emailAuthPlugin } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    storagePlugin(), // Adds KV, R2, D1 to locals
    emailAuthPlugin({
      provider: 'resend',
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM
    })
  ]
});
```

### 2. Configure wrangler.toml

```toml
[[kv_namespaces]]
binding = "KV"
id = "your-kv-id"

[[r2_buckets]]
binding = "R2"
bucket_name = "your-bucket"

[[d1_databases]]
binding = "DB"
database_name = "your-db"
database_id = "your-db-id"
```

## Using Storage

### KV Example

```typescript
// src/routes/api/cache/+server.ts
export async function GET({ locals }) {
  const cached = await locals.KV.get('key');
  return new Response(cached);
}

export async function POST({ locals, request }) {
  const data = await request.text();
  await locals.KV.put('key', data, { expirationTtl: 3600 });
  return new Response('Cached');
}
```

### R2 File Upload

```typescript
// src/routes/upload/+page.server.ts
export const actions = {
  upload: async ({ request, locals }) => {
    const data = await request.formData();
    const file = data.get('file');
    
    await locals.R2.put(`uploads/${file.name}`, file.stream());
    
    return { success: true };
  }
};
```

### D1 Database

```typescript
// src/routes/api/users/+server.ts
export async function GET({ locals }) {
  const result = await locals.DB
    .prepare('SELECT * FROM users WHERE active = ?')
    .bind(true)
    .all();
    
  return Response.json(result.results);
}
```

[Next: Multi-tenant →](/docs/auth/examples/multi-tenant)
