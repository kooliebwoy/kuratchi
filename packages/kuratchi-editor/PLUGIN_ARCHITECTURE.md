# Plugin Architecture

## Overview

The Kuratchi Editor uses a plugin system where plugins are self-contained modules that can be enabled/disabled without modifying the core Editor component. The key principle is: **register a plugin → it just works**.

## Architecture Principles

### 1. Core vs Plugin-Specific Code

**Core Editor provides:**
- Page data management (title, content, SEO)
- Site metadata storage
- Event system for communication
- Extension registry for plugin context sharing

**Plugins provide:**
- Their own UI (sidebar component)
- Their own state management
- Access to extensions for cross-plugin functionality

### 2. No Plugin-Specific Code in Editor

When creating a new plugin, you should NOT need to modify `Editor.svelte`. The plugin system handles:
- Rendering plugin icons in the rail
- Rendering plugin sidebars
- Initializing/destroying plugins
- Cross-plugin communication via events

## Structure

```
src/lib/
├── plugins/
│   ├── context.ts              # All types: PluginContext, EditorPlugin, Extensions
│   ├── manager.ts              # Plugin manager factory
│   ├── index.ts                # Public exports
│   ├── pages/
│   │   ├── index.ts
│   │   └── PagesPluginSidebar.svelte
│   ├── navigation/
│   │   ├── index.ts
│   │   └── NavigationPluginSidebar.svelte
│   ├── site/
│   │   ├── index.ts
│   │   └── SitePluginSidebar.svelte
│   ├── themes/
│   │   ├── index.ts
│   │   └── ThemesPluginSidebar.svelte
│   └── forms/
│       ├── index.ts
│       └── FormsPluginSidebar.svelte
├── registry/
│   └── plugins.svelte.ts       # Plugin registration
```

## Creating a Plugin

### Step 1: Create Plugin Sidebar Component

```svelte
<!-- plugins/my-plugin/MyPluginSidebar.svelte -->
<script lang="ts">
    import type { PluginContext } from '../context';
    
    let { ctx }: { ctx: PluginContext } = $props();
    
    // Access core editor state
    const currentPage = $derived(ctx.currentPage);
    const pages = $derived(ctx.pages);
    
    // Access another plugin's extension
    import { EXT } from '../context';
    import type { NavigationExtension } from '../context';
    
    const nav = $derived(ctx.ext<NavigationExtension>(EXT.NAVIGATION));
    
    // Use core actions
    function handleSave() {
        ctx.updateSiteMetadata({ myPlugin: { /* data */ } });
    }
</script>

<div class="my-plugin">
    <!-- Your plugin UI -->
</div>
```

### Step 2: Define Plugin

```typescript
// plugins/my-plugin/index.ts
import type { EditorPlugin } from '../context';
import { MyIcon } from '@lucide/svelte';
import MyPluginSidebar from './MyPluginSidebar.svelte';

export const myPlugin: EditorPlugin = {
    id: 'my-plugin',
    name: 'My Plugin',
    icon: MyIcon,
    sidebar: MyPluginSidebar,
    railButton: {
        title: 'My Plugin',
        order: 50
    },
    // Optional lifecycle hooks
    onInit: (ctx) => {
        console.log('Plugin initialized');
    },
    onDestroy: () => {
        console.log('Plugin destroyed');
    }
};
```

### Step 3: Register Plugin

```typescript
// registry/plugins.svelte.ts
import { myPlugin } from '../plugins/my-plugin';

registry.register(myPlugin);
```

## Plugin Context API

### Core Context

