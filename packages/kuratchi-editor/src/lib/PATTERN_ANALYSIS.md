# Component Refactor Pattern Analysis

## Pattern Overview
Components now use `BlockActions` from `$lib/utils` for both drag/delete controls and opening the inspector sidebar. `SideActions` remains available for legacy triggers but now routes its content into the right-hand inspector instead of a drawer.

## 1. Props Interface Structure
```typescript
interface Props {
    id?: string;
    type?: string;
    metadata?: any;
    editable?: boolean;
    // Component-specific properties
}
```

## 2. Props Destructuring with Defaults
```typescript
let {
    id = crypto.randomUUID(),
    type = 'component-type',
    metadata = {},
    editable = true,
    // Component-specific props with defaults
}: Props = $props();
```

## 3. State Management Pattern
- Use `$state()` for reactive values and `$derived()` for computed content.
- Rebuild a serializable `content` object that includes `id`, `type`, component data, and `metadata`.

## 4. Required Imports
```typescript
import { onMount } from 'svelte';
import { BlockActions } from '$lib/utils';
```

## 5. Editable/Read-Only Structure
```svelte
{#if editable}
    <div class="editor-item group relative" bind:this={component}>
        {#if mounted}
            <BlockActions {id} {type} element={component}>
                {#snippet inspector()}
                    <!-- inspector controls -->
                {/snippet}
            </BlockActions>
        {/if}
        <section {id} data-type={type}>
            <div class="hidden" data-metadata>{JSON.stringify(content)}</div>
            <!-- component output -->
        </section>
    </div>
{:else}
    <section {id} data-type={type}>
        <div class="hidden" data-metadata>{JSON.stringify(content)}</div>
        <!-- component output -->
    </section>
{/if}
```

## Key Requirements
- Include `id` and `type` in `content` and on the rendered section.
- Add hidden metadata JSON inside the rendered markup for serialization.
- Use `editor-item` on editable wrappers so `BlockActions` hover/keyboard styles apply.
- Gate `BlockActions` behind `onMount` when using browser-only APIs like `crypto.randomUUID()`.
- Pass inspector controls to the `inspector` snippet on `BlockActions`. `SideActions` can still wrap legacy triggers but simply opens the right-hand inspector.
