/**
 * Navigation Presets
 * 
 * Pre-configured navigation styles that can be used as starting points.
 * Users can pick a preset and then customize individual settings.
 */

import type { DesktopNavConfig, MobileNavConfig } from './types.js';

export interface NavPreset {
    name: string;
    description: string;
    desktop: DesktopNavConfig;
    mobile: MobileNavConfig;
}

/** Clean, minimal dark navigation - great for dark headers */
export const darkMinimalPreset: NavPreset = {
    name: 'Dark Minimal',
    description: 'Clean, minimal navigation for dark backgrounds',
    desktop: {
        orientation: 'horizontal',
        dropdownTrigger: 'hover',
        dropdownDirection: 'down',
        dropdownAlign: 'start',
        submenuDirection: 'right',
        colors: {
            background: 'transparent',
            backgroundHover: 'rgba(255, 255, 255, 0.1)',
            backgroundActive: 'rgba(255, 255, 255, 0.15)',
            text: '#ffffff',
            textHover: '#ffffff',
            dropdownBackground: 'rgba(0, 0, 0, 0.95)',
            dropdownItemHover: 'rgba(255, 255, 255, 0.1)',
            dropdownText: '#ffffff',
            dropdownBorder: 'rgba(255, 255, 255, 0.1)',
            dropdownShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        },
        typography: {
            fontSize: '0.9375rem',
            fontWeight: 500,
            textTransform: 'none',
        },
        spacing: {
            itemGap: '0.125rem',
            itemPadding: '0.5rem 0.875rem',
            dropdownItemPadding: '0.5rem 0.875rem',
            dropdownPadding: '0.5rem',
        },
        borders: {
            itemRadius: '0.375rem',
            dropdownRadius: '0.75rem',
        },
        animation: {
            duration: '200ms',
            easing: 'ease',
            dropdownEnter: 'fade',
            caretRotation: true,
        },
        caret: {
            show: true,
            size: '0.875rem',
            position: 'after',
        },
        dropdownMinWidth: '12rem',
    },
    mobile: {
        style: 'drawer',
        drawerPosition: 'right',
        colors: {
            background: '#1f2937',
            backgroundHover: '#374151',
            text: '#ffffff',
            dropdownBackground: '#111827',
            dropdownText: '#d1d5db',
        },
        showCloseButton: true,
        showBackdrop: true,
        backdropOpacity: 0.6,
        accordionBehavior: 'single',
    },
};

/** Light, airy navigation - great for light headers */
export const lightCleanPreset: NavPreset = {
    name: 'Light Clean',
    description: 'Light and airy navigation for light backgrounds',
    desktop: {
        orientation: 'horizontal',
        dropdownTrigger: 'hover',
        dropdownDirection: 'down',
        dropdownAlign: 'start',
        submenuDirection: 'right',
        colors: {
            background: 'transparent',
            backgroundHover: 'rgba(0, 0, 0, 0.05)',
            backgroundActive: 'rgba(0, 0, 0, 0.08)',
            text: '#374151',
            textHover: '#111827',
            dropdownBackground: '#ffffff',
            dropdownItemHover: '#f3f4f6',
            dropdownText: '#374151',
            dropdownBorder: '#e5e7eb',
            dropdownShadow: '0 20px 50px rgba(0, 0, 0, 0.15)',
        },
        typography: {
            fontSize: '0.9375rem',
            fontWeight: 500,
            textTransform: 'none',
        },
        spacing: {
            itemGap: '0.25rem',
            itemPadding: '0.5rem 0.75rem',
            dropdownItemPadding: '0.625rem 1rem',
            dropdownPadding: '0.5rem',
        },
        borders: {
            itemRadius: '0.375rem',
            dropdownRadius: '0.75rem',
        },
        animation: {
            duration: '200ms',
            easing: 'ease',
            dropdownEnter: 'fade',
            caretRotation: true,
        },
        caret: {
            show: true,
            size: '0.875rem',
            position: 'after',
        },
        dropdownMinWidth: '14rem',
    },
    mobile: {
        style: 'drawer',
        drawerPosition: 'right',
        colors: {
            background: '#ffffff',
            backgroundHover: '#f3f4f6',
            text: '#1f2937',
            dropdownBackground: '#f9fafb',
            dropdownText: '#4b5563',
        },
        showCloseButton: true,
        showBackdrop: true,
        backdropOpacity: 0.4,
        accordionBehavior: 'single',
    },
};