```typescript
interface PluginContext {
    // State (read-only, reactive)
    readonly currentPage: CurrentPageData;
    readonly pages: PageItem[];
    readonly reservedPages: string[];
    readonly currentPageId: string | null;
    readonly siteMetadata: Record<string, unknown>;
    readonly editor: HTMLElement | null;
    
    // Actions
    updatePageTitle: (title: string) => void;
    updatePageSEO: (seo: SEOUpdate) => void;
    updateSiteMetadata: (updates: Record<string, unknown>) => void;
    switchPage: (pageId: string) => void;
    createPage: () => void;
    addBlock: (type: string, props?: Record<string, unknown>) => void;
    
    // Events
    on: <T>(event: EditorEvent, handler: (data: T) => void) => () => void;
    emit: <T>(event: EditorEvent, data: T) => void;
    
    // Extensions
    ext: <T>(key: string) => T | undefined;
}
```

## Built-in Extensions

Access extensions via `ctx.ext<Type>(EXT.KEY)`:

### Navigation Extension

```typescript
import { EXT, type NavigationExtension } from '../context';

const nav = ctx.ext<NavigationExtension>(EXT.NAVIGATION);

nav?.state;                              // Current navigation state
nav?.updateHeaderMenu(items);            // Update header menu items
nav?.updateFooterMenu(items);            // Update footer menu items
nav?.setHeaderVisible(true);             // Show/hide header
nav?.setFooterVisible(true);             // Show/hide footer
nav?.setHeaderMobileOnDesktop(true);     // Use mobile menu on desktop
nav?.addPageToMenu('header', page);      // Add page to menu
```

### Site Layout Extension

```typescript
import { EXT, type SiteLayoutExtension } from '../context';

const layout = ctx.ext<SiteLayoutExtension>(EXT.SITE_LAYOUT);

layout?.headerPresets;                   // Available header templates
layout?.footerPresets;                   // Available footer templates
layout?.currentHeaderType;               // Current header type
layout?.currentFooterType;               // Current footer type
layout?.mountHeader(component, props);   // Mount header component
layout?.mountFooter(component, props);   // Mount footer component
```

### Themes Extension

```typescript
import { EXT, type ThemesExtension } from '../context';

const themes = ctx.ext<ThemesExtension>(EXT.THEMES);

themes?.themes;                          // Available themes
themes?.selectedThemeId;                 // Current theme ID
themes?.applyTheme(themeId);             // Apply theme
```

## Event System

Plugins can communicate via events:

```typescript
// Subscribe to events
const unsubscribe = ctx.on('navigation:changed', (nav) => {
    console.log('Navigation updated:', nav);
});

// Emit events
ctx.emit('my-plugin:action', { data: 'value' });

// Built-in events:
// - 'page:changed'
// - 'page:saved'  
// - 'content:changed'
// - 'metadata:changed'
// - 'header:changed'
// - 'footer:changed'
// - 'theme:applied'
// - 'navigation:changed'
```

## Extension Keys

Use the `EXT` constants for type-safe access:

```typescript
import { EXT } from '../context';

EXT.NAVIGATION   // 'navigation'
EXT.SITE_LAYOUT  // 'site-layout'
EXT.THEMES       // 'themes'
EXT.FORMS        // 'forms'
EXT.BLOG         // 'blog'
```

## Migration Status

- ✅ Plugin system infrastructure (context.ts, manager.ts)
- ✅ Core context with extensions
- ✅ Event-based communication
- ✅ Plugin manager integration in Editor.svelte
- ✅ Pages plugin (with page settings)
- ✅ Navigation plugin (with NavigationExtension)
- ✅ Site plugin (with SiteLayoutExtension)
- ✅ Themes plugin (with ThemesExtension)
- ✅ Forms plugin
- ⏳ Blog plugin (needs BlogManager refactor)

## Example: Pages Plugin

The Pages plugin demonstrates the pattern:

```svelte
<script lang="ts">
    import type { PluginContext, NavigationExtension } from '../context';
    import { EXT } from '../context';
    
    let { ctx }: { ctx: PluginContext } = $props();
    
    const pages = $derived(ctx.pages);
    const currentPage = $derived(ctx.currentPage);
    const nav = $derived(ctx.ext<NavigationExtension>(EXT.NAVIGATION));
    
    // Add page to navigation
    function addToHeader(page: PageItem) {
        nav?.addPageToMenu('header', page);
    }
</script>
```
