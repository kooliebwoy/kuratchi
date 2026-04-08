# RFC 0002: Client-Side Code Model

## Status
Draft

## Summary
Invert the current model: **`<script>` is client-side by default, `$server/` imports escape to server.**

This is the opposite of the current `$:` escape hatch (which escapes to client). The new model matches web platform semantics where `<script>` means browser code.

## Problem Statement

Kuratchi's current implementation has overlapping mechanisms:

1. **Top-level `<script>` blocks** - Treated as server code (non-standard)
2. **`$client/` imports** - Supposed to bundle for browser, but broken
3. **`$:` reactive labels** - Escapes to client (confusing)
4. **Inline `<script>` in body** - Ambiguous behavior

**Core issue:** `<script>` in HTML means browser code, but Kuratchi treats it as server code.

## Proposed Design

### The Inversion

| Current Model | New Model |
|--------------|-----------|
| `<script>` = server | `<script>` = client |
| `$:` escapes to client | `$server/` escapes to server |
| `$client/` for browser imports | `$lib/` for isomorphic code |
| `$shared/` for isomorphic | `$lib/` (unified) |

### Core Rules

1. **`<script>` block** = Client-side, bundled with esbuild
2. **`$server/` imports** = RPC functions
3. **`$:` labels** = Reactive statements (Svelte-style), not escape hatch
4. **Template expressions** = Server-side (already works this way)
5. **Form `action={fn}`** = Server-side mutation with redirect

### RPC Execution Context

The same `$server/` import works in three contexts with automatic behavior:

| Context | Execution | Mechanism |
|---------|-----------|-----------|
| Template expression | Server-side at render | Direct call |
| Script top-level await | Server-side at render | Direct call, result available to template |
| Script function/handler | Client-side | RPC fetch |

**The compiler detects context automatically** - no manual annotation needed.

## Three Ways to Use `$server/` Functions

### 1. Template RPC (Rich API)

Call RPC directly in template with full loading/error state handling:

```html
<div>
  const messages = await getMessages(params.id);
  
  for (const msg of messages) {
    <div data-markdown>${msg.content}</div>
  }
</div>
```

Or with explicit state handling:

```html
<div>
  const result = getMessages(params.id);
  
  if (result.pending) {
    <div class="loading">Loading...</div>
  }
  if (result.error) {
    <div class="error">Error: ${result.error.message}</div>
  }
  if (result.success) {
    for (const msg of result.data) {
      <div data-markdown>${msg.content}</div>
    }
  }
</div>
```

### 2. Script Top-Level Await (Simple)

For simple data loading without rich state handling:

```html
<script>
import { params } from 'kuratchi:request';
import { getMessages } from '$server/chat';

// SSR: executes on server, result available to template
const messages = await getMessages(params.id);
</script>

<div id="messages">
  for (const msg of messages) {
    <div data-markdown>${msg.content}</div>
  }
</div>
```

### 3. Client Function RPC (DOM Updates)

For client-side interactions that need server data:

```html
<script>
import { updateMessage } from '$server/chat';

// Client-side: this function runs in browser
// But updateMessage() is RPC - executes on server
const triggerUpdate = async (msg) => {
  await updateMessage(msg);  // RPC fetch
  // Do DOM updates after
};
</script>

<button onclick={triggerUpdate(msg)}>Update</button>
```

### 4. Form Actions (Mutations with Refresh)

For mutations that should refresh the page:

```html
<form action={sendMessage}>
  <input name="chatId" value={params.id} type="hidden" />
  <input name="content" placeholder="Type a message..." />
  <button type="submit">Send</button>
</form>
```

Form actions execute server-side, then redirect with view transitions. The page refreshes and `getMessages()` runs again with fresh data.

## Complete Example

```html
<script>
import { params } from 'kuratchi:request';
import { marked } from 'marked';
import { getMessages, sendMessage, updateMessage } from '$server/chat';

// SSR: top-level await runs on server
const messages = await getMessages(params.id);

// Client: DOM manipulation after render
document.querySelectorAll('[data-markdown]').forEach(el => {
  el.innerHTML = marked.parse(el.textContent);
});

// Client: function with RPC call
const handleUpdate = async (msgId, content) => {
  await updateMessage(msgId, content);  // RPC fetch
  location.reload();  // Or update DOM directly
};
</script>

<!-- Template: server-side, native JS -->
<div id="messages">
  for (const msg of messages) {
    <div class="message" data-markdown>${msg.content}</div>
  }
</div>

<!-- Form action: server-side mutation -->
<form action={sendMessage}>
  <input name="chatId" value={params.id} type="hidden" />
  <textarea name="content"></textarea>
  <button type="submit">Send</button>
</form>

<style>
.message { padding: 1rem; }
</style>
```

