# @kuratchi/js

Cloudflare Workers-native web framework with file-based routing, server actions, and Durable Object support.

## Install

```bash
npm install @kuratchi/js
```

## Quick start

```bash
npx kuratchi create my-app
cd my-app
bun run dev
```

## How it works

`kuratchi build` (or `kuratchi watch`) scans `src/routes/` and generates framework output:

| File | Purpose |
|---|---|
| `.kuratchi/routes.js` | Compiled routes, actions, RPC handlers, and render functions |
| `.kuratchi/worker.js` | Stable wrangler entry - re-exports the fetch handler plus all Durable Object and Agent classes |
| `.kuratchi/do/*.js` | Generated Durable Object RPC proxy modules for `$durable-objects/*` imports |

Point wrangler at the entry and you're done. **No `src/index.ts` needed.**

```jsonc
// wrangler.jsonc
{
  "main": ".kuratchi/worker.js"
}
```

## Routes

Place `.html` files inside `src/routes/`. The file path becomes the URL pattern.

```
src/routes/page.html          → /
src/routes/items/page.html    → /items
src/routes/blog/[slug]/page.html → /blog/:slug
src/routes/layout.html        → shared layout wrapping all routes
```

### Execution model

Kuratchi routes are server-first.

- `src/routes` defines server-rendered route modules.
- Top-level route `<script>` blocks run on the server.
- Template expressions, `if`, and `for` blocks render on the server.
- `src/server` is for private server-only modules and reusable backend logic.
- `src/server/runtime.hook.ts` is the server runtime hook entrypoint for request interception.
- Reactive `$:` code is the browser-only escape hatch.

Route files are not client files. They are server-rendered routes that can opt into small browser-side reactive behavior when needed.

### Route file structure

```html
<script>
  import { getItems, addItem, deleteItem } from '$database/items';

  const items = await getItems();
</script>

<!-- Template — plain HTML with minimal extensions -->
<ul>
  for (const item of items) {
    <li>{item.title}</li>
  }
</ul>
```

The `$database/` alias resolves to `src/database/`. You can use any path alias configured in your tsconfig.
Private server logic should live in `src/server/` and be imported into routes explicitly.

### Layout file

`src/routes/layout.html` wraps every page. Use `<slot></slot>` where page content renders:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>My App</title>
</head>
<body>
  <nav>
    <a href="/">Home</a>
    <a href="/items">Items</a>
  </nav>
  <main>
    <slot></slot>
  </main>
</body>
</html>
```

## Template syntax

### Interpolation

```html
<p>{title}</p>
<p>{@html bodyHtml}</p>  <!-- sanitized HTML -->
<p>{@raw trustedHtml}</p> <!-- unescaped, unsafe -->
```

### Conditionals

```html
if (items.length === 0) {
  <p>Nothing here yet.</p>
} else {
  <p>{items.length} items</p>
}
```

### Loops

```html
for (const item of items) {
  <li>{item.title}</li>
}
```

### Components

Import `.html` components from your `src/lib/` directory or from packages:

```html
<script>
  import Card from '$lib/card.html';
  import Badge from '@kuratchi/ui/badge.html';
</script>

<Card title="Stack">
  <Badge variant="success">Live</Badge>
</Card>
```

### Client Reactivity (`$:`)

Inside client/browser `<script>` tags in the template markup, Kuratchi supports Svelte-style reactive labels:

```html
<script>
  let users = ['Alice'];

  $: console.log(`Users: ${users.length}`);

  function addUser() {
    users.push('Bob'); // reactive update, no reassignment required
  }
</script>
```

Block form is also supported:

```html
<script>
  let form = { first: '', last: '' };

  $: {
    const fullName = `${form.first} ${form.last}`.trim();
    console.log(fullName);
  }
</script>
```

Notes:
- Route files are server-rendered by default. `$:` is the only browser-side execution primitive in a route template.
- This reactivity runs in browser scripts rendered in the template markup, not in the top server route `<script>` block.
- Object/array `let` bindings are proxy-backed automatically when `$:` is used.
- `$: name = expr` works; when replacing proxy-backed values, the compiler preserves reactivity under the hood.
- You should not need `if (browser)` style guards in normal Kuratchi route code. If browser checks become necessary outside `$:`, the boundary is likely in the wrong place.

## Form actions

Export server functions from a route's `<script>` block and reference them with `action={fn}`. The compiler automatically registers them as dispatchable actions.

```html
<script>
  import { addItem, deleteItem } from '$database/items';
