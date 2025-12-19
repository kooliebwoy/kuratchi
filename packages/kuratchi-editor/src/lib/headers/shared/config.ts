/**
 * Header Configuration Utilities
 * 
 * Shared functions for creating nav configs, normalizing menu items,
 * and other common header operations.
 */

import type {
    DesktopNavConfig,
    MobileNavConfig,
    NavMenuItem,
    DropdownTriggerOption,
    DropdownAlignOption,
    SubmenuDirectionOption,
    MobileStyleOption,
    DrawerPositionOption
} from './types.js';

// ============================================================================
// Menu Normalization
// ============================================================================

/**
 * Normalize menu items to use consistent 'children' and 'url' properties.
 * Handles legacy formats with 'items', 'slug', or 'link' properties.
 */
export function normalizeMenuItems(items: any[]): NavMenuItem[] {
    if (!items || !Array.isArray(items)) return [];
    
    return items.map((item, index) => ({
        id: item.id || `item-${index}`,
        label: item.label,
        url: item.url || item.slug || item.link,
        children: item.children || item.items 
            ? normalizeMenuItems(item.children || item.items) 
            : undefined,
    }));
}

// ============================================================================
// Desktop Nav Config Factory
// ============================================================================

export interface CreateDesktopNavConfigOptions {
    textColor: string;
    dropdownTrigger?: DropdownTriggerOption;
    dropdownAlign?: DropdownAlignOption;
    submenuDirection?: SubmenuDirectionOption;
    hoverBgColor?: string;
    hoverTextColor?: string;
    dropdownBgColor?: string;
    dropdownTextColor?: string;
    dropdownHoverBgColor?: string;
    // Theme variant
    theme?: 'light' | 'dark' | 'custom';
}

/**
 * Create a desktop nav configuration with sensible defaults.
 * Use theme presets for common styling patterns.
 */
export function createDesktopNavConfig(options: CreateDesktopNavConfigOptions): DesktopNavConfig {
    const {
        textColor,
        dropdownTrigger = 'hover',
        dropdownAlign = 'start',
        submenuDirection = 'right',
        hoverBgColor,
        hoverTextColor,
        dropdownBgColor,
        dropdownTextColor = '#1f2937',
        dropdownHoverBgColor,
        theme = 'light'
    } = options;

    // Theme-based defaults
    const themeDefaults = {
        light: {
            hoverBg: 'color-mix(in srgb, currentColor 8%, transparent)',
            dropdownBg: 'rgba(255, 255, 255, 0.96)',
            dropdownHoverBg: 'rgba(15, 23, 42, 0.08)',
            dropdownBorder: 'rgba(15, 23, 42, 0.12)',
            dropdownShadow: '0 18px 45px rgba(15, 23, 42, 0.15)',
        },
        dark: {
            hoverBg: 'rgba(255, 255, 255, 0.1)',
            dropdownBg: '#1a1a1a',
            dropdownHoverBg: 'rgba(255, 255, 255, 0.1)',
            dropdownBorder: 'rgba(255, 255, 255, 0.12)',
            dropdownShadow: '0 18px 45px rgba(0, 0, 0, 0.4)',
        },
        custom: {
            hoverBg: 'color-mix(in srgb, currentColor 8%, transparent)',
            dropdownBg: 'rgba(255, 255, 255, 0.96)',
            dropdownHoverBg: 'rgba(15, 23, 42, 0.08)',
            dropdownBorder: 'rgba(15, 23, 42, 0.12)',
            dropdownShadow: '0 18px 45px rgba(15, 23, 42, 0.15)',
        }
    };

    const defaults = themeDefaults[theme];

    return {
        orientation: 'horizontal',
        dropdownTrigger,
        dropdownAlign,
        submenuDirection,
        colors: {
            background: 'transparent',
            backgroundHover: hoverBgColor || defaults.hoverBg,
            backgroundActive: hoverBgColor || defaults.hoverBg,
            text: textColor,
            textHover: hoverTextColor || textColor,
            dropdownBackground: dropdownBgColor || defaults.dropdownBg,
            dropdownItemHover: dropdownHoverBgColor || defaults.dropdownHoverBg,
            dropdownText: dropdownTextColor,
            dropdownBorder: defaults.dropdownBorder,
            dropdownShadow: defaults.dropdownShadow,
        },
        typography: {
            fontSize: '0.95rem',
            fontWeight: 600,
        },
        spacing: {
            itemGap: '0.25rem',
            itemPadding: '0.35rem 0.5rem',
            dropdownItemPadding: '0.5rem 0.65rem',
            dropdownPadding: '0.5rem',
        },
        borders: {
            itemRadius: '0.375rem',
            dropdownRadius: '0.75rem',
        },
        animation: {
            duration: '200ms',
            easing: 'ease',
            caretRotation: true,
        },
        caret: {
            show: true,
            size: '0.875rem',
        },
        dropdownMinWidth: '11rem',
    };
}

// ============================================================================
// Mobile Nav Config Factory
// ============================================================================

export interface CreateMobileNavConfigOptions {
    style?: MobileStyleOption;
    drawerPosition?: DrawerPositionOption;
    dropdownTextColor?: string;
    dropdownHoverBgColor?: string;
}

/**
 * Create a mobile nav configuration with sensible defaults.
 */
export function createMobileNavConfig(options: CreateMobileNavConfigOptions = {}): MobileNavConfig {
    const {
        style = 'drawer',
        drawerPosition = 'right',
        dropdownTextColor = '#1f2937',
        dropdownHoverBgColor,
    } = options;

    return {
        style,
        drawerPosition,
        colors: {
            background: 'rgba(255, 255, 255, 0.96)',
            backgroundHover: dropdownHoverBgColor || 'rgba(15, 23, 42, 0.08)',
            text: dropdownTextColor,
            dropdownBackground: 'rgba(15, 23, 42, 0.04)',
            dropdownText: dropdownTextColor,
        },
        typography: {
            fontSize: '1rem',
            fontWeight: 500,
        },
        showCloseButton: true,
        showBackdrop: true,
        backdropOpacity: 0.5,
        accordionBehavior: 'single',
    };
}

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_LOGO = {
    url: '/clutch-cms-logo.png',
    alt: 'Logo'
};

export const DEFAULT_MENU: NavMenuItem[] = [
    { id: '1', label: 'Home', url: '/' },
    {
        id: '2',
        label: 'Products',
        children: [
            { id: '2a', label: 'Product A', url: '/product-a' },
            { id: '2b', label: 'Product B', url: '/product-b' },
        ],
    },
    { id: '3', label: 'About Us', url: '/about' },
    { id: '4', label: 'Contact', url: '/contact' },
];

export const DEFAULT_SOCIAL_ICONS = [
    { icon: 'facebook', link: '#', name: 'Facebook', enabled: true },
    { icon: 'x', link: '#', name: 'X', enabled: true },
    { icon: 'instagram', link: '#', name: 'Instagram', enabled: true },
];
