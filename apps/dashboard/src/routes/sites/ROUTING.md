# Sites Routing Structure

## URL Structure

```
/sites                           → Sites listing page
/sites/[id]                      → Site editor (default: editor tab)
/sites/[id]/theme                → Theme selection tab
/sites/[id]/settings             → Site settings tab
```

## Route Files

```
sites/
├── +page.svelte                 # Sites listing
└── [id]/
    ├── +layout.svelte           # Shared layout with header & tabs
    ├── +page.svelte             # Editor tab (Kuratchi Editor)
    ├── theme/
    │   └── +page.svelte         # Theme selection
    └── settings/
        └── +page.svelte         # Site settings
```

## Layout Behavior

The `+layout.svelte` file handles:
- Loading site data via `getSiteById()`
- Rendering the header with site name and actions
- Tab navigation (Editor, Theme, Settings)
- URL-based active tab detection
- Navigation between tabs using `goto()`

## Data Flow

1. **Layout loads site data** → Available to all child routes via `site` store
2. **Child routes** → Focus on their specific functionality
3. **Navigation** → Uses SvelteKit's `goto()` for client-side routing

## Example Navigation

```typescript
import { goto } from '$app/navigation';

// Navigate to editor (default)
goto(`/sites/${siteId}`);

// Navigate to theme tab
goto(`/sites/${siteId}/theme`);

// Navigate to settings tab
goto(`/sites/${siteId}/settings`);
```

## Benefits

- **URL state** → Tabs are bookmarkable and shareable
- **Clean separation** → Each tab is its own route
- **Shared layout** → Header and navigation logic in one place
- **Better UX** → Browser back/forward works naturally
