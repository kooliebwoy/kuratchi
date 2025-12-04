// Navigation Widget System
// A composable navigation system for headers, footers, and more

export { default as NavMenu } from './NavMenu.svelte';
export { default as NavItem } from './NavItem.svelte';
export { default as NavMenuMobile } from './NavMenuMobile.svelte';

// Footer Navigation Widgets
export { default as FooterNavColumns } from './FooterNavColumns.svelte';
export { default as FooterNavLinks } from './FooterNavLinks.svelte';

// Types
export type {
    NavMenuItem,
    NavConfig,
    DesktopNavConfig,
    MobileNavConfig,
    NavColors,
    NavTypography,
    NavSpacing,
    NavBorders,
    NavAnimation,
    NavCaret,
    DropdownTrigger,
    DropdownDirection,
    DropdownAlign,
    SubmenuDirection,
    NavOrientation,
} from './types.js';

// Footer Types
export type {
    FooterLink,
    FooterLinkColumn,
    FooterNavColors,
    FooterNavTypography,
    FooterNavSpacing,
    FooterColumnsConfig,
    FooterLinksConfig,
    FooterNavConfig,
} from './footer-types.js';

// Utilities
export {
    defaultDesktopConfig,
    defaultMobileConfig,
    mergeNavConfig,
} from './types.js';

// Footer Utilities
export {
    defaultColumnsConfig,
    defaultLinksConfig,
    isColumnsConfig,
    mergeFooterConfig,
} from './footer-types.js';

// Presets
export type { NavPreset, NavPresetKey } from './presets.js';
export {
    navPresets,
    getNavPreset,
    listNavPresets,
    darkMinimalPreset,
    lightCleanPreset,
    boldUppercasePreset,
    clickDropdownPreset,
    pillStylePreset,
    underlinePreset,
} from './presets.js';

