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

Place `.html` files inside `src/routes/`. The file path becomes the URL pattern.

```
src/routes/index.html          → /
src/routes/items/index.html    → /items
src/routes/blog/[slug]/index.html → /blog/:slug
src/routes/layout.html        → shared layout wrapping all routes
```

### Execution model

Kuratchi routes are SSR by default, with a client-first authored `<script>` model.

- `src/routes` defines server-rendered route modules.
- Top-level route `<script>` blocks are client-side by default.
- `$server/*` imports are the server/RPC escape hatch.
- Template expressions, `if`, and `for` blocks render on the server.
- `src/server` is for private server-only modules and reusable backend logic.
- `src/server/runtime.hook.ts` is the server runtime hook entrypoint for request interception.
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

### Polling (Workflow Status)

For workflow status that updates over time, use the auto-generated `*WorkflowStatus` functions. These are generated for each `.workflow.ts` file:

- `migration.workflow.ts` → `migrationWorkflowStatus(instanceId, options)`
- `data-sync.workflow.ts` → `dataSyncWorkflowStatus(instanceId, options)`

```html
<div>
const status = migrationWorkflowStatus(instanceId, { poll: '2s' });

if (status.pending) {
  <p>Checking status...</p>
}

if (status.status === 'running') {
  <ProgressBar progress={status.output?.progress} />
}

if (status.status === 'complete') {
  <CompletedBanner />
}
</div>
```

**Polling options:**
- `poll` — interval: `'2s'`, `'500ms'`, `'1m'`
- `until` — stop polling when function returns true: `until: (s) => s.status === 'complete'`

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

Kuratchi auto-generates status polling RPCs for each discovered workflow. Poll workflow status with zero setup:

```html
<div data-poll={migrationWorkflowStatus(instanceId)} data-interval="2s">
  if (workflowStatus.status === 'running') {
    <div class="spinner">Running...</div>
  } else if (workflowStatus.status === 'complete') {
    <div>✓ Complete</div>
  }
</div>
```

The element's innerHTML updates automatically when the workflow status changes — no page reload needed.

**Auto-generated RPC naming** (camelCase):
- `migration.workflow.ts` → `migrationWorkflowStatus(instanceId)`
- `james-bond.workflow.ts` → `jamesBondWorkflowStatus(instanceId)`
- `site.workflow.ts` → `siteWorkflowStatus(instanceId)`

**Multiple workflows on one page:** Each `data-poll` element is independent. You can poll multiple workflow instances without collision:

```html
for (const job of jobs) {
  <div data-poll={migrationWorkflowStatus(job.instanceId)} data-interval="2s">
    {job.name}: polling...
  </div>
}
```

The status RPC returns the Cloudflare `InstanceStatus` object:
```ts
{
  status: 'queued' | 'running' | 'paused' | 'errored' | 'terminated' | 'complete' | 'waiting' | 'unknown';
  error?: { name: string; message: string; };
  output?: unknown;
}
```

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

Kuratchi auto-discovers `.container.ts` files in `src/server/`. **No config needed.**

```ts
// src/server/wordpress.container.ts
import { Container } from 'cloudflare:workers';

export class WordPressContainer extends Container {
  // container implementation...
}
```

On build, Kuratchi derives the binding from the filename:
- `wordpress.container.ts` → `WORDPRESS_CONTAINER` binding
- `redis.container.ts` → `REDIS_CONTAINER` binding

## Convention-Based Auto-Discovery

Kuratchi uses file suffixes to auto-discover and register worker classes. **No config needed** — just create the file:

| Suffix | Location | Binding Pattern | Example |
|--------|----------|-----------------|---------|
| `.workflow.ts` | `src/server/**/*.workflow.ts` | `FILENAME_WORKFLOW` | `migration.workflow.ts` → `MIGRATION_WORKFLOW` |
| `.container.ts` | `src/server/**/*.container.ts` | `FILENAME_CONTAINER` | `wordpress.container.ts` → `WORDPRESS_CONTAINER` |
| `.queue.ts` | `src/server/**/*.queue.ts` | `FILENAME` | `notifications.queue.ts` → `NOTIFICATIONS` |
| `.agents.ts` | `src/server/**/*.agents.ts` | (manual wrangler config) | `session.agents.ts` |
| `.do.ts` | `src/server/**/*.do.ts` | (via `durableObjects` config) | `auth.do.ts` |

## Automatic Wrangler Config Sync

Kuratchi automatically syncs `wrangler.jsonc` during every build. This eliminates duplicate configuration for:

- **Workflows** — auto-discovered from `.workflow.ts` files
- **Containers** — auto-discovered from `.container.ts` files
- **Durable Objects** — `durableObjects` in kuratchi.config.ts

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
| `kuratchi:request` | Request state: `url`, `params`, `searchParams`, `headers`, `locals`, etc. |
| `kuratchi:navigation` | Server-side redirect helper |

### Request helpers

Import pre-parsed request state from `kuratchi:request`:

