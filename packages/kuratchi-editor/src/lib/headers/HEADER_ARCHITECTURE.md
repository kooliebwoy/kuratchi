# Header & Footer Component Architecture

This document outlines the architecture for creating scalable, maintainable header and footer components in kuratchi-editor.

## Overview

As we scale to 50+ header/footer variants, we need a consistent architecture that:
1. Reduces code duplication via **reusable inspector widgets**
2. Ensures consistent behavior via **shared types and config factories**
3. Supports **forced viewport mode** for accurate editor preview
4. Makes debugging easier with clear separation of concerns
5. Simplifies adding new variants

## Directory Structure

```
headers/
├── shared/
│   ├── index.ts              # Central exports
│   ├── types.ts              # Shared TypeScript types
│   └── config.ts             # Configuration factories & defaults
├── SaigeBlakeHeader.svelte   # Individual header variants
├── PowersportsHeader.svelte
├── TwigAndPearlHeader.svelte
└── HeaderPreview.svelte      # Header preview component

footers/
├── shared/                   # (same pattern as headers)
├── SaigeBlakeFooter.svelte
├── TwigAndPearlFooter.svelte
└── FooterPreview.svelte

widgets/
├── inspector/                # Reusable inspector UI components
│   ├── index.ts
│   ├── InspectorSection.svelte
│   ├── InspectorCard.svelte
│   ├── ToggleControl.svelte
│   ├── ColorControl.svelte
│   ├── SelectControl.svelte
│   ├── LogoEditor.svelte
│   ├── SocialLinksEditor.svelte
│   └── MobileMenuSettings.svelte
├── nav/                      # Navigation components
│   ├── NavMenu.svelte
│   ├── NavMenuMobile.svelte
│   └── NavSettingsPanel.svelte
└── index.ts                  # Central widget exports
```

## Inspector Widgets

Instead of writing inline inspector HTML in each header/footer, use composable widgets:

### Available Widgets

| Widget | Purpose | Props |
|--------|---------|-------|
| `InspectorSection` | Collapsible section with title/icon/hint | `title`, `icon`, `hint`, `primary`, `collapsed` |
| `InspectorCard` | Generic card container | `children` snippet |
| `ToggleControl` | Toggle switch with label | `label`, `checked` (bindable) |
| `ColorControl` | Color picker with hex display | `label`, `value` (bindable) |
| `SelectControl` | Dropdown select | `label`, `value` (bindable), `options` |
| `LogoEditor` | Logo preview + ImagePicker | `logo` (bindable) |
| `SocialLinksEditor` | Icon picker + link inputs | `icons` (bindable) |
| `MobileMenuSettings` | Mobile menu config | `style`, `position` (bindable) |

### Usage Example

```svelte
<script lang="ts">
    import {
        InspectorSection,
        ToggleControl,
        ColorControl,
        LogoEditor,
        SocialLinksEditor,
        NavSettingsPanel
    } from '../widgets/index.js';
</script>

{#snippet inspector()}
    <div class="krt-headerInspector">
        <InspectorSection title="Quick Settings" icon="⚡" hint="Common adjustments" primary>
            <ToggleControl label="Sticky Header" bind:checked={isSticky} />
            <ToggleControl label="Swap Layout" bind:checked={reverseOrder} />
        </InspectorSection>

        <LogoEditor bind:logo={logo} />

        <InspectorSection title="Colors" icon="🎨" hint="Header appearance">
            <ColorControl label="Background" bind:value={backgroundColor} />
            <ColorControl label="Text" bind:value={textColor} />
        </InspectorSection>

        <SocialLinksEditor bind:icons={icons} />

        <NavSettingsPanel
            bind:dropdownTrigger={navDropdownTrigger}
            bind:dropdownAlign={navDropdownAlign}
            ...
        />
    </div>
{/snippet}
```

## Forced Viewport Mode

The editor has device size buttons (phone/tablet/desktop). When clicked, headers/footers must respect that choice instead of auto-responding to container width.

### How It Works

1. **Editor.svelte** tracks `activeSize` ('phone' | 'tablet' | 'desktop')
2. **EditorCanvas.svelte** receives it as `forcedViewport` prop and passes to components
3. **Headers/Footers** add CSS classes and use `!important` overrides

### Implementation