## File Structure

```
src/
  routes/
    chat/[id]/
      index.html     # Template + <script> (client + $server/ RPC)
  server/
    chat.ts          # Server code, RPC functions
  lib/
    format.ts        # Isomorphic utilities (works in server templates AND client scripts)
    chat-ui.ts       # Client-side DOM manipulation (bundled for browser)
```

## Server Code

```typescript
// src/server/chat.ts
import { db } from '$lib/db';

export async function getMessages(chatId: string) {
  return await db.query.messages.findMany({
    where: eq(messages.chatId, chatId)
  });
}

export async function sendMessage(formData: FormData) {
  const chatId = formData.get('chatId') as string;
  const content = formData.get('content') as string;
  await db.insert(messages).values({ chatId, content });
  return redirect(`/chat/${chatId}`);
}

export async function updateMessage(msgId: string, content: string) {
  await db.update(messages).set({ content }).where(eq(messages.id, msgId));
  return { success: true };
}
```

## Virtual Modules: `kuratchi:*`

Request context is available via `kuratchi:request`:

```html
<script>
import { params, pathname, url } from 'kuratchi:request';
</script>
```

**What `kuratchi:request` provides (already implemented):**
- `url` - Full URL object
- `pathname` - URL pathname
- `searchParams` - URL search params
- `params` - Route params (e.g., `{ id: '123' }`)
- `slug` - First param value (convenience)
- `method` - HTTP method
- `headers` - Request headers
- `locals` - Request-scoped data from hooks

These are **already sanitized** by the framework. The compiler serializes the safe subset (params, pathname, searchParams) for client-side access.

## Reactivity: `$:` Labels

`$:` remains as **reactive statements** (Svelte-style), not as an escape hatch:

```html
<script>
import { params } from 'kuratchi:request';

// Reactive: re-runs when dependencies change
$: chatId = params.id;
$: console.log('Chat ID changed:', chatId);
</script>
```

## Benefits

1. **Matches web semantics**: `<script>` = browser code
2. **Single `<script>` block**: No `<script server>` vs `<script client>`
3. **Implicit server escape**: `$server/` is the only marker needed
4. **Context-aware RPC**: Same import, behavior depends on usage context
5. **Direct npm imports**: Bundled automatically with esbuild
6. **`$:` is reactive**: Clear purpose, not an escape hatch
7. **Native template syntax**: `for`, `if` - not JSX
8. **Form actions**: Mutations with view transitions, always fresh data
9. **`kuratchi:*` modules**: Already provide safe request context

## What's Already Implemented

Most of this model is already in place:

- ✅ Template RPC with `await` and rich state API
- ✅ Form `action={fn}` for mutations
- ✅ `kuratchi:request` virtual module
- ✅ View transitions on navigation
- ✅ `$server/` import convention
- ✅ `$lib/` isomorphic imports (works in server templates AND client scripts)
- ✅ Client bundle generation from inline `<script type="module">` blocks
- ⚠️ `<script>` treated as server (current behavior, inversion optional)

## Implementation Plan

### Phase 1: ✅ Unified `$lib/` Convention
- Replaced `$client/` and `$shared/` with single `$lib/` convention
- `$lib/` is isomorphic - works in server templates AND client scripts
- Client scripts in template body are bundled with esbuild

### Phase 2: `$server/` Context Detection (Future)
- Top-level await → Execute at SSR, serialize result for template
- Inside function/handler → Generate RPC client stub

### Phase 3: Optional Script Inversion (Future)
- Treat top-level `<script>` as client-side by default
- Keep current server-first behavior as opt-in

## Migration Path

1. Move server logic from top `<script>` to `/server/` files
2. Import server functions with `$server/` prefix
3. Move `$client/` and `$shared/` code to `$lib/`
4. Use `$lib/` for isomorphic utilities (formatters, validators, etc.)
5. Use inline `<script type="module">` for client-side DOM manipulation

## Open Questions

1. **Error handling in `$server/` calls?**
   - SSR: Render error state or throw
   - Client: Return error, let client handle

2. **Caching/deduplication of `$server/` calls?**
   - Same call in template and script should only execute once
