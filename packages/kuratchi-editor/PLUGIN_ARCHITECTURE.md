# Plugin Architecture

## Overview

The Kuratchi Editor now supports a true plugin system where plugins are self-contained modules that can be enabled/disabled without modifying the core Editor component.

## Structure

```
src/lib/
├── registry/
│   ├── plugins.svelte.ts          # Plugin type definitions & registry
│   ├── available-plugins.ts        # Central plugin registration
│   └── index.ts                    # Export plugin system
├── plugins/
│   ├── forms/
│   │   ├── FormsPluginSidebar.svelte  # Plugin UI component
│   │   └── index.ts                    # Plugin definition
│   └── [future plugins]/
```

## Creating a Plugin

### 1. Create Plugin Sidebar Component

```svelte
<!-- plugins/my-plugin/MyPluginSidebar.svelte -->
<script lang="ts">
    import type { PluginContext } from '../../registry/plugins.svelte';
    
    interface Props {
        context: PluginContext;
    }
    
    let { context }: Props = $props();
    
    // Plugin owns its state
    let pluginData = $state(context.siteMetadata.myPlugin ?? {});
    
    const syncToMetadata = () => {
        context.updateSiteMetadata({ myPlugin: pluginData });
    };
</script>

<div class="krt-editor__sidebarSection">
    <!-- Your plugin UI -->
</div>
```

### 2. Define Plugin

```typescript
// plugins/my-plugin/index.ts
import type { EditorPlugin } from '../../registry/plugins.svelte';
import { MyIcon } from '@lucide/svelte';
import MyPluginSidebar from './MyPluginSidebar.svelte';

export const myPlugin: EditorPlugin = {
    id: 'my-plugin',
    name: 'My Plugin',
    icon: MyIcon,
    sidebar: MyPluginSidebar,
    railButton: {
        title: 'My Plugin',
        order: 50  // Controls position in sidebar rail
    }
};
```

### 3. Register Plugin

```typescript
// registry/available-plugins.ts
import { myPlugin } from '../plugins/my-plugin';

export function registerAvailablePlugins(): void {
    pluginRegistry.register(formsPlugin);
    pluginRegistry.register(myPlugin);  // Add your plugin
}
```

## Using Plugins

### Enable Plugins in Editor

```svelte
<script>
    import Editor from '@kuratchi/editor';
    
    let editorOptions = {
        enabledPlugins: ['forms', 'my-plugin'],  // Only these plugins will show
        // ... other options
    };
</script>

<Editor {...editorOptions} />
```

### Enable All Plugins

```svelte
<script>
    import Editor from '@kuratchi/editor';
    
    let editorOptions = {
        // enabledPlugins not specified = all registered plugins enabled
    };
</script>

<Editor {...editorOptions} />
```

## Plugin Context API

Plugins receive a `PluginContext` object with:

```typescript
interface PluginContext {
    siteMetadata: Record<string, unknown>;
    updateSiteMetadata: (updates: Record<string, unknown>) => void;
    pages: Array<{ id: string; name: string; slug: string }>;
    reservedPages: string[];
    editor: HTMLElement | null;
}
```

### Storing Plugin Data

```typescript
// Read from metadata
let myData = context.siteMetadata.myPlugin;

// Update metadata
context.updateSiteMetadata({ 
    myPlugin: updatedData 
});
```

## Benefits

1. **True Separation** - Plugins don't require editing Editor.svelte
2. **Self-Contained** - Each plugin owns its UI, state, and logic
3. **Opt-In** - Enable only the plugins you need
4. **Extensible** - Add new plugins without touching core code
5. **Type-Safe** - Full TypeScript support

## Migration Status

- ✅ Plugin system infrastructure
- ✅ Forms plugin extracted
- ✅ Pages plugin extracted
- ✅ Navigation plugin extracted
- ⏳ Editor.svelte refactor (ongoing)
- ⏳ Blog plugin extraction
- ⏳ Settings plugin extraction
- ⏳ Blocks plugin extraction
- ⏳ Sections plugin extraction
- ⏳ Themes plugin extraction
- ⏳ Site plugin extraction

## Example: Forms Plugin

The Forms plugin demonstrates the pattern:

- **Location**: `src/lib/plugins/forms/`
- **State**: Manages `formsData` internally
- **Persistence**: Syncs to `siteMetadata.forms`
- **UI**: Complete form builder interface
- **No Editor Changes**: Works without modifying Editor.svelte

## Next Steps

1. Refactor Editor.svelte to dynamically render plugins
2. Extract Blog into a plugin
3. Extract Navigation into a plugin
4. Document plugin best practices
