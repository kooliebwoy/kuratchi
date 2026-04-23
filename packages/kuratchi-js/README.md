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
| `.kuratchi/routes.ts` | Compiled routes, actions, RPC handlers, and render functions |
| `.kuratchi/worker.ts` | Stable wrangler entry - re-exports the fetch handler plus all Durable Object and Agent classes |
| `.kuratchi/do/*.ts` | Generated Durable Object RPC proxy modules for `.do.ts` file imports |

Point wrangler at the entry and you're done. **No `src/index.ts` needed.**

For the framework's internal compiler/runtime orchestration and tracked implementation roadmap, see [ARCHITECTURE.md](./ARCHITECTURE.md).

```jsonc
// wrangler.jsonc
{
  "main": ".kuratchi/worker.ts"
}
```

## Routes

Place `.kuratchi` files inside `src/routes/`. The file path becomes the URL pattern.

```
src/routes/index.kuratchi          → /
src/routes/items/index.kuratchi    → /items
src/routes/blog/[slug]/index.kuratchi → /blog/:slug
src/routes/layout.kuratchi        → shared layout wrapping all routes
```

> **File extension:** Route files MUST use `.kuratchi` (not `.html`). The compiler only discovers files ending in `.kuratchi`; plain `.html` files in `src/routes/` are ignored. Use `.html` only for static assets served from `src/assets/`, or for UI component files imported via `$lib/*.html` / `@kuratchi/ui/*.html`.

### Execution model

Kuratchi routes are SSR by default, with a client-first authored `<script>` model.

- `src/routes` defines server-rendered route modules.
- Top-level route `<script>` blocks are client-side by default.
- `$server/*` imports are the server/RPC escape hatch.
- Template expressions, `if`, and `for` blocks render on the server.
- `src/server` is for private server-only modules and reusable backend logic.
- `src/middleware.ts` is the request middleware entrypoint for interception and guards.
- Reactive `$:` code runs in client scripts.

Route files still render on the server, but the authored script model matches the web: write client code in `<script>`, and use `$server/*` when you need the framework to cross into server execution.

### Route file structure

```html
<script>
  import { getItems, addItem, deleteItem } from '$server/items';

  const items = await getItems();
</script>

<!-- Template — plain HTML with minimal extensions -->
<ul>
  for (const item of items) {
    <li>{item.title}</li>
  }
</ul>
```

The `$server/` alias resolves to `src/server/`. Use that as the canonical home for reusable server-only modules.
Private server logic should live in `src/server/` and be imported into routes explicitly.

### Static assets (`src/assets`)

Put plain CSS, images, and other static files in `src/assets/`.

Kuratchi mirrors that directory into the generated public assets output and keeps Wrangler's `assets.directory` in sync automatically, so you can reference files with `/assets/...` by default.

```html
<link rel="stylesheet" href="/assets/app.css" />
```

If you want a different public URL prefix, set `assetsPrefix` in `kuratchi.config.ts`:

```ts
import { defineConfig } from '@kuratchi/js';

export default defineConfig({
  assetsPrefix: '/static/',
});
```

Then reference the same file at `/static/...`.

### Server-side asset access

Use the `kuratchi:assets` virtual module when server code needs to read a static asset through the app's configured `ASSETS` binding.

```ts
import { fetchAsset } from 'kuratchi:assets';

const response = await fetchAsset('/reports/q126_breakdown_by_product_devplat.csv');
if (!response.ok) return null;
const csv = await response.text();
```

Pass the same public URL path you would use in markup, not the source file path. For example, if the asset is reachable in the browser at `/reports/data.csv`, pass `/reports/data.csv`.

Behavior:

- Uses the current request origin in dev so asset fetches behave the same way as the running app.
- Falls back to an internal asset hostname when there is no active request context.
- Returns the raw `Response` so your code controls parsing (`text()`, `json()`, `arrayBuffer()`, headers, status handling).

Failure behavior:

- Throws if the app does not have an `ASSETS` binding configured.
- Does not coerce missing assets into `null`; check `response.ok` yourself and handle 404/403/other statuses explicitly.

### CSS processing

CSS files in `src/assets/` can be processed during build. All CSS tooling is **opt-in** — install only what you need.

#### Minification

