# Storage (KV, R2, D1)

Kuratchi surfaces your Cloudflare bindings through the auth handle so you can access KV, R2, and D1 from server routes without touching `platform.env`. The helpers mirror the runtime code in `src/lib/kv`, `src/lib/r2`, and `src/lib/database`.

## Configure bindings

Map friendly names to wrangler bindings when creating the SDK. The same names are exposed under `locals.kuratchi` and are used by the helper functions.

```ts
// src/hooks.server.ts
import { kuratchi } from 'kuratchi-sdk';
import { sessionPlugin } from 'kuratchi-sdk/auth';

const app = kuratchi({
  auth: { plugins: [sessionPlugin()] },
  storage: {
    kv: { cache: 'CACHE_KV', default: 'APP_KV' },
    r2: { uploads: 'USER_UPLOADS' },
    d1: { analytics: 'ANALYTICS_DB' }
  }
});

export const handle = app.handle;
```

## KV helpers

The KV module automatically reads from the current `platform.env` and warns (instead of throwing) when bindings are missing.

```ts
import { kv } from 'kuratchi-sdk';

await kv.put('default', 'welcome', 'Hello world');
const value = await kv.get('default', 'welcome');
await kv.delete('default', 'welcome');
const keys = await kv.list('default', { prefix: 'user:' });
```

Within SvelteKit endpoints you can also use the bound namespaces directly via `locals.kuratchi.kv.cache` (name matches the config).

## R2 helpers

```ts
import { r2 } from 'kuratchi-sdk';

const bucket = await r2.bucket('uploads');
if (!bucket) throw new Error('R2 binding missing');

await bucket.put('avatars/alice.png', fileStream, {
  httpMetadata: { contentType: 'image/png' }
});

const avatar = await bucket.get('avatars/alice.png');
```

`r2.bucket(name)` resolves the binding and returns `null` if the binding is unavailable.

## D1 bindings

When you register D1 bindings under `storage.d1`, they are available as `locals.kuratchi.d1.<name>` inside server routes and hooks. The helpers in `kuratchi-sdk/database` already cover D1 access over HTTP for org databases; use the raw bindings for extra, non-org databases you expose via wrangler.