```svelte
<!-- In header component -->
<script lang="ts">
    interface Props {
        // ... other props
        forcedViewport?: 'phone' | 'tablet' | 'desktop';
    }
    
    let { forcedViewport, ...rest }: Props = $props();
</script>

<div
    class="krt-header"
    class:krt-header--forceDesktop={forcedViewport === 'desktop'}
    class:krt-header--forceTablet={forcedViewport === 'tablet'}
    class:krt-header--forcePhone={forcedViewport === 'phone'}
>
```

```css
/* Container queries for natural responsiveness (site-renderer) */
@container header (min-width: 64rem) {
    .krt-header__navShell { display: flex; }
    .krt-header__mobileTrigger { display: none; }
}

/* Forced viewport overrides (editor preview) */
.krt-header--forceDesktop .krt-header__navShell { display: flex !important; }
.krt-header--forceDesktop .krt-header__mobileTrigger { display: none !important; }

.krt-header--forceTablet .krt-header__navShell,
.krt-header--forcePhone .krt-header__navShell { display: none !important; }
.krt-header--forceTablet .krt-header__mobileTrigger,
.krt-header--forcePhone .krt-header__mobileTrigger { display: inline-flex !important; }
```

## Creating a New Header/Footer

### 1. Use Shared Types

```typescript
import { 
    type BaseHeaderProps,
    type LogoData,
    type SocialIcon,
    normalizeMenuItems,
    createDesktopNavConfig,
    createMobileNavConfig,
} from './shared/index.js';
```

### 2. Extend Base Props

```typescript
interface MyHeaderProps extends BaseHeaderProps {
    forcedViewport?: 'phone' | 'tablet' | 'desktop';
    // Header-specific props
    customField?: string;
}
```

### 3. Use Inspector Widgets

Import from `../widgets/index.js` and compose your inspector UI.

### 4. Add Forced Viewport Support

- Add `forcedViewport` prop
- Add CSS modifier classes to root element
- Add CSS overrides at end of `<style>` block

## Common Issues & Solutions

### Issue: Toggle doesn't work (reverseOrder bug)

**Problem:** Using both CSS flex-direction reversal AND content swap.

**Solution:** Use ONLY content swap:

```svelte
<!-- Good: Content swap only -->
{#if reverseOrder}
    <!-- Social icons -->
{:else}
    <!-- Logo + Nav -->
{/if}
```

### Issue: Mobile menu escapes canvas

**Problem:** `position: fixed` on mobile menu positions to viewport, not canvas.

**Solution:** 
1. Canvas has `position: relative; overflow: hidden;`
2. Header/Footer wrapper has `position: static;`
3. NavMenuMobile uses `useFixedPosition={false}` in editor

### Issue: Logo not updating

**Solution:** Use `$state()` for logo and `$derived()` for computed:

```typescript
let logo = $state<LogoData>(initialLogo);
let logoUrl = $derived(logo?.url || '');
```

## Checklist for New Headers/Footers

### Required Props
- [ ] `forcedViewport?: 'phone' | 'tablet' | 'desktop'`
- [ ] `editable?: boolean`
- [ ] `menuHidden?: boolean`

### Inspector
- [ ] Use `InspectorSection` for grouping
- [ ] Use `ToggleControl`, `ColorControl`, etc.
- [ ] Use `LogoEditor` for logo (headers)
- [ ] Use `SocialLinksEditor` for social icons
- [ ] Use `NavSettingsPanel` for nav config

### CSS
- [ ] Add `container-type: inline-size` on root
- [ ] Add container queries for responsiveness
- [ ] Add forced viewport CSS overrides
- [ ] Root wrapper uses `position: static`

### State
- [ ] Use `$state()` for all editable properties
- [ ] Register with `blockRegistry` on mount
- [ ] Handle both editable and non-editable modes

### Links
- [ ] Use `href="/"` not `href="homepage"` for home
- [ ] Add `aria-label` on icon-only links

## Migration Checklist

Headers updated:
- [x] SaigeBlakeHeader - Widgets + forcedViewport ✅
- [x] PowersportsHeader - forcedViewport ✅
- [x] TwigAndPearlHeader - Widgets + forcedViewport ✅

Footers updated:
- [x] SaigeBlakeFooter - Widgets ✅
- [x] TwigAndPearlFooter - Widgets ✅