</script>

<!-- Standard form — POST-Redirect-GET -->
<form action={addItem} method="POST">
  <input type="text" name="title" required />
  <button type="submit">Add</button>
</form>
```

The action function receives the raw `FormData`. Throw `ActionError` to surface a message back to the form — see [Error handling](#error-handling).

```ts
// src/database/items.ts
import { ActionError } from '@kuratchi/js';

export async function addItem(formData: FormData): Promise<void> {
  const title = (formData.get('title') as string)?.trim();
  if (!title) throw new ActionError('Title is required');
  // write to DB...
}
```

### Redirect after action

Call `redirect()` inside an action or `load()` to immediately exit and send the user to a different URL. `throw redirect()` also works, but is redundant because `redirect()` already throws:

```ts
import { redirect } from '@kuratchi/js';

export async function createItem(formData: FormData): Promise<void> {
  const id = await db.items.insert({ title: formData.get('title') });
  redirect(`/items/${id}`);
}
```

## Error handling

### Action errors

Throw `ActionError` from a form action to surface a user-facing message in the template. The error message is bound directly to the action by name — if you have multiple forms on the same page, each has its own isolated error state.

```ts
import { ActionError } from '@kuratchi/js';

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) throw new ActionError('Email and password are required');

  const user = await db.findUser(email);
  if (!user || !await verify(password, user.passwordHash)) {
    throw new ActionError('Invalid credentials');
  }
}
```

In the template, the action's state object is available under its function name:

```html
<script>
  import { signIn } from '$database/auth';
</script>

<form action={signIn}>
  (signIn.error ? `<p class="error">${signIn.error}</p>` : '')
  <input type="email" name="email" />
  <input type="password" name="password" />
  <button type="submit">Sign in</button>
</form>
```

The state object shape: `{ error?: string, loading: boolean, success: boolean }`.

- `actionName.error` — set on `ActionError` throw, cleared on next successful action
- `actionName.loading` — set by the client bridge during form submission (CSS target: `form[data-action-loading]`)
- `actionName.success` — reserved for future use

Throwing a plain `Error` instead of `ActionError` keeps the message hidden in production and shows a generic "Action failed" message. Use `ActionError` for expected validation failures; let plain errors propagate for unexpected crashes.

### Load errors

Throw `PageError` from a route's load scope to return the correct HTTP error page. Without it, any thrown error becomes a 500.

```ts
import { PageError } from '@kuratchi/js';

// In src/routes/posts/[id]/page.html <script> block:
const post = await db.posts.findOne({ id: params.id });
if (!post) throw new PageError(404);
if (!post.isPublished && !currentUser?.isAdmin) throw new PageError(403);
```

`PageError` accepts any HTTP status. The framework renders the matching custom error page (`src/routes/404.html`, `src/routes/500.html`, etc.) if one exists, otherwise falls back to the built-in error page.

```ts
throw new PageError(404);                          // → 404 page
throw new PageError(403, 'Admin only');            // → 403 page, message shown in dev
throw new PageError(401, 'Login required');        // → 401 page
```

For soft load failures where the page should still render (e.g. a widget that failed to fetch), return the error as data from `load()` and handle it in the template:

```html
<script>
  const { data: recommendations, error: recError } = await safeGetRecommendations();
</script>

(recError ? '<p class="notice">Could not load recommendations.</p>' : '')
for (const rec of (recommendations ?? [])) {
  <article>{rec.title}</article>
}
```

## Progressive enhancement

These `data-*` attributes wire up client-side interactivity without writing JavaScript.

### `data-action` — fetch action (no page reload)

Calls a server action via `fetch` and refreshes `data-refresh` targets when done:

```html
<button data-action="deleteItem" data-args={JSON.stringify([item.id])}>Delete</button>
<button data-action="toggleItem" data-args={JSON.stringify([item.id, true])}>Done</button>
```

The action function receives the args array as individual arguments:

```ts
export async function deleteItem(id: number): Promise<void> {
  await db.items.delete({ id });
}

export async function toggleItem(id: number, done: boolean): Promise<void> {
  await db.items.update({ id }, { done });
}
```

### `data-refresh` — partial refresh

After a `data-action` call succeeds, elements with `data-refresh` re-fetch their content:

```html
<section data-refresh="/items">
  for (const item of items) {
    <article>{item.title}</article>
  }
