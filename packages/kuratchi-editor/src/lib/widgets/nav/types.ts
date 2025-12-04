/**
 * Navigation Widget System Types
 * 
 * A composable navigation system that can be used in headers, footers,
 * and anywhere else navigation is needed.
 */

/** Dropdown trigger behavior */
export type DropdownTrigger = 'hover' | 'click';

/** Dropdown open direction */
export type DropdownDirection = 'down' | 'up';

/** Dropdown alignment relative to trigger */
export type DropdownAlign = 'start' | 'center' | 'end';

/** Submenu open direction */
export type SubmenuDirection = 'right' | 'left';

/** Navigation layout orientation */
export type NavOrientation = 'horizontal' | 'vertical';

/** Individual navigation menu item */
export interface NavMenuItem {
    id: string;
    label: string;
    url?: string;
    pageId?: string;
    isExternal?: boolean;
    target?: '_blank' | '_self' | '_parent' | '_top';
    rel?: string;
    title?: string;
    ariaLabel?: string;
    openInNewTab?: boolean;
    icon?: string;
    children?: NavMenuItem[];
}

/** Color configuration for navigation elements */
export interface NavColors {
    /** Background color of the nav container */
    background?: string;
    /** Background color on hover */
    backgroundHover?: string;
    /** Background color when active/open */
    backgroundActive?: string;
    /** Text/link color */
    text?: string;
    /** Text color on hover */
    textHover?: string;
    /** Text color when active */
    textActive?: string;
    /** Border color */
    border?: string;
    /** Dropdown background */
    dropdownBackground?: string;
    /** Dropdown item hover background */
    dropdownItemHover?: string;
    /** Dropdown text color */
    dropdownText?: string;
    /** Dropdown border color */
    dropdownBorder?: string;
    /** Dropdown shadow */
    dropdownShadow?: string;
}

/** Typography configuration */
export interface NavTypography {
    /** Font family */
    fontFamily?: string;
    /** Font size */
    fontSize?: string;
    /** Font weight */
    fontWeight?: string | number;
    /** Letter spacing */
    letterSpacing?: string;
    /** Text transform */
    textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
    /** Line height */
    lineHeight?: string;
}

/** Spacing configuration */
export interface NavSpacing {
    /** Gap between nav items */
    itemGap?: string;
    /** Padding inside nav items */
    itemPadding?: string;
    /** Padding inside dropdown items */
    dropdownItemPadding?: string;
    /** Dropdown container padding */
    dropdownPadding?: string;
}

/** Border & radius configuration */
export interface NavBorders {
    /** Nav item border radius */
    itemRadius?: string;
    /** Dropdown container border radius */
    dropdownRadius?: string;
    /** Border width */
    borderWidth?: string;
}

/** Animation configuration */
export interface NavAnimation {
    /** Transition duration */
    duration?: string;
    /** Transition easing */
    easing?: string;
    /** Dropdown enter animation */
    dropdownEnter?: 'fade' | 'slide' | 'scale' | 'none';
    /** Caret rotation on open */
    caretRotation?: boolean;
}

/** Caret/chevron configuration */
export interface NavCaret {
    /** Show caret for items with children */
    show?: boolean;
    /** Caret icon size */
    size?: string;
    /** Custom caret icon (lucide icon name) */
    icon?: string;
    /** Caret position relative to label */
    position?: 'after' | 'before';
}

/** Desktop navigation configuration */
export interface DesktopNavConfig {
    /** Layout orientation */
    orientation?: NavOrientation;
    /** Dropdown trigger behavior */
    dropdownTrigger?: DropdownTrigger;
    /** Dropdown direction */
    dropdownDirection?: DropdownDirection;
    /** Dropdown alignment */
    dropdownAlign?: DropdownAlign;
    /** Submenu direction */
    submenuDirection?: SubmenuDirection;
    /** Color configuration */
    colors?: NavColors;
    /** Typography configuration */
    typography?: NavTypography;
    /** Spacing configuration */
    spacing?: NavSpacing;
    /** Border configuration */
    borders?: NavBorders;
    /** Animation configuration */
    animation?: NavAnimation;
    /** Caret configuration */
    caret?: NavCaret;
    /** Minimum dropdown width */
    dropdownMinWidth?: string;
    /** Maximum dropdown width */
    dropdownMaxWidth?: string;
    /** Show icons in nav items */
    showIcons?: boolean;
}

