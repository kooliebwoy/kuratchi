# Remaining Plugin Extraction Work

## Current Status
✅ **Forms Plugin** - Complete and working
✅ **Blog Plugin** - Complete and working  
⏳ **Navigation Plugin** - Needs extraction
⏳ **Settings Plugin** - Needs extraction

## Navigation Plugin Requirements

**Current Location**: Editor.svelte lines 728-780

**State Dependencies**:
- `navState` (header/footer visibility and items)
- `pages` and `reservedPages` props
- Functions: `toggleHeaderVisible`, `toggleHeaderMobileOnDesktop`, `toggleFooterVisible`
- Functions: `handleHeaderMenuSave`, `handleFooterMenuSave`

**Components Used**:
- `MenuWidget` component
- `PanelTop`, `PanelBottom` icons

**Plugin Structure Needed**:
```
plugins/navigation/
├── NavigationPluginSidebar.svelte  # Owns navState, menu functions
└── index.ts                         # Plugin definition with Navigation icon
```

**Key Challenge**: Navigation state (`navState`) needs to be stored in `siteMetadata` or passed via `PluginContext`.

## Settings Plugin Requirements

**Current Location**: Editor.svelte lines 781-850+

**State Dependencies**:
- `localPageData` (title, seoTitle, seoDescription, slug, domain)
- Functions: `handleTitleEdit`, `handleSEOEdit`

**Plugin Structure Needed**:
```
plugins/settings/
├── SettingsPluginSidebar.svelte  # Page settings UI
└── index.ts                       # Plugin definition with Settings icon
```

**Key Challenge**: Settings directly modifies `localPageData` which is core Editor state. May need to pass page data via `PluginContext`.

## Recommended Approach

### Option 1: Full Plugin Extraction (Cleanest)
1. Extend `PluginContext` to include:
   - `pageData` and `updatePageData` callback
   - `navigation` state and `updateNavigation` callback
2. Create Navigation and Settings plugins
3. Remove hardcoded sections from Editor.svelte

### Option 2: Hybrid Approach (Pragmatic)
- Keep Settings in Editor (it's core page functionality)
- Extract Navigation as a plugin (it's a feature)
- This reduces complexity while still achieving good separation

## Next Steps

1. **Decide approach** - Full extraction vs. Hybrid
2. **Extend PluginContext** if needed
3. **Create Navigation plugin**
4. **Create Settings plugin** (if full extraction)
5. **Register plugins** in `registry/plugins.svelte.ts`
6. **Remove hardcoded sections** from Editor.svelte
7. **Test** all plugins work correctly

## Files to Modify

- `src/lib/plugins/types.ts` - Extend `PluginContext` if needed
- `src/lib/plugins/navigation/` - New plugin
- `src/lib/plugins/settings/` - New plugin (optional)
- `src/lib/registry/plugins.svelte.ts` - Register new plugins
- `src/lib/Editor.svelte` - Remove hardcoded sections

## Estimated Impact

**Lines to Remove from Editor.svelte**:
- Navigation section: ~52 lines (728-780)
- Settings section: ~70+ lines (781-850+)
- **Total**: ~122 lines removed

**New Plugin Files**:
- 2-4 new files depending on approach
- ~200-300 lines of plugin code

**Result**: Cleaner Editor.svelte, fully pluggable architecture