To enable CSS minification via [Lightning CSS](https://lightningcss.dev/):

```bash
npm install lightningcss
```

Minification is automatic in production builds when `lightningcss` is installed.

#### Tailwind CSS

To enable Tailwind, install the required packages and configure in `kuratchi.config.ts`:

```bash
npm install tailwindcss @tailwindcss/postcss postcss
```

```ts
import { defineConfig } from '@kuratchi/js';

export default defineConfig({
  css: {
    tailwind: true,
    plugins: ['daisyui'],  // optional Tailwind plugins
  },
});
```

Then use Tailwind's CSS-first configuration in your CSS file:

```css
/* src/assets/app.css */
@import "tailwindcss";
@plugin "daisyui";
```

#### CSS config options

```ts
css: {
  tailwind: boolean;     // Enable Tailwind processing (default: false)
  plugins: string[];     // Tailwind plugins to load (default: [])
  minify: boolean;       // Enable minification (default: true in production, requires lightningcss)
}
```

### Layout file

`src/routes/layout.kuratchi` wraps every page. Use `<slot></slot>` where page content renders:

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

### Attribute expressions

Use `{expression}` in attribute values for dynamic content:

```html
<!-- Ternary expressions -->
<div class={isActive ? 'active' : 'inactive'}>...</div>
<button class={count > 0 ? 'has-items' : ''}>View ({count})</button>

<!-- Any JS expression -->
<a href={`/items/${item.id}`}>{item.name}</a>
<img src={user.avatar} alt={user.name} />
```

### Boolean attributes

Boolean attributes like `disabled`, `checked`, `selected`, etc. are conditionally rendered based on the expression value:

```html
<!-- Renders: <button disabled> or <button> -->
<button disabled={isLoading}>Submit</button>

<!-- Form elements -->
<input type="checkbox" checked={todo.completed} />
<option selected={item.id === selectedId}>{item.name}</option>

<!-- Other boolean attributes -->
<details open={showDetails}>...</details>
<input readonly={!canEdit} />
<input required={isRequired} />
```

Supported boolean attributes: `disabled`, `checked`, `selected`, `readonly`, `required`, `hidden`, `open`, `autofocus`, `autoplay`, `controls`, `default`, `defer`, `formnovalidate`, `inert`, `loop`, `multiple`, `muted`, `novalidate`, `reversed`, `async`.

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

### Component Props

Components receive props via a `props` object. Destructure in the component's `<script>` block:

```html
<!-- src/lib/card.html -->
<script>
  const { title, class: className = '', variant = 'default' } = props;
</script>

<div class="card {className}" data-variant={variant}>
  if (title) {
    <h2>{title}</h2>
  }
  <slot></slot>
</div>
```

**Usage:**
```html
<Card title="Hello" variant="primary" class="my-card">
  <p>Card content</p>
</Card>
```

**Props patterns:**
- Destructure from `props` with defaults: `const { title, size = 'md' } = props;`
- Access directly: `{props.title}` or `data-variant={props.variant}`
- Use `class:` for className (reserved word): `const { class: className = '' } = props;`
- Children go in `<slot></slot>` (renders as `props.children`)

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
- Route files are server-rendered by default.
- `$:` runs in client scripts rendered in the template markup.
- Object/array `let` bindings are proxy-backed automatically when `$:` is used.
- `$: name = expr` works; when replacing proxy-backed values, the compiler preserves reactivity under the hood.
- You should not need `if (browser)` style guards in normal Kuratchi route code. If browser checks become necessary outside `$:`, the boundary is likely in the wrong place.

### `$lib/` Isomorphic Imports

Use `$lib/*` for isomorphic code that works in both server templates and client scripts. The `$lib/` alias resolves to `src/lib/`.

```ts
// src/lib/format.ts
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
```

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

**Key behavior:**
- `$lib/` imports work in server templates (SSR) AND client scripts
- Use for utilities, formatters, validators, and DOM helpers
- Client scripts in template body are executed on the client

### Client-Side DOM Manipulation

For browser-only code, use normal `<script>` blocks in the template body:

```html
<script>
  import { getMessages } from '$server/chat';
  const messages = await getMessages(chatId);
</script>

<div id="messages">
  for (const msg of messages) {
    <div>{msg.content}</div>
  }
</div>

<!-- Client-side script - runs in browser -->
<script>
import { initChatUI } from '$lib/chat-ui';

const chatId = window.location.pathname.split('/').pop();
initChatUI(chatId);
</script>
```

Behavior:
- Inline client `<script>` blocks are bundled with esbuild
- Kuratchi adds `type="module"` for you when the script contains ES module imports
- `$lib/` imports are resolved and bundled for the browser
- `$server/` imports in client scripts become RPC stubs (future feature)

Failure and edge behavior:
- Namespace imports like `import * as api from '$server/foo'` are currently rejected in browser code.
- Remote call failures reject with the server error message when available, otherwise `HTTP <status>`.

### Awaited remote reads

For renderable remote reads, use direct `await fn(args)` markup. Kuratchi lowers it to a route query, renders it on the server, and refreshes it after successful remote calls.

```html
<script>
  import { getMigrationConnectionStatus } from '$server/incus';
</script>

<p>{await getMigrationConnectionStatus(sourceIp)}</p>
```

Behavior:
- The read runs during the initial server render.
- Kuratchi emits refresh metadata so the same block can be re-fetched without a full page reload.
- Successful remote calls automatically invalidate awaited reads on the current page.

Failure and edge behavior:
- The supported syntax is direct markup form: `{await fn(args)}`.
- Awaited reads are intended for values that render cleanly to text/HTML output.
- Complex promise expressions or chained property access should be wrapped in a dedicated server helper that returns the render-ready value.

## Form actions

Export server functions from a route's `<script>` block and reference them with `action={fn}`. The compiler automatically registers them as dispatchable actions.

```html
<script>
  import { addItem, deleteItem } from '$server/items';
</script>

<!-- Standard form — POST-Redirect-GET -->
<form action={addItem} method="POST">
  <input type="text" name="title" required />
  <button type="submit">Add</button>
</form>
```

The action function receives the raw `FormData`. Throw `ActionError` to surface a message back to the form — see [Error handling](#error-handling).

```ts
// src/server/items.ts
import { ActionError } from '@kuratchi/js';

export async function addItem({ formData }: FormData): Promise<void> {
  const title = (formData.get('title') as string)?.trim();
  if (!title) throw new ActionError('Title is required');
  // write to DB...
}
```

### Redirect after action

Call `redirect()` inside an action or `load()` to immediately exit and send the user to a different URL. `throw redirect()` also works, but is redundant because `redirect()` already throws:

```ts
import { redirect } from '@kuratchi/js';

export async function createItem({ formData }: FormData): Promise<void> {
  const id = await db.items.insert({ title: formData.get('title') });
  redirect(`/items/${id}`);
}
```

## Error handling

### Action errors

Throw `ActionError` from a form action to surface a user-facing message in the template. The error message is bound directly to the action by name — if you have multiple forms on the same page, each has its own isolated error state.

```ts
import { ActionError } from '@kuratchi/js';

export async function signIn({ formData }: FormData) {
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
  import { signIn } from '$server/auth';
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

// In src/routes/posts/[id]/index.html <script> block:
import { params } from '@kuratchi/js/request';

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

## Async Values

Kuratchi provides a native JS pattern for handling async data with loading, error, and success states.

### Two Patterns

| Pattern | Returns | Use case |
|---------|---------|----------|
| `const x = fn()` | `AsyncValue<T>` | Need loading/error states |
| `const x = await fn()` | `T` | Just need the value (blocks) |

### AsyncValue API

When you call an async function without `await`, it returns an `AsyncValue<T>` with metadata:

```ts
interface AsyncValue<T> extends T {
  pending: boolean;   // true while loading
  error: string | null; // error message if failed
  success: boolean;   // true when resolved
}
```

### Usage

```html
<div>
const todos = getTodos();

if (todos.pending) {
  <div class="skeleton">Loading...</div>
}

if (todos.error) {
  <p class="error">Failed: {todos.error}</p>
}

for (const todo of todos) {
  <TodoItem todo={todo} />
}
</div>
```

With `if/else`:

```html
<div>
const todos = getTodos();

if (todos.pending) {
  <Skeleton />
} else if (todos.error) {
  <p>Failed: {todos.error}</p>
} else if (todos.length > 0) {
  for (const todo of todos) {
    <TodoItem todo={todo} />
  }
} else {
  <p>No todos yet.</p>
}
</div>
```

### Live Workflow Status (`kuratchi:workflow`)

Import `workflowStatus` from the `kuratchi:workflow` virtual module to read a Cloudflare Workflow's status. The first argument is a compile-time-typed string-literal union of your discovered `*.workflow.ts` basenames; passing an unknown name is a type error.

```html
<script>
  import { params } from 'kuratchi:request';
  import { workflowStatus } from 'kuratchi:workflow';

  // Name is typed: only 'migration' | 'data-sync' | ... (whatever *.workflow.ts files exist)
  const status = await workflowStatus('migration', params.id, { poll: '2s' });
</script>

if (status.error) {
  <ErrorBanner error={status.error} />
} else if (status.status === 'running') {
  <ProgressBar progress={status.output?.progress} />
} else if (status.status === 'complete') {
  <CompletedBanner result={status.output} />
}
```

When you pass `{ poll }`, the framework injects a tiny directive script that re-fetches the URL every `interval` and swaps `<body>` with the freshly rendered HTML. Every `{status.*}` reference re-evaluates server-side on each tick — no client reactivity to wire up.

**Options:**

- `poll` — interval as string (`'2s'`, `'500ms'`, `'1m'`) or number of milliseconds. Omit for a one-shot read.
- `until(value)` — override the default terminal predicate. Default stops on `'complete'`, `'completed'`, `'errored'`, or `'terminated'`.

**Multiple polls on one page** — call `workflowStatus(..., { poll })` as many times as you like. The shortest interval wins, and polling only stops when every call reports terminal:

```html
<script>
  const statuses = Object.fromEntries(await Promise.all(
    activeJobs.map(async (j) => [j.id, await workflowStatus('migration', j.id, { poll: '2s' })])
  ));
</script>
```

### Blocking (await)

When you don't need loading states, use `await`:

```html
<script>
const todos = await getTodos(); // blocks until resolved
</script>

for (const todo of todos) {
  <TodoItem todo={todo} />
}
```

## Progressive Enhancement

### Button Actions

Use `onclick={fn(args)}` for button-style server actions:

```html
<button onclick={deleteItem(item.id)} type="button">Delete</button>
<button onclick={toggleItem(item.id, true)} type="button">Done</button>
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

- Put handler logic in a `.do.ts` file in `src/server/`.
- Exported functions in that file become RPC methods.
- Import the `.do.ts` file directly — the framework auto-generates RPC proxies.
- RPC methods are still server-side code. They are exposed intentionally by the framework runtime, not because route files are client-side.

```html
<script>
  import { getOrgUsers, createOrgUser } from '$server/auth.do';
  const users = await getOrgUsers();
</script>

<form action={createOrgUser} method="POST">
  <input type="email" name="email" required />
  <button type="submit">Create</button>
</form>
```

### RPC Validation Without Dependencies

Kuratchi ships a small built-in schema API for route RPCs and Durable Object RPC methods, so you do not need `zod`, `valibot`, or any other runtime dependency just to validate client-callable input.

Declare schemas in a companion `schemas` object. Keys must match the public RPC function or method names:

```ts
import { schema, type InferSchema } from '@kuratchi/js';

export const schemas = {
  createSite: schema({
    name: schema.string().min(1),
    slug: schema.string().min(1),
    publish: schema.boolean().optional(false),
  }),
};

export async function createSite(data: InferSchema<typeof schemas.createSite>) {
  return { id: `${data.slug}-1`, publish: data.publish };
}
```

This works for normal exported route RPC functions without changing the function declaration style. The schema lives alongside the function instead of wrapping it.

Durable Object classes use the same convention via `static schemas`:

```ts
import { DurableObject } from 'cloudflare:workers';
import { schema, type InferSchema } from '@kuratchi/js';

export default class SitesDO extends DurableObject {
  static schemas = {
    saveDraft: schema({
      title: schema.string().min(1),
      content: schema.string().min(1),
    }),
  };

  async saveDraft(data: InferSchema<(typeof SitesDO.schemas).saveDraft>) {
    return { ok: true, slug: data.title.toLowerCase().replace(/ /g, '-') };
  },
}
```

If the payload does not match the schema, Kuratchi returns `400` with a validation error instead of executing the RPC. Schema-backed RPCs accept a single object argument.

Rules:
- Route RPC modules use `export const schemas = { ... }`.
- Durable Object classes use `static schemas = { ... }`.
- Schema keys must match public function or method names exactly.
- Schema-backed RPC entrypoints take one object argument.
- Today, the typed handler pattern is `InferSchema<typeof schemas.name>` or `InferSchema<(typeof MyDO.schemas).methodName>`.

Available schema builders:
- `schema({ ... })`
- `schema.string()`
- `schema.number()`
- `schema.boolean()`
- `schema.file()`
- `.optional(defaultValue)`
- `.list()`
- `.min(value)`

Example with nested objects, arrays, and defaults:

```ts
import { schema, type InferSchema } from '@kuratchi/js';

export const schemas = {
  createProfile: schema({
    name: schema.string().min(1),
    info: schema({
      height: schema.number(),
      likesDogs: schema.boolean().optional(false),
    }),
    attributes: schema.string().list(),
  }),
};

export async function createProfile(data: InferSchema<typeof schemas.createProfile>) {
  return { ok: true, profile: data };
}
```

## Durable Objects

Durable Object behavior is enabled by filename suffix.

- Any file ending in `.do.ts` is treated as a Durable Object handler file.
- Any file not ending in `.do.ts` is treated as a normal server module.
- No required folder name. `src/server/auth.do.ts`, `src/server/foo/bar/sites.do.ts`, etc. all work.

### Writing a Durable Object

Extend the native Cloudflare `DurableObject` class. Public methods automatically become RPC-accessible:

```ts
// src/server/user.do.ts
import { DurableObject } from 'cloudflare:workers';

export default class UserDO extends DurableObject {
  async getName() {
    return await this.ctx.storage.get('name');
  }

  async setName(name: string) {
    this._validate(name);
    await this.ctx.storage.put('name', name);
  }

  // NOT RPC-accessible (underscore prefix)
  _validate(name: string) {
    if (!name) throw new Error('Name required');
  }

  // NOT RPC-accessible (lifecycle method)
  async alarm() {
    // Handle alarm
  }
}
```

**RPC rules:**
- **Public methods** (`getName`, `setName`) → RPC-accessible
- **Underscore prefix** (`_validate`) → NOT RPC-accessible
- **Private/protected** (`private foo()`) → NOT RPC-accessible
- **Lifecycle methods** (`constructor`, `fetch`, `alarm`, `webSocketMessage`, etc.) → NOT RPC-accessible

### Using from routes

Import from the `.do.ts` file directly using `$server/`:

```html
<script>
import { getName, setName } from '$server/user.do';

const name = await getName();
</script>

<h1>Hello, {name}</h1>
```

The framework handles RPC wiring automatically.

### Auto-Discovery

Durable Objects are auto-discovered from `.do.ts` files. **No config needed.**

**Naming convention:**
- `user.do.ts` → binding `USER_DO`
- `org-settings.do.ts` → binding `ORG_SETTINGS_DO`

**Override binding name** with `static binding`:
```ts
export default class UserDO extends DurableObject {
  static binding = 'CUSTOM_BINDING';  // Optional override
  // ...
}
```

The framework auto-syncs discovered DOs to `wrangler.jsonc`.

### Optional: stubId for auth integration

If you need automatic stub resolution based on user context, add `stubId` in `kuratchi.config.ts`:

```ts
// kuratchi.config.ts
export default defineConfig({
  durableObjects: {
    USER_DO: { stubId: 'user.orgId' },  // Only needed for auth integration
  },
});
```

## Agents

Kuratchi treats `src/server/**/*.agents.ts` as a first-class Worker export convention.

- Any `.agents.ts` file under `src/server/` is scanned during build.
- The file must export a class with either `export class MyAgent` or `export default class MyAgent`.
- The compiler re-exports that class from `.kuratchi/worker.js`, so Wrangler can bind it directly.
- `.agents.ts` files are not route modules and are not converted into Durable Object RPC proxies.

```ts
// src/server/ai/session.agents.ts
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

- If a `.agents.ts` file does not export a class, the build fails.
- Kuratchi only auto-discovers `.agents.ts` files under `src/server/`.
- You still need Wrangler Durable Object bindings and migrations because Agents run as Durable Objects.

## Workflows

Kuratchi auto-discovers `.workflow.ts` files in `src/server/`. **No config needed.**

```ts
// src/server/migration.workflow.ts
import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';

export class MigrationWorkflow extends WorkflowEntrypoint<Env, MigrationParams> {
  async run(event: WorkflowEvent<MigrationParams>, step: WorkflowStep) {
    // workflow steps...
  }
}
```

On build, Kuratchi:
1. Scans `src/server/` for `.workflow.ts` files
2. Derives binding from filename: `migration.workflow.ts` → `MIGRATION_WORKFLOW`
3. Infers class name from the exported class
4. Auto-adds/updates the workflow entry in `wrangler.jsonc`

**Zero config required.** Just create the file and the framework handles everything:
- `name`: derived from binding (e.g., `MIGRATION_WORKFLOW` → `migration-workflow`)
- `binding`: derived from filename (e.g., `migration.workflow.ts` → `MIGRATION_WORKFLOW`)
- `class_name`: inferred from the exported class

Examples:
- `migration.workflow.ts` → `MIGRATION_WORKFLOW` binding
- `bond.workflow.ts` → `BOND_WORKFLOW` binding
- `new-site.workflow.ts` → `NEW_SITE_WORKFLOW` binding

### Workflow Status Polling

Use `workflowStatus` from the `kuratchi:workflow` virtual module to read a workflow's live status. The first argument is typed as a compile-time union of your discovered `*.workflow.ts` basenames, so unknown names fail type-check.

```html
<script>
  import { params } from 'kuratchi:request';
  import { workflowStatus } from 'kuratchi:workflow';

  const status = await workflowStatus('migration', params.id, { poll: '2s' });
</script>

if (status.status === 'running') {
  <div class="spinner">Running...</div>
} else if (status.status === 'complete') {
  <div>✓ Complete</div>
}
```

When you pass `{ poll }`, the framework re-fetches the page on each interval and swaps `<body>` with the fresh server render — no client reactivity code. Polling stops automatically when `until(status)` returns true (default: `status === 'complete' | 'completed' | 'errored' | 'terminated'`).

**Name mapping** (filename basename → `workflowStatus` name):

- `migration.workflow.ts` → `'migration'`
- `james-bond.workflow.ts` → `'james-bond'`
- `site.workflow.ts` → `'site'`

**Multiple polls on one page** — call `workflowStatus(..., { poll })` as many times as you need. The shortest interval wins, and polling stops only when every call reports terminal.

`status` is an `AsyncValue<T>` where `T` is the Cloudflare `InstanceStatus`:

```ts
{
  status: 'queued' | 'running' | 'paused' | 'errored' | 'terminated' | 'complete' | 'waiting' | 'unknown';
  error?: { name: string; message: string; };
  output?: unknown;
}
```

Plus the standard `AsyncValue` flags: `pending`, `error` (string | null), `success`.

## Queue Consumers

Kuratchi auto-discovers `.queue.ts` files in `src/server/` for consuming Cloudflare Queue messages. **No config needed.**

```ts
// src/server/notifications.queue.ts
export default async function(batch: MessageBatch<NotificationPayload>, env: Env, ctx: ExecutionContext) {
  for (const message of batch.messages) {
    console.log('Processing notification:', message.body);
    // Handle the message...
    message.ack();
  }
}
```

On build, Kuratchi:
1. Scans `src/server/` for `.queue.ts` files
2. Derives the expected queue binding from filename: `notifications.queue.ts` → `NOTIFICATIONS`
3. Auto-wires a unified `queue()` handler that dispatches to the correct file based on `batch.queue`

**Filename → Binding mapping:**
- `notifications.queue.ts` → expects `NOTIFICATIONS` queue binding
- `email-jobs.queue.ts` → expects `EMAIL_JOBS` queue binding

**Producer vs Consumer:**
- **Producer** (sending): Just call `env.QUEUE.send()` anywhere — no `.queue.ts` file needed
- **Consumer** (receiving): Create a `.queue.ts` file to handle incoming messages

**Requirements:**
- Define the queue in `wrangler.jsonc` with matching binding name
- Run `wrangler types` to get typed `env.QUEUE` bindings

## Containers

Kuratchi auto-discovers `.container.ts` files in `src/server/`. On every build, the framework writes `containers[]`, `durable_objects.bindings`, and `migrations[].new_sqlite_classes` (when opted-in) into `wrangler.jsonc` — no manual entries required.

```ts
// src/server/wordpress.container.ts
import { Container } from 'cloudflare:workers';

export default class WordPress extends Container<Env> {
  static image = './docker/wordpress.Dockerfile';  // REQUIRED — Dockerfile path OR registry reference
  static instanceType = 'standard';                // 'lite' (default) or 'standard'
  static maxInstances = 5;
  static sqlite = true;                            // opt into new_sqlite_classes migration
}
```

**Image** accepts either a local Dockerfile path (wrangler resolves the build context) or a registry reference (`docker.io/library/redis:7.2-alpine`, etc.). If you omit `static image` and a sibling `<basename>.Dockerfile` exists next to the `.container.ts`, it's picked up automatically. Omitting both triggers a compile-time error.

Binding derivation follows the same rule as every other convention:

- `wordpress.container.ts` → `WORDPRESS_CONTAINER`
- `redis.container.ts` → `REDIS_CONTAINER`

Full reference: [`apps/docs/framework/containers.mdx`](../../apps/docs/framework/containers.mdx).

## Sandbox

Kuratchi ships first-class support for [Cloudflare Sandbox](https://github.com/cloudflare/sandbox-sdk) — the Durable Object-backed runtime for ad-hoc shells, untrusted code, and code-interpreter agents — via its own `.sandbox.ts` convention. Sandbox is distinct from `.container.ts` because it's a specialized SDK: the class, image, and SQLite-storage requirement are all supplied by the framework.

```bash
bun add @cloudflare/sandbox
```

```ts
// src/server/shell.sandbox.ts
import { Sandbox } from '@cloudflare/sandbox';

export default class ShellSandbox extends Sandbox<Env> {}
```

That is the whole file. On build, Kuratchi writes:

```jsonc
// wrangler.jsonc — auto-synced, do not edit by hand
{
  "containers": [
    { "name": "shell-sandbox", "class_name": "ShellSandbox", "image": "docker.io/cloudflare/sandbox:0.8.11", "instance_type": "lite" }
  ],
  "durable_objects": { "bindings": [{ "name": "SHELL_SANDBOX", "class_name": "ShellSandbox" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["ShellSandbox"] }]
}
```

No Dockerfile needed — the default image tag tracks the installed `@cloudflare/sandbox` version so the SDK and the container runtime can never drift. Override with `static image = '...'` for Python variants or custom builds.

### Multiple sandboxes in one project

Because binding + class + migration all derive from the filename, a project can host any number of sandboxes:

```
src/server/shell.sandbox.ts          → SHELL_SANDBOX       (default image)
src/server/python.sandbox.ts         → PYTHON_SANDBOX      (static image = '…:0.8.11-python')
src/server/code-interpreter.sandbox.ts → CODE_INTERPRETER_SANDBOX
```

### Usage

```ts
import { env } from 'cloudflare:workers';
import { getSandbox } from '@cloudflare/sandbox';

export async function runCommand(name: string, command: string) {
  const sandbox = getSandbox(env.SHELL_SANDBOX, name);
  const { stdout, stderr, exitCode } = await sandbox.exec(command);
  return { stdout, stderr, exitCode };
}
```

The second argument to `getSandbox()` is a **routing key** (same semantics as `DurableObjectNamespace.idFromName`). Same key → same container; fresh key → fresh container. Treat the filesystem as scratch: `destroy()` wipes it, and Cloudflare may reclaim long-idle sandboxes.

**Healthcheck:** the top-level handle has no `ping()`; use `exec('true')` for a canonical liveness probe.

Full reference: [`apps/docs/framework/sandbox.mdx`](../../apps/docs/framework/sandbox.mdx).

## Convention-Based Auto-Discovery

Kuratchi uses file suffixes to auto-discover and register worker classes. **No config needed** — just create the file:

| Suffix | Location | Binding Pattern | Example |
|--------|----------|-----------------|---------|
| `.workflow.ts` | `src/server/**/*.workflow.ts` | `FILENAME_WORKFLOW` | `migration.workflow.ts` → `MIGRATION_WORKFLOW` |
| `.container.ts` | `src/server/**/*.container.ts` | `FILENAME_CONTAINER` | `wordpress.container.ts` → `WORDPRESS_CONTAINER` |
| `.sandbox.ts` | `src/server/**/*.sandbox.ts` | `FILENAME_SANDBOX` | `shell.sandbox.ts` → `SHELL_SANDBOX` |
| `.queue.ts` | `src/server/**/*.queue.ts` | `FILENAME` | `notifications.queue.ts` → `NOTIFICATIONS` |
| `.agents.ts` | `src/server/**/*.agents.ts` | (manual wrangler config) | `session.agents.ts` |
| `.do.ts` | `src/server/**/*.do.ts` | (via `durableObjects` config) | `auth.do.ts` |

## Automatic Wrangler Config Sync

Kuratchi automatically syncs `wrangler.jsonc` during every build. This eliminates duplicate configuration for:

- **Workflows** — auto-discovered from `.workflow.ts` files
- **Containers** — auto-discovered from `.container.ts` files (writes `containers[]`, `durable_objects.bindings`, and opt-in SQLite migrations)
- **Sandboxes** — auto-discovered from `.sandbox.ts` files (same as containers plus default image resolution from the installed `@cloudflare/sandbox` version)
- **Queues** — auto-discovered from `.queue.ts` files
- **Durable Objects** — `durableObjects` in kuratchi.config.ts or `.do.ts` files

The sync is additive and non-destructive:
- New entries are added automatically
- Existing entries are updated if the class name changes
- Manually-added wrangler config (D1, KV, R2, vars, etc.) is preserved
- Removed entries are cleaned up from wrangler.jsonc

Requirements:
- Uses `wrangler.jsonc` or `wrangler.json` (TOML is not supported for auto-sync)
- Creates `wrangler.jsonc` if no wrangler config exists

## Runtime APIs

### Virtual Modules

In route `<script>` blocks, use the `kuratchi:` virtual modules:

| Virtual Module | Description |
|----------------|-------------|
| `kuratchi:request` | Safe request state in route `<script>` blocks: `url`, `pathname`, `searchParams`, `params`, `slug`, `method` |
| `kuratchi:navigation` | Server-side redirect helper |

### Request helpers

Import pre-parsed request state from `kuratchi:request`. The compiler
enforces the safe subset — importing `locals`, `headers`, or any other
server-only value fails the build.

```ts
import { url, pathname, searchParams, params, slug, method } from 'kuratchi:request';

const page = pathname;
const tab = searchParams.get('tab');
const postId = params.id;
const postSlug = slug;
```

- `url` is the parsed `URL` for the current request.
- `pathname` is the full path, like `/blog/hello-world`.
- `searchParams` is `url.searchParams` for the current request.
- `params` is the matched route params object, like `{ slug: 'hello-world' }`.
- `slug` is `params.slug` when the matched route defines a `slug` param.
- `method` is the HTTP method.

For `locals`, `headers`, or anything derived from auth state, use a
`$server/*` module and call `getLocals()` / `getRequest()` from
`@kuratchi/js` there — then return precomputed values to the template.

### Server Module Helpers

For server modules (`src/server/*.ts`), import from `@kuratchi/js`:

```ts
import {
  getCtx,
  getEnv,
  getRequest,
  getLocals,
  getParams,
  getParam,
  redirect,
  RedirectError,
} from '@kuratchi/js';
```

### Server-side redirect

Import `redirect` from `kuratchi:navigation` for server-side redirects:

```ts
import { redirect } from 'kuratchi:navigation';

// Redirect to another page (throws RedirectError, caught by framework)
redirect('/dashboard');
redirect('/login', 302);
```

`redirect()` works in route scripts, `$server/` modules, and form actions. It throws a `RedirectError` that the framework catches and converts to a proper HTTP redirect response (default 303 for POST-Redirect-GET).

## Middleware

Optional request middleware file. Export a `MiddlewareDefinition` from
`src/middleware.ts` to intercept requests before they reach the framework router.
Use it for agent routing, pre-route auth, or custom response/error handling.

```ts
import { defineMiddleware, type MiddlewareDefinition } from '@kuratchi/js';

const middleware: MiddlewareDefinition = {
  agents: {
    async request(ctx, next) {
      if (!ctx.url.pathname.startsWith('/agents/')) {
        return next();
      }

      return new Response('Agent response');
    },
  },
};

export default defineMiddleware(middleware);
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

## Virtual Modules

Kuratchi provides `kuratchi:*` virtual modules for accessing framework state and utilities. These follow the same pattern as Cloudflare's `cloudflare:workers`.

### kuratchi:environment

```ts
import { dev } from 'kuratchi:environment';

if (dev) {
  // Skip auth checks, enable debug logging, etc.
}
```

- `dev` is `true` during `kuratchi dev`, `false` in production

### kuratchi:request

In route `<script>` blocks, only the compile-time safe subset is allowed.
Server-only state (`locals`, `headers`) must be read inside a `$server/*`
module via `@kuratchi/js` helpers.

```ts
import { url, pathname, searchParams, params, slug, method } from 'kuratchi:request';

console.log(url.href);
console.log(params.slug);
console.log(searchParams.get('tab'));
```

To access `locals` (e.g. `locals.userId`) from a template, wrap it in a
`$server/*` function:

```ts
// src/server/user.ts
import { getLocals } from '@kuratchi/js';
export function currentUserId(): number {
  return (getLocals() as { userId: number }).userId;
}
```

```html
<!-- src/routes/settings/index.kuratchi -->
<script>
  import { currentUserId } from '$server/user';
  const userId = await currentUserId();
</script>
```

### kuratchi:navigation

```ts
import { redirect } from 'kuratchi:navigation';

// Server-side redirect (throws RedirectError)
redirect('/login', 303);
```

All `kuratchi:*` modules work in:
- Page route scripts (`page.html`)
- Middleware (`src/middleware.ts`)
- Durable Objects (`.do.ts`)
- Server modules (`src/server/*.ts`)

## Security

**Philosophy.** Kuratchi enforces exactly two things: **origin integrity** (your server only accepts calls from your own browser code) and **visibility boundaries** (`_`-prefixed exports are unreachable from the outside). Everything else — authentication, authorization, rate limiting, audit logging — is your responsibility. A framework that auto-enforces auth creates a false sense of safety; a framework that enforces the origin boundary frees you to focus on the real question of *who* is allowed to do *what*.

There is no `KURATCHI_SECRET` to configure, no CSRF token in your HTML, no framework-level `requireAuth` toggle. The building blocks are the two unconditional guarantees below plus opt-in response headers.

### Default Security Headers

All responses include these headers automatically:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Strict Same-Origin Gate (unconditional)

Every `?_rpc=…` request is rejected with `403` unless it carries either:

- `Sec-Fetch-Site: same-origin` (every modern browser sends this on same-origin `fetch()`), **or**
- `Origin: <same as request URL origin>`

Non-browser clients (curl, server-to-server scripts, cron jobs) and any cross-origin browser request are blocked before your handler runs. Same-origin form POSTs are accepted under a slightly relaxed rule (top-level navigations may omit `Sec-Fetch-Site`) but reject any cross-origin `Origin`.

Combined with `SameSite=Lax` on any session cookie an auth library sets, this eliminates classic CSRF attacks without the framework having to mint its own token. The gate is always on and cannot be disabled — RPC is designed to be reachable only from your own frontend.

### Public vs. Private Server Functions

One universal rule for what counts as externally reachable:

- **Exports whose name starts with `_` are private.** They cannot be referenced from a route template as an action, await-query, or RPC. They remain importable by other server-side code — `_helper()` called from a public server function still works.
- **Durable Object methods.** Only `public` methods that do not start with `_` are copied onto the generated DO class prototype. TS `private`/`protected` and `_`-prefixed methods are invisible to the Workers RPC binding at runtime, not just to the compiler proxy.
- **Lifecycle names** (`constructor`, `fetch`, `alarm`, `webSocketMessage`, `webSocketClose`, `webSocketError`, `onInit`, `onAlarm`, `onMessage`) are never exposed as RPC.

Referencing a `_` export from a route template is a **compile-time error**.

### Authentication and Authorization are Your Job

The framework populates `locals.user` and `locals.session` from whatever auth hook/library you plug in (e.g. `@kuratchi/auth`). It never reads those values to decide whether to run your handler. Guard handlers explicitly:

```ts
import { requireAuth } from '@kuratchi/auth';

export async function deleteItem(id: string) {
  const user = await requireAuth();           // throws ActionError('Unauthorized') if missing
  if (!user.canDelete(id)) throw new ActionError('Forbidden');
  return db.items.delete(id);
}

// Private helper — framework refuses to expose it as RPC even if a template
// accidentally references it.
export async function _auditDelete(userId: string, itemId: string) {
  await db.audit.insert({ userId, itemId, action: 'delete' });
}
```

This keeps the auth model next to the operation it protects, where it belongs.

### Content Security Policy (with per-request nonces)

Configure any CSP string via `kuratchi.config.ts`. To opt into strict CSP with per-request nonces on the framework-injected inline scripts (workflow poll, client bridge, theme init, etc.), use the literal placeholder `{NONCE}` in your policy — Kuratchi generates a fresh nonce per request, substitutes it into the header, and stamps the same nonce onto every emitted `<script>` tag.

```ts
// kuratchi.config.ts
export default defineConfig({
  security: {
    contentSecurityPolicy: "default-src 'self'; script-src 'self' 'nonce-{NONCE}'; object-src 'none'",
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
    permissionsPolicy: "camera=(), microphone=(), geolocation=()",
  },
});
```

Without `{NONCE}`, the CSP is emitted verbatim and no nonce work is done.

### HTML Sanitization

The `{@html}` directive sanitizes output to prevent XSS:

- Removes dangerous elements (`<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<template>`, …).
- Strips all `on*` event handlers.
- Neutralizes `javascript:` and `vbscript:` URLs.
- Removes `data:` URLs from `src` attributes.

For rich user-generated HTML, reach for DOMPurify on top of this.

### Query Override Protection

Query function calls via `x-kuratchi-query-fn` headers are validated against a per-route allow-list — only functions registered for the current route can be invoked. Unknown names return `403`. Automatic, no configuration.

### Client Bridge Security

Client-side handler dispatch validates route and handler IDs against safe patterns, uses `hasOwnProperty` checks to block prototype-chain traversal, and rejects known pollution targets (`__proto__`, `constructor`, `prototype`). Automatic.

### Error Information Protection

In production, only developer-controlled `ActionError` / `PageError` messages are surfaced to the client. Generic `Error` details are hidden to prevent leaking implementation information. Dev mode shows the full message for debugging.

```ts
throw new ActionError('Invalid email format');          // shown to user
throw new Error('Database connection failed at line 42'); // replaced by "Internal Server Error" in prod
```

### Full Security Configuration

The entire configurable surface is the response headers:

```ts
// kuratchi.config.ts
export default defineConfig({
  security: {
    contentSecurityPolicy: "script-src 'self' 'nonce-{NONCE}'; object-src 'none'",
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
    permissionsPolicy: "camera=(), microphone=()",
  },
});
```

## `kuratchi.config.ts`

Optional. Required only when using framework integrations (ORM, auth, UI, security).

**Durable Objects are auto-discovered** — no config needed.

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
  auth: kuratchiAuthConfig({
    cookieName: 'kuratchi_session',
    sessionEnabled: true,
  }),
});
```

Without `kuratchi.config.ts` the compiler falls back to defaults — just drop your route files in `src/routes/` and run `kuratchi build`.

### UI Configuration

The `ui` config supports Tailwind CSS and plugins like DaisyUI.

**Tailwind CSS:**
```ts
ui: kuratchiUiConfig({ 
  library: 'tailwindcss'
})
```

The framework automatically:
- Detects `@tailwindcss/cli` in your project
- Generates the input CSS with `@import "tailwindcss"`
- Builds and injects the output CSS into your layout

**Tailwind plugins (DaisyUI, Forms, etc.):**
```ts
ui: kuratchiUiConfig({ 
  library: 'tailwindcss',
  plugins: ['daisyui', 'forms']
})
```

Supported plugins:
- `daisyui` — Component library with themes
- `forms` — Better form styling (expands to `@tailwindcss/forms`)
- Any npm package name that's a valid Tailwind plugin

**Example with DaisyUI:**
```ts
// kuratchi.config.ts
import { defineConfig } from '@kuratchi/js';
import { kuratchiUiConfig } from '@kuratchi/ui/adapter';

export default defineConfig({
  ui: kuratchiUiConfig({ 
    library: 'tailwindcss',
    plugins: ['daisyui']
  }),
});
```

Then use DaisyUI classes in your templates:
```html
<button class="btn btn-primary">Click me</button>
<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Card Title</h2>
    <p>Card content</p>
  </div>
</div>
```

**@kuratchi/ui theme options** (only when using the component library):
```ts
ui: kuratchiUiConfig({ 
  theme: 'dark',    // 'light' | 'dark' | 'system'
  radius: 'default' // 'none' | 'default' | 'full'
})
```

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