/** Mobile navigation configuration */
export interface MobileNavConfig {
    /** Breakpoint at which to switch to mobile (e.g., '768px') */
    breakpoint?: string;
    /** Mobile menu style */
    style?: 'drawer' | 'fullscreen' | 'dropdown' | 'accordion';
    /** Drawer position (if style is 'drawer') */
    drawerPosition?: 'left' | 'right' | 'top' | 'bottom';
    /** Color configuration (can differ from desktop) */
    colors?: NavColors;
    /** Typography configuration */
    typography?: NavTypography;
    /** Spacing configuration */
    spacing?: NavSpacing;
    /** Animation for mobile menu open/close */
    animation?: NavAnimation;
    /** Show close button */
    showCloseButton?: boolean;
    /** Show backdrop overlay */
    showBackdrop?: boolean;
    /** Backdrop opacity */
    backdropOpacity?: number;
    /** Accordion behavior for nested items */
    accordionBehavior?: 'single' | 'multiple';
}

/** Complete navigation configuration */
export interface NavConfig {
    /** Menu items */
    items: NavMenuItem[];
    /** Desktop configuration */
    desktop?: DesktopNavConfig;
    /** Mobile configuration */
    mobile?: MobileNavConfig;
    /** ARIA label for the nav element */
    ariaLabel?: string;
    /** CSS class prefix for custom styling */
    classPrefix?: string;
}

/** Default desktop configuration */
export const defaultDesktopConfig: DesktopNavConfig = {
    orientation: 'horizontal',
    dropdownTrigger: 'hover',
    dropdownDirection: 'down',
    dropdownAlign: 'start',
    submenuDirection: 'right',
    colors: {
        background: 'transparent',
        backgroundHover: 'rgba(255, 255, 255, 0.1)',
        backgroundActive: 'rgba(255, 255, 255, 0.15)',
        text: 'inherit',
        textHover: 'inherit',
        textActive: 'inherit',
        dropdownBackground: 'rgba(0, 0, 0, 0.9)',
        dropdownItemHover: 'rgba(255, 255, 255, 0.1)',
        dropdownText: '#ffffff',
        dropdownBorder: 'rgba(255, 255, 255, 0.1)',
        dropdownShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
    },
    typography: {
        fontSize: '0.9375rem',
        fontWeight: 500,
        letterSpacing: '0',
        textTransform: 'none',
    },
    spacing: {
        itemGap: '0.25rem',
        itemPadding: '0.5rem 0.75rem',
        dropdownItemPadding: '0.5rem 0.75rem',
        dropdownPadding: '0.5rem',
    },
    borders: {
        itemRadius: '0.375rem',
        dropdownRadius: '0.5rem',
        borderWidth: '1px',
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
        icon: 'ChevronDown',
        position: 'after',
    },
    dropdownMinWidth: '12rem',
    showIcons: false,
};

/** Default mobile configuration */
export const defaultMobileConfig: MobileNavConfig = {
    breakpoint: '768px',
    style: 'drawer',
    drawerPosition: 'right',
    colors: {
        background: '#ffffff',
        backgroundHover: '#f3f4f6',
        text: '#1f2937',
        textHover: '#111827',
        dropdownBackground: '#f9fafb',
        dropdownItemHover: '#f3f4f6',
        dropdownText: '#374151',
    },
    typography: {
        fontSize: '1rem',
        fontWeight: 500,
    },
    spacing: {
        itemPadding: '0.75rem 1rem',
        dropdownItemPadding: '0.625rem 1rem 0.625rem 2rem',
    },
    animation: {
        duration: '300ms',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
    showCloseButton: true,
    showBackdrop: true,
    backdropOpacity: 0.5,
    accordionBehavior: 'single',
};

/** Merge user config with defaults */
export function mergeNavConfig(userConfig: Partial<NavConfig>): NavConfig {
    return {
        items: userConfig.items || [],
        desktop: {
            ...defaultDesktopConfig,
            ...userConfig.desktop,
            colors: { ...defaultDesktopConfig.colors, ...userConfig.desktop?.colors },
            typography: { ...defaultDesktopConfig.typography, ...userConfig.desktop?.typography },
            spacing: { ...defaultDesktopConfig.spacing, ...userConfig.desktop?.spacing },
            borders: { ...defaultDesktopConfig.borders, ...userConfig.desktop?.borders },
            animation: { ...defaultDesktopConfig.animation, ...userConfig.desktop?.animation },
            caret: { ...defaultDesktopConfig.caret, ...userConfig.desktop?.caret },
        },
        mobile: {
            ...defaultMobileConfig,
            ...userConfig.mobile,
            colors: { ...defaultMobileConfig.colors, ...userConfig.mobile?.colors },
            typography: { ...defaultMobileConfig.typography, ...userConfig.mobile?.typography },
            spacing: { ...defaultMobileConfig.spacing, ...userConfig.mobile?.spacing },
            animation: { ...defaultMobileConfig.animation, ...userConfig.mobile?.animation },
        },
        ariaLabel: userConfig.ariaLabel || 'Main navigation',
        classPrefix: userConfig.classPrefix || 'krt-nav',
    };
}
