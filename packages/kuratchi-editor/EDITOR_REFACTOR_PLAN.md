# Editor.svelte Plugin Refactor Plan

## Current Status
✅ Plugin system infrastructure complete
✅ Forms plugin extracted
✅ Plugin imports added to Editor.svelte
✅ Plugin context created

## Remaining Tasks

### 1. Remove Forms-specific code from Editor.svelte

**Lines to remove/replace:**
- Line 533-557: `addNewForm()`, `deleteForm()`, `handleFormUpdate()` functions
- Line 619: Forms rail button (replace with dynamic plugin buttons)
- Line 775-821: Forms sidebar content (replace with dynamic plugin rendering)

### 2. Replace hardcoded rail buttons with dynamic rendering

**Current (lines ~600-620):**
```svelte
<button class={`krt-editor__railButton ${activeTab === 'forms' ? 'is-active' : ''}`}>
    <FileInput />
</button>
```

**Replace with:**
```svelte
{#each activePlugins as plugin}
    <button 
        class={`krt-editor__railButton ${activeTab === plugin.id ? 'is-active' : ''}`}
        onclick={() => toggleSidebar(plugin.id)}
        title={plugin.railButton?.title ?? plugin.name}
    >
        <plugin.icon />
    </button>
{/each}
```

### 3. Replace hardcoded sidebar content with dynamic rendering

**Current (lines ~760-821):**
```svelte
{:else if activeTab === 'forms'}
    <div class="krt-editor__sidebarSection">
        <!-- Hardcoded forms UI -->
    </div>
```

**Replace with:**
```svelte
{#each activePlugins as plugin}
    {#if activeTab === plugin.id}
        <svelte:component this={plugin.sidebar} context={pluginContext} />
    {/if}
{/each}
```

### 4. Update sidebar title logic

**Current (lines ~647-650):**
```svelte
{activeTab === 'forms' ? 'Forms' : ...}
```

**Replace with:**
```svelte
{activePlugins.find(p => p.id === activeTab)?.name ?? ...}
```

## File Structure After Refactor

```
Editor.svelte
├── Imports (plugins from registry)
├── Props (with enabledPlugins)
├── Plugin system
│   ├── activePlugins = getEnabledPlugins(enabledPlugins)
│   └── pluginContext = { siteMetadata, updateSiteMetadata, ... }
├── Rail buttons (dynamic from activePlugins)
└── Sidebar content (dynamic from activePlugins)
```

## Benefits

- ✅ No hardcoded plugin UI in Editor
- ✅ Plugins are self-contained
- ✅ Easy to add new plugins
- ✅ Clean separation of concerns
