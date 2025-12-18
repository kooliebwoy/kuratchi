# Kuratchi Editor Architecture

## Contract-Based Architecture

The editor follows a **contract-based architecture** where the Dashboard manages all external data and injects it into the Editor via `siteMetadata`. This enables:

1. **Separation of Concerns**: Dashboard handles CRUD, Editor handles rendering
2. **Multi-Tenancy**: Shared resources across multiple sites
3. **Simpler Editor**: No data management logic in the editor

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         DASHBOARD                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Forms   │ │ Catalog  │ │   Blog   │ │   Nav    │           │
│  │  CRUD    │ │  CRUD    │ │  CRUD    │ │  CRUD    │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │            │            │            │                   │
│       └────────────┴────────────┴────────────┘                   │
│                          │                                       │
│                   ┌──────▼──────┐                                │
│                   │ siteMetadata│  (Resolved data)               │
│                   └──────┬──────┘                                │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                          EDITOR                                  │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                  setContext('siteMetadata')               │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│   ┌──────────┐         ┌──────────┐         ┌──────────┐       │
│   │ Catalog  │         │  Form    │         │  Blog    │       │
│   │ Sections │         │ Sections │         │ Sections │       │
│   └──────────┘         └──────────┘         └──────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenancy Model

For dealerships with multiple locations, resources can be shared:

```
┌─────────────────────────────────────────────────────────────────┐
│                      ORGANIZATION                                │
│                                                                  │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │ Shared Menu │  │ Shared Form │  │   Catalog   │            │
│   │   "Main"    │  │  "Contact"  │  │  (All OEMs) │            │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│          │                │                │                     │
│    ┌─────┴─────┬──────────┼────────────────┤                    │
│    │           │          │                │                     │
│    ▼           ▼          ▼                ▼                     │
│ ┌──────┐   ┌──────┐   ┌──────┐        ┌──────┐                 │
│ │Site A│   │Site B│   │Site C│        │Site D│                 │
│ │Denver│   │Boulder│  │Springs│       │Pueblo│                 │
│ └──────┘   └──────┘   └──────┘        └──────┘                 │
│                                                                  │
│  Each site can:                                                  │
│  - Use shared menu OR custom menu                                │
│  - Use shared forms OR custom forms                              │
│  - Filter catalog by location                                    │
│  - Override theme settings                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Plugins Status

### Active Plugins (Editor Sidebar)

| Plugin | Purpose | Status |
|--------|---------|--------|
| **Pages** | Multi-page editing | Keep |
| **Site** | Header/Footer selection | Keep |
| **Themes** | Visual settings | Keep |
| **Navigation** | Menu editing | **Migrate to Dashboard** |
| **Modals** | Modal management | Keep (internal) |

### Removed Plugins

| Plugin | Reason | Alternative |
|--------|--------|-------------|
| ~~Forms~~ | Managed in Dashboard | Sections read from context |
| ~~Catalog~~ | Managed in Dashboard | Sections read from context |
| ~~Blog~~ | Managed in Dashboard | Sections read from context |

---

## Navigation Migration Plan

### Current State
- Navigation plugin in Editor sidebar
- Menu items stored in `siteMetadata.navigation`
- Editing happens inline in the editor

### Target State
- Navigation CRUD in Dashboard (`/dashboard/navigation`)
- Menus can be shared across sites (multi-tenancy)
- Editor receives resolved menu via `siteMetadata.navigation`
- Headers/Footers read navigation from context

### Migration Steps

1. **Dashboard: Create Navigation Management**
   ```
   /dashboard/navigation
   ├── /menus              # List all menus
   ├── /menus/[id]         # Edit menu items
   └── /menus/new          # Create new menu
   ```

2. **Database: Menu Schema**
   ```sql
   CREATE TABLE menus (
     id UUID PRIMARY KEY,
     organization_id UUID REFERENCES organizations(id),
     name TEXT NOT NULL,
     items JSONB NOT NULL DEFAULT '[]',
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );

   CREATE TABLE site_menus (
     site_id UUID REFERENCES sites(id),
     menu_id UUID REFERENCES menus(id),
     region TEXT NOT NULL, -- 'header' | 'footer'
     PRIMARY KEY (site_id, region)
   );
   ```

3. **Dashboard: Site Settings**
   - Add menu selector to site settings
   - Option to use shared menu or create custom
   - Resolve menu items before passing to editor

4. **Editor: Remove Navigation Plugin**
   - Headers read from `siteMetadata.navigation`
   - Remove inline menu editing
   - Keep navigation display in headers/footers

---

## Site Metadata Contract

See `site-metadata.ts` for the full TypeScript contract.

### Required by Dashboard

```typescript
interface SiteMetadataContract {
  // Theme
  themeId?: string;
  themeSettings?: ThemeSettings;

  // Forms (resolved from Dashboard > Forms)
  forms?: SiteForm[];

  // Catalog (resolved from Dashboard > Catalog)
  catalogOems?: CatalogOem[];
  catalogVehicles?: CatalogVehicle[];

  // Blog (resolved from Dashboard > Blog)
  blog?: SiteBlog;

  // Navigation (resolved from Dashboard > Navigation)
  navigation?: SiteNavigation;

  // Business Info (for multi-location)
  business?: BusinessInfo;
}
```

### How Sections Access Data

```svelte
<script>
  import { getContext } from 'svelte';
  
  const siteMetadata = getContext('siteMetadata');
  
  // Access resolved data
  const forms = $derived(siteMetadata?.forms || []);
  const vehicles = $derived(siteMetadata?.catalogVehicles || []);
</script>
```

---

## Benefits

1. **Simpler Editor**: No CRUD logic, just rendering
2. **Multi-Tenancy**: Share menus, forms, catalogs across sites
3. **Consistency**: Same menu/form on all dealership sites
4. **Maintainability**: Update once, reflect everywhere
5. **Flexibility**: Sites can override shared resources
6. **Performance**: Data resolved once in dashboard, not per-edit

---

## Future Considerations

- **Analytics Plugin**: Could follow same pattern (dashboard CRUD, inject stats)
- **SEO Plugin**: Site-wide SEO settings in dashboard
- **Integrations**: CRM, inventory systems managed in dashboard
- **Templates**: Shared page templates across sites
