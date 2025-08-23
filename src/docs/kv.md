# KV Guide

This guide covers provisioning Cloudflare KV namespaces with Kuratchi and using them at runtime.

- Kuratchi KV class: `src/lib/kv/kuratchi-kv.ts`

## Prerequisites

- Cloudflare account with KV enabled
- API Token with KV + Workers permissions
- Your Workers subdomain, e.g. `example.workers.dev`

## Instantiate Kuratchi

```ts
import { Kuratchi } from 'kuratchi';

const kuratchi = new Kuratchi({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  workersSubdomain: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN!,
});
```

## Create a namespace

```ts
const { namespace, apiToken } = await kuratchi.kv.createNamespace('acme-kv');
```

- Returns the created KV namespace and an API token injected as a Worker secret bound to that namespace.
- Kuratchi deploys a Worker named after the namespace title and waits for the endpoint to be responsive.

## Connect to an existing namespace

```ts
const ns = kuratchi.kv.namespace({
  namespaceName: namespace.title, // or a known name you used when creating
  apiToken, // the token returned above or previously stored
});
```

Exposed methods on `ns`:
- `get(key, { json?, cacheTtl? })`
- `put(key, value, { expiration?, expirationTtl?, metadata? })`
- `delete(key)`
- `list({ prefix?, limit?, cursor? })`

### Examples

```ts
// put string
await ns.put('greeting', 'hello');

// put JSON
await ns.put('user:1', { id: 1, email: 'a@acme.com' });

// get string
const s = await ns.get<string>('greeting');

// get JSON
const u = await ns.get<{ id: number; email: string }>('user:1', { json: true });

// list with prefix
const page1 = await ns.list({ prefix: 'user:' });
if (!page1.list_complete && page1.cursor) {
  const page2 = await ns.list({ prefix: 'user:', cursor: page1.cursor });
}

// delete
await ns.delete('greeting');
```

## Deleting a namespace

```ts
await kuratchi.kv.deleteNamespace('<namespace-id>');
```

## Notes
- Keep API tokens secret. Do not expose in browser bundles.
- The Worker endpoint is `https://<namespaceTitle>.<workersSubdomain>`.
- The HTTP API is intentionally minimal (get/put/delete/list) and protected by the `API_KEY` secret.
