# Kuratchi Web App

Kuratchi platform dashboard and API — built with `@kuratchi/js`.

## Routes

Routes live in `src/routes/`. The framework uses file-based routing with two route types:

### HTML Routes (Pages)

`.html` files render server-side pages. Import request state from the `kuratchi:request` virtual module:

```html
<script>
  import { url, pathname, searchParams, params } from 'kuratchi:request';

  const { id } = params;           // Route params like [id] segments
  const tab = searchParams.get('tab');  // Query string params
</script>
```

**Available exports from `kuratchi:request`:**

| Export | Type | Description |
|--------|------|-------------|
| `url` | `URL` | Parsed URL for the current request |
| `pathname` | `string` | Full path, e.g. `/databases/abc123` |
| `searchParams` | `URLSearchParams` | Query string params |
| `params` | `Record<string, string>` | Matched route params |
| `slug` | `string \| undefined` | Shorthand for `params.slug` |
| `headers` | `Headers` | Request headers |
| `method` | `string` | HTTP method |
| `locals` | `App.Locals` | Request-scoped locals (typed via `app.d.ts`) |

### Virtual Modules

Kuratchi provides virtual modules for request-scoped state. The compiler rewrites these to the appropriate runtime paths:

| Virtual Module | Description |
|----------------|-------------|
| `kuratchi:request` | Request state: `url`, `params`, `searchParams`, `headers`, `locals`, etc. |
| `kuratchi:navigation` | Server-side redirect helper |

**Server-side redirect from `kuratchi:navigation`:**

```ts
import { redirect } from 'kuratchi:navigation';

// Redirect to another page (throws RedirectError, caught by framework)
redirect('/dashboard');
redirect('/login', 302);
```

`redirect()` works in route scripts, `$server/` modules, and form actions. It throws a `RedirectError` that the framework catches and converts to a proper HTTP redirect response.

### API Routes

`.ts` files export HTTP method handlers. Use `RouteContext` for typed access:

```ts
import type { RouteContext } from '@kuratchi/js';

export async function GET(ctx: RouteContext): Promise<Response> {
  const { id } = ctx.params;      // Route params
  const { request, env } = ctx;   // Request and Cloudflare env
  
  return new Response(JSON.stringify({ id }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(ctx: RouteContext): Promise<Response> {
  const body = await ctx.request.json();
  // ...
}
```

**RouteContext properties:**

| Property | Type | Description |
|----------|------|-------------|
| `request` | `Request` | Native Request object |
| `params` | `Record<string, string>` | Matched route params |
| `env` | `Env` | Cloudflare environment bindings |
| `url` | `URL` | Parsed request URL |

## Route Param Patterns

| Pattern | Example Path | Params |
|---------|--------------|--------|
| `[id]` | `/databases/abc123` | `{ id: 'abc123' }` |
| `[...key]` | `/r2/bucket/path/to/file.txt` | `{ key: 'path/to/file.txt' }` |

## Directory Structure

```
src/routes/
├── index.html              # Dashboard home
├── layout.html             # Root layout (wraps all pages)
├── account/
│   └── tokens/index.html   # Token management
├── api/
│   └── v1/
│       ├── [dbName]/index.ts       # Database query API
│       ├── kv/[kvName]/index.ts    # KV operations API
│       ├── r2/[r2Name]/index.ts    # R2 operations API
│       └── platform/               # Platform management APIs
├── databases/
│   ├── index.html                  # Database list
│   └── [id]/
│       ├── layout.html             # Database detail layout
│       ├── index.html              # Database overview
│       └── studio/index.html       # SQL studio
├── kv/
│   ├── index.html                  # KV namespace list
│   └── [id]/index.html             # KV namespace detail
├── r2/
│   ├── index.html                  # R2 bucket list
│   └── [id]/
│       ├── index.html              # R2 bucket detail
│       └── files/[...key]/index.ts # R2 file download proxy
└── sites/
    ├── index.html                  # Sites list
    └── [id]/index.html             # Site detail
```

## Type Safety

Define `App.Locals` in `src/app.d.ts` for typed request-scoped state:

```ts
declare global {
  namespace App {
    interface Locals {
      userId: string;
      organizationId: string;
    }
  }
}

export {};
```

Then access via `locals` or `getLocals()` from `@kuratchi/js/request`.

## Server Modules

Server-only code lives in `src/server/`. Import with `$server/` alias:

```html
<script>
  import { getCurrentUser } from '$server/database/auth';
  import { getDatabases } from '$server/database/databases';
  
  const user = await getCurrentUser();
  const databases = user ? await getDatabases() : [];
</script>
```

## Isomorphic Modules

Isomorphic code lives in `src/lib/`. Import with `$lib/` alias — works in both server templates and client scripts:

```html
<script>
  import { formatBytes } from '$lib/format';
  import { getFiles } from '$server/files';
  
  const files = await getFiles();
</script>

for (const file of files) {
  <div>{file.name} - {formatBytes(file.size)}</div>
}
```

For browser-only DOM manipulation, use inline `<script type="module">` blocks:

```html
<!-- Client-side script - runs in browser -->
<script type="module">
import { handleUploadSubmit } from '$lib/sites/upload-form';

document.querySelector('form').addEventListener('submit', handleUploadSubmit);
</script>
```

## Form Actions

Export server functions and reference them with `action={fn}`:

```html
<script>
  import { deleteDatabase } from '$server/database/databases';
</script>

<form action={deleteDatabase} method="POST">
  <input type="hidden" name="id" value={database.id} />
  <button type="submit">Delete</button>
</form>

if (deleteDatabase.error) {
  <p class="error">{deleteDatabase.error}</p>
}
```

## Development

```bash
bun run dev
```

## Build

```bash
bun run build
```