```ts
import { url, pathname, searchParams, params, slug, locals } from 'kuratchi:request';

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
- `headers` and `method` are also exported from `kuratchi:request`.
- `locals` is the request-scoped locals object (typed via `App.Locals` in `app.d.ts`).

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

```ts
import { url, pathname, params, locals, headers, method } from 'kuratchi:request';

// Access current request state
console.log(url.href);
console.log(params.slug);
console.log(locals.userId);
```

### kuratchi:navigation

```ts
import { redirect } from 'kuratchi:navigation';

// Server-side redirect (throws RedirectError)
redirect('/login', 303);
```

All `kuratchi:*` modules work in:
- Page route scripts (`page.html`)
- Runtime hooks (`runtime.hook.ts`)
- Durable Objects (`.do.ts`)
- Server modules (`src/server/*.ts`)

## Security

Kuratchi includes built-in security features that are enabled by default or configurable via `kuratchi.config.ts`.

### Default Security Headers

All responses include these headers automatically:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

### CSRF Protection

CSRF protection is **enabled by default** for all form actions and RPC calls.

**How it works:**
1. A cryptographically random token is generated per session and stored in a cookie
2. The compiler auto-injects a hidden `_csrf` field into forms with `action={fn}`
3. The client bridge includes the CSRF token header in fetch action requests
4. Server validates the token using timing-safe comparison

No configuration required — it just works.

```html
<!-- CSRF token is auto-injected -->
<form action={submitForm}>
  <input type="text" name="email" />
  <button type="submit">Submit</button>
</form>
```

### Authentication Enforcement

Optionally require authentication for all RPC calls or form actions:

```ts
// kuratchi.config.ts
export default defineConfig({
  security: {
    rpcRequireAuth: true,      // Require auth for all RPC calls (default: false)
    actionRequireAuth: true,   // Require auth for all form actions (default: false)
  },
});
```

When enabled, unauthenticated requests return `401 Authentication required`. The check looks for `locals.user` or `locals.session.user`, which is populated by `@kuratchi/auth`.

For per-function control, use guards in individual functions instead:

```ts
import { requireAuth } from '@kuratchi/auth';

export async function deleteItem(formData: FormData) {
  await requireAuth(); // Throws 401 if not authenticated
  // ... action logic
}
```

### Configurable Security Headers

Add CSP, HSTS, and Permissions-Policy headers:

```ts
// kuratchi.config.ts
export default defineConfig({
  security: {
    contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
    permissionsPolicy: "camera=(), microphone=(), geolocation=()",
  },
});
```

### HTML Sanitization

The `{@html}` directive automatically sanitizes output to prevent XSS:

- Removes dangerous elements: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<template>`, etc.
- Strips all `on*` event handlers
- Neutralizes `javascript:` and `vbscript:` URLs
- Removes `data:` URLs from `src` attributes

For user-generated HTML, we recommend using DOMPurify on the client side for maximum security.

### Fragment Refresh Security

Fragment IDs used for `data-poll` are automatically signed to prevent attackers from probing for data:

- Fragment IDs are signed at render time with the session's CSRF token
- Server validates signatures before returning fragment content
- Invalid or unsigned fragments return 403 when CSRF is enabled

This is automatic — no configuration required.

### Query Override Protection

Query function calls via `x-kuratchi-query-fn` headers are validated against a whitelist:

- Only query functions registered for the current route can be called
- Prevents attackers from invoking arbitrary RPC functions
- Returns 403 for unauthorized query function calls

This is automatic — no configuration required.

### Client Bridge Security

Client-side handler invocation is protected against injection attacks:

- Route and handler IDs are validated against safe patterns
- Prototype pollution attempts are blocked (`__proto__`, `constructor`, `prototype`)
- Uses `hasOwnProperty` checks to prevent prototype chain traversal

This is automatic — no configuration required.

### Error Information Protection

Error messages are sanitized to prevent information leakage in production:

- Generic errors show full details in dev mode only
- Production uses safe fallback messages ("Internal Server Error", "Action failed")
- `ActionError` and `PageError` messages are always shown (developer-controlled)

```ts
// Safe to show - developer-controlled message
throw new ActionError('Invalid email format');

// In production: "Internal Server Error" (details hidden)
// In dev mode: Full error message for debugging
throw new Error('Database connection failed at line 42');
```

### Full Security Configuration

```ts
// kuratchi.config.ts
export default defineConfig({
  security: {
    // CSRF Protection (enabled by default)
    csrfEnabled: true,
    csrfCookieName: '__kuratchi_csrf',
    csrfHeaderName: 'x-kuratchi-csrf',

    // Authentication Enforcement
    rpcRequireAuth: false,      // Require auth for RPC calls
    actionRequireAuth: false,   // Require auth for form actions

    // Security Headers
    contentSecurityPolicy: "default-src 'self'",
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
    permissionsPolicy: "camera=(), microphone=()",
  },
});
```

For a comprehensive security analysis and roadmap, see [SECURITY.md](./SECURITY.md).

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
