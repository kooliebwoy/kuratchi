# Component Refactor Pattern Analysis

## Pattern Overview
Components now use `BlockActions` and `SideActions` from `$lib/utils` instead of `LayoutBlock`. Editable experiences follow the same shape as our newer sections such as `IconBar`.

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
import { Pencil } from '@lucide/svelte';
import { BlockActions, SideActions } from '$lib/utils';
```

## 5. Editable/Read-Only Structure
```svelte
{#if editable}
    <div class="editor-item group relative" bind:this={component}>
        {#if mounted}
            <BlockActions {id} {type} element={component} />
        {/if}
        <section {id} data-type={type}>
            <div class="hidden" data-metadata>{JSON.stringify(content)}</div>
            <!-- component output -->
        </section>
    </div>

    <SideActions triggerId={sideActionsId}>
        {#snippet label()}
            <button id={sideActionsId} class="krt-editButton" type="button">
                <Pencil size={16} />
                <span>Edit Settings</span>
            </button>
        {/snippet}
        {#snippet content()}
            <!-- drawer controls -->
        {/snippet}
    </SideActions>
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
- Keep drawer controls inside `SideActions` and pair them with a trigger button that sets `triggerId`.