/** Bold uppercase navigation - high impact */
export const boldUppercasePreset: NavPreset = {
    name: 'Bold Uppercase',
    description: 'High-impact navigation with uppercase text',
    desktop: {
        orientation: 'horizontal',
        dropdownTrigger: 'hover',
        dropdownDirection: 'down',
        dropdownAlign: 'start',
        submenuDirection: 'right',
        colors: {
            background: 'transparent',
            backgroundHover: 'rgba(255, 255, 255, 0.1)',
            text: 'inherit',
            textHover: 'inherit',
            dropdownBackground: '#000000',
            dropdownItemHover: 'rgba(255, 255, 255, 0.15)',
            dropdownText: '#ffffff',
            dropdownBorder: 'rgba(255, 255, 255, 0.2)',
            dropdownShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
        },
        typography: {
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
        },
        spacing: {
            itemGap: '0.5rem',
            itemPadding: '0.625rem 1rem',
            dropdownItemPadding: '0.75rem 1.25rem',
            dropdownPadding: '0.625rem',
        },
        borders: {
            itemRadius: '0',
            dropdownRadius: '0',
        },
        animation: {
            duration: '150ms',
            easing: 'ease-out',
            dropdownEnter: 'slide',
            caretRotation: true,
        },
        caret: {
            show: true,
            size: '0.75rem',
            position: 'after',
        },
        dropdownMinWidth: '14rem',
    },
    mobile: {
        style: 'fullscreen',
        colors: {
            background: '#000000',
            backgroundHover: '#1f1f1f',
            text: '#ffffff',
            dropdownBackground: '#0a0a0a',
            dropdownText: '#d4d4d4',
        },
        typography: {
            fontSize: '1.25rem',
            fontWeight: 700,
        },
        showCloseButton: true,
        showBackdrop: false,
        accordionBehavior: 'single',
    },
};

/** Click-activated navigation - better for complex menus */
export const clickDropdownPreset: NavPreset = {
    name: 'Click Dropdown',
    description: 'Click-activated dropdowns for more control',
    desktop: {
        orientation: 'horizontal',
        dropdownTrigger: 'click',
        dropdownDirection: 'down',
        dropdownAlign: 'start',
        submenuDirection: 'right',
        colors: {
            background: 'transparent',
            backgroundHover: 'rgba(59, 130, 246, 0.1)',
            backgroundActive: 'rgba(59, 130, 246, 0.15)',
            text: '#374151',
            textHover: '#2563eb',
            textActive: '#1d4ed8',
            dropdownBackground: '#ffffff',
            dropdownItemHover: '#eff6ff',
            dropdownText: '#374151',
            dropdownBorder: '#e5e7eb',
            dropdownShadow: '0 20px 50px rgba(0, 0, 0, 0.12)',
        },
        typography: {
            fontSize: '0.9375rem',
            fontWeight: 500,
        },
        spacing: {
            itemGap: '0.25rem',
            itemPadding: '0.5rem 0.875rem',
            dropdownItemPadding: '0.625rem 1rem',
            dropdownPadding: '0.5rem',
        },
        borders: {
            itemRadius: '0.5rem',
            dropdownRadius: '0.75rem',
        },
        animation: {
            duration: '200ms',
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            dropdownEnter: 'scale',
            caretRotation: true,
        },
        caret: {
            show: true,
            size: '1rem',
            position: 'after',
        },
        dropdownMinWidth: '14rem',
    },
    mobile: {
        style: 'drawer',
        drawerPosition: 'left',
        colors: {
            background: '#ffffff',
            backgroundHover: '#eff6ff',
            text: '#1f2937',
            dropdownBackground: '#f8fafc',
            dropdownText: '#475569',
        },
        showCloseButton: true,
        showBackdrop: true,
        backdropOpacity: 0.4,
        accordionBehavior: 'multiple',
    },
};