</section>
```

### `data-get` — client-side navigation

Navigate to a URL on click (respects `http:`/`https:` only):

```html
<div data-get="/items/{item.id}">Click to navigate</div>
```

### `data-poll` — polling

Refresh a section automatically on an interval (milliseconds):

```html
<div data-refresh="/status" data-poll="3000">
  {status}
</div>
```

### `data-select-all` / `data-select-item` — checkbox groups

Sync a "select all" checkbox with a group of item checkboxes:

```html
<input type="checkbox" data-select-all="todos" />

for (const todo of todos) {
  <input type="checkbox" data-select-item="todos" value={todo.id} />
}
```

## RPC

For Durable Objects, RPC is file-driven and automatic.

- Put handler logic in a `.do.ts` file.
- Exported functions in that file become RPC methods.
- Import RPC methods from `$durable-objects/<file-name-without-.do>`.
- RPC methods are still server-side code. They are exposed intentionally by the framework runtime, not because route files are client-side.

```html
<script>
  import { getOrgUsers, createOrgUser } from '$durable-objects/auth';
  const users = await getOrgUsers();
</script>

<form action={createOrgUser} method="POST">
  <input type="email" name="email" required />
  <button type="submit">Create</button>
</form>
```
## Durable Objects

Durable Object behavior is enabled by filename suffix.

- Any file ending in `.do.ts` is treated as a Durable Object handler file.
- Any file not ending in `.do.ts` is treated as a normal server module.
- No required folder name. `src/server/auth.do.ts`, `src/server/foo/bar/sites.do.ts`, etc. all work.

### Function mode (recommended)

Write plain exported functions in a `.do.ts` file. Exported functions become DO RPC methods.
Use `this.db`, `this.env`, and `this.ctx` inside those functions.

```ts
// src/server/auth/auth.do.ts
import { getCurrentUser, hashPassword } from '@kuratchi/auth';
import { redirect } from '@kuratchi/js';

async function randomPassword(length = 24): Promise<string> {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export async function getOrgUsers() {
  const result = await this.db.users.orderBy({ createdAt: 'asc' }).many();
  return result.data ?? [];
}

export async function createOrgUser(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.orgId) throw new Error('Not authenticated');

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) throw new Error('Email is required');

  const passwordHash = await hashPassword(await randomPassword(), undefined, this.env.AUTH_SECRET);
  await this.db.users.insert({ email, role: 'member', passwordHash });
  redirect('/settings/users');
}
```

Optional lifecycle exports in function mode:

- `export async function onInit()`
- `export async function onAlarm(...args)`
- `export function onMessage(...args)`

These lifecycle names are not exposed as RPC methods.

### Class mode (optional)

Class-based handlers are still supported in `.do.ts` files:

```ts
import { kuratchiDO } from '@kuratchi/js';

export default class NotesDO extends kuratchiDO {
  static binding = 'NOTES_DO';

