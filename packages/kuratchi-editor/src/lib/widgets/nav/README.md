# Navigation Widget System

A composable, configurable navigation system for building headers, footers, and navigation menus.

## Features

- 🎨 **Fully Configurable Colors** - Background, text, hover states, dropdown colors all independently configurable
- 🖱️ **Multiple Trigger Modes** - Hover or click-based dropdowns
- ↔️ **Flexible Positioning** - Dropdown direction (up/down), alignment (start/center/end), submenu direction (left/right)
- 📱 **Mobile Support** - Separate mobile configuration with drawer, fullscreen, or accordion styles
- ✨ **Animation Options** - Configurable transitions, caret rotation, and dropdown entrance animations
- 🎯 **Presets** - Ready-to-use style presets for quick implementation
- ♿ **Accessible** - Built with ARIA attributes and keyboard navigation

## Quick Start

### Basic Usage

```svelte
<script>
    import { NavMenu, NavMenuMobile } from '$lib/widgets';
    
    const menuItems = [
        { id: '1', label: 'Home', url: '/' },
        { id: '2', label: 'Products', url: '/products', children: [
            { id: '2a', label: 'Product A', url: '/products/a' },
            { id: '2b', label: 'Product B', url: '/products/b' },
        ]},
        { id: '3', label: 'About', url: '/about' },
    ];
    
    let mobileMenuOpen = false;
</script>

<!-- Desktop Navigation -->
<NavMenu items={menuItems} />

<!-- Mobile Navigation -->
<button onclick={() => mobileMenuOpen = true}>Menu</button>
<NavMenuMobile items={menuItems} bind:isOpen={mobileMenuOpen} />
```

### Using Presets

```svelte
<script>
    import { NavMenu, getNavPreset } from '$lib/widgets';
    
    const preset = getNavPreset('dark-minimal');
    const menuItems = [...];
</script>

<NavMenu items={menuItems} config={preset.desktop} />
```

### Custom Configuration

```svelte
<script>
    import { NavMenu, type DesktopNavConfig } from '$lib/widgets';
    
    const config: DesktopNavConfig = {
        dropdownTrigger: 'click', // 'hover' | 'click'
        dropdownDirection: 'down', // 'down' | 'up'
        dropdownAlign: 'start', // 'start' | 'center' | 'end'
        submenuDirection: 'right', // 'right' | 'left'
        colors: {
            background: 'transparent',
            backgroundHover: 'rgba(255, 255, 255, 0.1)',
            text: '#ffffff',
            dropdownBackground: '#1f2937',
            dropdownItemHover: 'rgba(255, 255, 255, 0.1)',
            dropdownText: '#ffffff',
        },
        typography: {
            fontSize: '0.9375rem',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
        },
        animation: {
            duration: '200ms',
            caretRotation: true,
        },
        caret: {
            show: true,
            size: '0.875rem',
        },
    };
</script>

<NavMenu items={menuItems} config={config} />
```

## Configuration Options

### DesktopNavConfig

| Property | Type | Description |
|----------|------|-------------|
| `orientation` | `'horizontal' \| 'vertical'` | Layout direction |
| `dropdownTrigger` | `'hover' \| 'click'` | How dropdowns are triggered |
| `dropdownDirection` | `'down' \| 'up'` | Where dropdowns open |
| `dropdownAlign` | `'start' \| 'center' \| 'end'` | Horizontal alignment of dropdown |
| `submenuDirection` | `'right' \| 'left'` | Where submenus open |
| `colors` | `NavColors` | Color configuration |
| `typography` | `NavTypography` | Font configuration |
| `spacing` | `NavSpacing` | Padding and gaps |
| `borders` | `NavBorders` | Border radius and width |
| `animation` | `NavAnimation` | Transition configuration |
| `caret` | `NavCaret` | Dropdown indicator configuration |

### NavColors

| Property | Description |
|----------|-------------|
| `background` | Nav item background |
| `backgroundHover` | Background on hover |
| `backgroundActive` | Background when dropdown is open |
| `text` | Text color |
| `textHover` | Text color on hover |
| `dropdownBackground` | Dropdown menu background |
| `dropdownItemHover` | Dropdown item hover background |
| `dropdownText` | Dropdown text color |
| `dropdownBorder` | Dropdown border color |
| `dropdownShadow` | Dropdown box shadow |

### MobileNavConfig

| Property | Type | Description |
|----------|------|-------------|
| `breakpoint` | `string` | When to switch to mobile (e.g., '768px') |
| `style` | `'drawer' \| 'fullscreen' \| 'accordion'` | Mobile menu style |
| `drawerPosition` | `'left' \| 'right' \| 'top' \| 'bottom'` | Drawer position |
| `showCloseButton` | `boolean` | Show close button |
| `showBackdrop` | `boolean` | Show backdrop overlay |
| `backdropOpacity` | `number` | Backdrop opacity (0-1) |
| `accordionBehavior` | `'single' \| 'multiple'` | How nested items expand |

## Available Presets

| Preset | Description |
|--------|-------------|
| `dark-minimal` | Clean, minimal navigation for dark backgrounds |
| `light-clean` | Light and airy for light backgrounds |
| `bold-uppercase` | High-impact with uppercase text |
| `click-dropdown` | Click-activated dropdowns |
| `pill-style` | Rounded pill-shaped items |
| `underline` | Elegant underline hover effect |

## Menu Item Structure

```typescript
interface NavMenuItem {
    id: string;           // Unique identifier
    label: string;        // Display text
    url?: string;         // Link URL
    pageId?: string;      // Internal page ID
    isExternal?: boolean; // Opens in new tab
    target?: string;      // Link target attribute
    rel?: string;         // Link rel attribute
    title?: string;       // Tooltip text
    ariaLabel?: string;   // Accessibility label
    icon?: string;        // Icon name
    children?: NavMenuItem[]; // Nested items
}
```

## Integration with Headers

Headers can use the NavMenu component instead of handling navigation rendering internally:

```svelte
<script>
    import { NavMenu, NavMenuMobile, getNavPreset } from '$lib/widgets';
    
    let { menu = [], backgroundColor = '#000000' } = $props();
    let mobileMenuOpen = $state(false);
    
    // Choose a preset and customize
    const desktopConfig = {
        ...getNavPreset('dark-minimal').desktop,
        colors: {
            text: '#ffffff',
            // Override specific colors based on header background
        }
    };
</script>

<header style:background-color={backgroundColor}>
    <!-- Desktop -->
    <NavMenu items={menu} config={desktopConfig} class="desktop-nav" />
    
    <!-- Mobile trigger -->
    <button class="mobile-trigger" onclick={() => mobileMenuOpen = true}>
        Menu
    </button>
</header>

<!-- Mobile menu (outside header for proper positioning) -->
<NavMenuMobile 
    items={menu} 
    bind:isOpen={mobileMenuOpen}
    config={getNavPreset('dark-minimal').mobile}
/>
```

## Accessibility

The navigation components include:

- `role="menubar"` on the nav list
- `role="menu"` on dropdowns
- `aria-expanded` on dropdown triggers
- `aria-haspopup="true"` on items with children
- Keyboard navigation (Enter/Space to toggle, Escape to close)
- Focus management within menus