/** Pill-style navigation with rounded buttons */
export const pillStylePreset: NavPreset = {
    name: 'Pill Style',
    description: 'Rounded pill-shaped navigation items',
    desktop: {
        orientation: 'horizontal',
        dropdownTrigger: 'hover',
        dropdownDirection: 'down',
        dropdownAlign: 'center',
        submenuDirection: 'right',
        colors: {
            background: 'rgba(255, 255, 255, 0.1)',
            backgroundHover: 'rgba(255, 255, 255, 0.2)',
            backgroundActive: 'rgba(255, 255, 255, 0.25)',
            text: '#ffffff',
            textHover: '#ffffff',
            dropdownBackground: 'rgba(255, 255, 255, 0.95)',
            dropdownItemHover: 'rgba(0, 0, 0, 0.05)',
            dropdownText: '#1f2937',
            dropdownBorder: 'transparent',
            dropdownShadow: '0 25px 60px rgba(0, 0, 0, 0.2)',
        },
        typography: {
            fontSize: '0.875rem',
            fontWeight: 500,
        },
        spacing: {
            itemGap: '0.5rem',
            itemPadding: '0.5rem 1.25rem',
            dropdownItemPadding: '0.5rem 1rem',
            dropdownPadding: '0.5rem',
        },
        borders: {
            itemRadius: '9999px',
            dropdownRadius: '1rem',
        },
        animation: {
            duration: '200ms',
            easing: 'ease',
            dropdownEnter: 'fade',
            caretRotation: true,
        },
        caret: {
            show: true,
            size: '0.875rem',
            position: 'after',
        },
        dropdownMinWidth: '12rem',
    },
    mobile: {
        style: 'drawer',
        drawerPosition: 'right',
        colors: {
            background: '#ffffff',
            backgroundHover: '#f3f4f6',
            text: '#1f2937',
            dropdownBackground: '#f9fafb',
            dropdownText: '#4b5563',
        },
        showCloseButton: true,
        showBackdrop: true,
        backdropOpacity: 0.5,
        accordionBehavior: 'single',
    },
};

/** Underline hover effect */
export const underlinePreset: NavPreset = {
    name: 'Underline',
    description: 'Elegant underline hover effect',
    desktop: {
        orientation: 'horizontal',
        dropdownTrigger: 'hover',
        dropdownDirection: 'down',
        dropdownAlign: 'start',
        submenuDirection: 'right',
        colors: {
            background: 'transparent',
            backgroundHover: 'transparent',
            text: 'inherit',
            textHover: 'inherit',
            dropdownBackground: '#ffffff',
            dropdownItemHover: '#f8fafc',
            dropdownText: '#1f2937',
            dropdownBorder: '#e2e8f0',
            dropdownShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
        },
        typography: {
            fontSize: '0.9375rem',
            fontWeight: 500,
        },
        spacing: {
            itemGap: '1.5rem',
            itemPadding: '0.25rem 0',
            dropdownItemPadding: '0.625rem 1rem',
            dropdownPadding: '0.5rem',
        },
        borders: {
            itemRadius: '0',
            dropdownRadius: '0.5rem',
        },
        animation: {
            duration: '200ms',
            easing: 'ease',
            dropdownEnter: 'fade',
            caretRotation: true,
        },
        caret: {
            show: true,
            size: '0.875rem',
            position: 'after',
        },
        dropdownMinWidth: '12rem',
    },
    mobile: {
        style: 'drawer',
        drawerPosition: 'right',
        colors: {
            background: '#ffffff',
            backgroundHover: '#f8fafc',
            text: '#1f2937',
            dropdownBackground: '#f1f5f9',
            dropdownText: '#475569',
        },
        showCloseButton: true,
        showBackdrop: true,
        backdropOpacity: 0.4,
        accordionBehavior: 'single',
    },
};

/** All available presets */
export const navPresets = {
    'dark-minimal': darkMinimalPreset,
    'light-clean': lightCleanPreset,
    'bold-uppercase': boldUppercasePreset,
    'click-dropdown': clickDropdownPreset,
    'pill-style': pillStylePreset,
    'underline': underlinePreset,
} as const;

export type NavPresetKey = keyof typeof navPresets;

/** Get a preset by key */
export function getNavPreset(key: NavPresetKey): NavPreset {
    return navPresets[key];
}

/** List all preset keys */
export function listNavPresets(): NavPresetKey[] {
    return Object.keys(navPresets) as NavPresetKey[];
}