  async getNotes() {
    return (await this.db.notes.orderBy({ created_at: 'desc' }).many()).data ?? [];
  }
}
```

Declare it in `kuratchi.config.ts` and in `wrangler.jsonc`. The compiler exports DO classes from `.kuratchi/worker.js` automatically.

```jsonc
// wrangler.jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "NOTES_DO", "class_name": "NotesDO" }]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["NotesDO"] }
  ]
}
```

## Agents

Kuratchi treats `src/server/**/*.agent.ts` as a first-class Worker export convention.

- Any `.agent.ts` file under `src/server/` is scanned during build.
- The file must export a class with either `export class MyAgent` or `export default class MyAgent`.
- The compiler re-exports that class from `.kuratchi/worker.js`, so Wrangler can bind it directly.
- `.agent.ts` files are not route modules and are not converted into `$durable-objects/*` RPC proxies.

```ts
// src/server/ai/session.agent.ts
import { Agent } from 'agents';

export class SessionAgent extends Agent {
  async onRequest() {
    return Response.json({ ok: true });
  }
}
```

```jsonc
// wrangler.jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "AI_SESSION", "class_name": "SessionAgent" }]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["SessionAgent"] }
  ]
}
```

Failure and edge behavior:

- If a `.agent.ts` file does not export a class, the build fails.
- Kuratchi only auto-discovers `.agent.ts` files under `src/server/`.
- You still need Wrangler Durable Object bindings and migrations because Agents run as Durable Objects.
## Runtime APIs

These are available anywhere in server-side route code:

```ts
import {
  getCtx,      // ExecutionContext
  getRequest,  // Request
  getLocals,   // mutable locals bag for the current request
  getParams,   // URL params ({ slug: 'foo' })
  getParam,    // getParam('slug')
  RedirectError, // redirect signal thrown by redirect()\r\n  redirect,      // redirect('/path', 302)\r\n  goto,          // same as redirect()
  goto,        // same as redirect — alias
} from '@kuratchi/js';
```

### Request helpers

For a batteries-included request layer, import pre-parsed request state from `@kuratchi/js/request`:

```ts
import { url, pathname, searchParams, slug } from '@kuratchi/js/request';

const page = pathname;
const tab = searchParams.get('tab');
const postSlug = slug;
```

- `url` is the parsed `URL` for the current request.
- `pathname` is the full path, like `/blog/hello-world`.
- `searchParams` is `url.searchParams` for the current request.
- `slug` is `params.slug` when the matched route defines a `slug` param.
- `headers`, `method`, and `params` are also exported from `@kuratchi/js/request`.
- Use `getRequest()` when you want the raw native `Request` object.

## Runtime Hook

Optional server runtime hook file. Export a `RuntimeDefinition` from `src/server/runtime.hook.ts`
to intercept requests before they reach the framework router. Use it for agent routing,
pre-route auth, or custom response/error handling.

```ts
import type { RuntimeDefinition } from '@kuratchi/js';

const runtime: RuntimeDefinition = {
  agents: {
    async request(ctx, next) {
      if (!ctx.url.pathname.startsWith('/agents/')) {
        return next();
      }

      return new Response('Agent response');
    },
  },
};

export default runtime;
```

`ctx` includes:

- `ctx.url` - parsed URL
- `ctx.request` - raw Request
- `ctx.env` - Cloudflare env bindings
- `next()` - pass control to the next handler

## Environment bindings

Cloudflare env is server-only.

- Route top-level `<script>`, route `load()` functions, server actions, API handlers, and other server modules can read env.
- Templates, components, and client `<script>` blocks cannot read env directly.
- If a value must reach the browser, compute it in the server route script and reference it in the template, or return it from `load()` explicitly.

```html
<script>
  import { env } from 'cloudflare:workers';
  const turnstileSiteKey = env.TURNSTILE_SITE_KEY || '';
</script>

if (turnstileSiteKey) {
  <div class="cf-turnstile" data-sitekey={turnstileSiteKey}></div>
}
```

Server modules can still access env directly:

```ts
import { env } from 'cloudflare:workers';

const result = await env.DB.prepare('SELECT 1').run();
```

## Framework environment

Kuratchi also exposes a framework build-mode flag:

```html
<script>
  import { dev } from '@kuratchi/js/environment';
  import { env } from 'cloudflare:workers';

  const turnstileSiteKey = dev ? '' : (env.TURNSTILE_SITE_KEY || '');
</script>
```

- `dev` is `true` for Kuratchi development builds
- `dev` is `false` for production builds
- `dev` is compile-time framework state, not a generic process env var
- `@kuratchi/js/environment` is intended for server route code, not client `$:` scripts

## `kuratchi.config.ts`

Optional. Required only when using framework integrations or Durable Objects.

```ts
import { defineConfig } from '@kuratchi/js';
import { kuratchiUiConfig } from '@kuratchi/ui/adapter';
import { kuratchiOrmConfig } from '@kuratchi/orm/adapter';
import { kuratchiAuthConfig } from '@kuratchi/auth/adapter';

export default defineConfig({
  ui: kuratchiUiConfig({ theme: 'default' }),
  orm: kuratchiOrmConfig({
    databases: {
      DB: { schema: appSchema },
      NOTES_DO: { schema: notesSchema, type: 'do' },
    },
  }),
  durableObjects: {
    NOTES_DO: {
      className: 'NotesDO',
      files: ['notes.do.ts'],
    },
  },
  auth: kuratchiAuthConfig({
    cookieName: 'kuratchi_session',
    sessionEnabled: true,
  }),
});
```

Without `kuratchi.config.ts` the compiler falls back to defaults — just drop your route files in `src/routes/` and run `kuratchi build`.

## CLI

```bash
npx kuratchi build   # one-shot build
npx kuratchi watch   # watch mode (for use with wrangler dev)
```

## Testing the Framework

Run framework tests from `packages/kuratchi-js`:

```bash
bun run test
```

Watch mode:

```bash
bun run test:watch
```

## TypeScript & Worker types

```bash
npx wrangler types
```

Then include the generated types in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["./worker-configuration.d.ts"]
  }
}
```
