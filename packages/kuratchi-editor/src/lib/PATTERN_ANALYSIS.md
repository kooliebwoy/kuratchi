# Component Refactor Pattern Analysis

## Pattern Overview
Based on examination of `IconBar.svelte` and `LayoutBlock.svelte`, here is the **exact pattern** that must be followed for component refactoring:

## 1. Props Interface Structure
```typescript
interface Props {
    id?: string;
    type?: string;
    metadata?: any;
    // Component-specific properties
}
```

## 2. Props Destructuring with Defaults
```typescript
let {
    id = crypto.randomUUID(),
    type = 'component-type',
    metadata = { /* default metadata object */ },
    // Component-specific props with defaults
}: Props = $props();
```

## 3. State Management Pattern
- **$state()** for reactive individual properties:
  ```typescript  
  let componentSpecificState = $state(initialValue);
  let metadataProperty = $state(metadata.property);
  ```

- **$derived()** for computed content object:
  ```typescript
  let content = $derived({
      id,
      type,
      // component properties
      metadata: {
          // rebuilt from state variables
      }
  })
  ```

## 4. Required Import List
```typescript
import { LayoutBlock } from "$lib/shell";
// Additional component-specific imports as needed
```

## 5. Three Required Snippets

### A. drawerContent Snippet
- Contains the editing interface for the component
- Uses `<div class="space-y-6">` as root container
- Implements form controls with `fieldset` and `fieldset-legend` classes
- Uses `<div class="divider"></div>` to separate sections
- Binds to state variables with `bind:value={stateVariable}`

### B. metadata Snippet  
- Simple JSON serialization: `{JSON.stringify(content)}`
- No additional logic or formatting

### C. children Snippet
- Contains the actual component render output
- Uses state variables for dynamic content
- Implements the visual representation users see

## 6. LayoutBlock Wrapper Structure
```svelte
<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <!-- editing interface -->
    {/snippet}

    {#snippet metadata()}
        {JSON.stringify(content)}
    {/snippet}

    {#snippet children()}
        <!-- component output -->
    {/snippet}
</LayoutBlock>
```

## Key Pattern Requirements

### State Variables
- Use `$state()` for all reactive properties
- Extract metadata properties into individual state variables
- Keep state variables flat and simple

### Content Object
- Must be a `$derived()` reactive statement
- Always includes `id`, `type`, and `metadata`
- Metadata object reconstructed from individual state variables
- Additional component properties included at root level

### Editing Interface Standards
- Use consistent CSS classes: `fieldset`, `fieldset-legend`, `form-control`, `input input-bordered`, `select`
- Group related controls in `<div class="form-control gap-4">`
- Use `<div class="divider"></div>` between major sections
- Color inputs should have `h-12` class
- Bind directly to state variables

### Import Requirements
- Always import `LayoutBlock` from `$lib/shell`
- Additional imports as needed for specific component functionality
- Follow existing import patterns in codebase

## Critical Success Factors
1. **Exact snippet names**: `drawerContent`, `metadata`, `children`
2. **Proper state reactivity**: All editable properties must use `$state()`
3. **Content derivation**: The `content` object must be `$derived()` and include all serializable data
4. **Metadata reconstruction**: Individual state variables must be properly reconstructed into metadata object
5. **LayoutBlock integration**: Must pass `{id}` and `{type}` to LayoutBlock component

This pattern ensures components integrate seamlessly with the editor system while maintaining proper state management and serialization capabilities.
