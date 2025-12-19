/**
 * Shared Header Types
 * 
 * These types provide a consistent foundation for all header components.
 * Use these types instead of defining them locally in each header.
 */

import type { NavMenuItem, DesktopNavConfig, MobileNavConfig } from '../../widgets/index.js';

// ============================================================================
// Logo Types
// ============================================================================

export interface LogoData {
    url: string;
    alt: string;
}

// ============================================================================
// Social Icon Types
// ============================================================================

export interface SocialIcon {
    icon: string;  // Lucide icon key
    link: string;
    name: string;
    enabled: boolean;
}

// ============================================================================
// Navigation Configuration Types
// ============================================================================

export type DropdownTriggerOption = 'hover' | 'click';
export type DropdownAlignOption = 'start' | 'center' | 'end';
export type SubmenuDirectionOption = 'left' | 'right';
export type MobileStyleOption = 'drawer' | 'fullscreen';
export type DrawerPositionOption = 'left' | 'right';

export interface NavConfigProps {
    navDropdownTrigger?: DropdownTriggerOption;
    navDropdownAlign?: DropdownAlignOption;
    navSubmenuDirection?: SubmenuDirectionOption;
    navHoverBgColor?: string;
    navHoverTextColor?: string;
    navDropdownBgColor?: string;
    navDropdownTextColor?: string;
    navDropdownHoverBgColor?: string;
    navDropdownHoverTextColor?: string;
    mobileNavStyle?: MobileStyleOption;
    mobileDrawerPosition?: DrawerPositionOption;
}

// ============================================================================
// Base Header Props
// ============================================================================

/**
 * Common props that all headers share.
 * Extend this interface for header-specific props.
 */
export interface BaseHeaderProps extends NavConfigProps {
    type?: string;
    backgroundColor?: string;
    textColor?: string;
    logo?: LogoData;
    menu?: NavMenuItem[];
    isSticky?: boolean;
    editable?: boolean;
    menuHidden?: boolean;
}

// ============================================================================
// Header Content (for serialization)
// ============================================================================

/**
 * Base content structure for serialization.
 * Each header should extend this with its specific content.
 */
export interface BaseHeaderContent {
    id: string;
    type: string;
    backgroundColor: string;
    textColor: string;
    logo: LogoData;
    menu: NavMenuItem[];
    isSticky: boolean;
    // Nav config
    navDropdownTrigger: DropdownTriggerOption;
    navDropdownAlign: DropdownAlignOption;
    navSubmenuDirection: SubmenuDirectionOption;
    navHoverBgColor: string;
    navHoverTextColor: string;
    navDropdownBgColor: string;
    navDropdownTextColor: string;
    navDropdownHoverBgColor: string;
    navDropdownHoverTextColor: string;
    mobileNavStyle: MobileStyleOption;
    mobileDrawerPosition: DrawerPositionOption;
}

// ============================================================================
// Inspector Section Types (for reusable inspector components)
// ============================================================================

export interface InspectorColorField {
    label: string;
    value: string;
    onChange: (value: string) => void;
}

export interface InspectorToggleField {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

// Re-export nav types for convenience
export type { NavMenuItem, DesktopNavConfig, MobileNavConfig };
