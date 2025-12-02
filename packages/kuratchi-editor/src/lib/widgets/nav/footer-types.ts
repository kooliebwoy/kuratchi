/**
 * Footer Navigation Widget Types
 * 
 * A composable footer navigation system that supports both
 * column-based layouts and simple link lists.
 */

/** Individual footer link item */
export interface FooterLink {
    id?: string;
    label: string;
    url?: string;
    /** External link opens in new tab */
    external?: boolean;
}

/** A column/group of footer links with a heading */
export interface FooterLinkColumn {
    id?: string;
    /** Column heading/title */
    heading: string;
    /** Links in this column */
    links: FooterLink[];
}

/** Color configuration for footer nav */
export interface FooterNavColors {
    /** Background color */
    background?: string;
    /** Heading text color */
    headingText?: string;
    /** Link text color */
    linkText?: string;
    /** Link hover color */
    linkHover?: string;
    /** Link underline color on hover */
    underlineColor?: string;
}

/** Typography configuration */
export interface FooterNavTypography {
    /** Heading font size */
    headingSize?: string;
    /** Heading font weight */
    headingWeight?: number | string;
    /** Heading text transform */
    headingTransform?: 'none' | 'uppercase' | 'capitalize' | 'lowercase';
    /** Heading letter spacing */
    headingLetterSpacing?: string;
    /** Link font size */
    linkSize?: string;
    /** Link font weight */
    linkWeight?: number | string;
}

/** Spacing configuration */
export interface FooterNavSpacing {
    /** Gap between columns */
    columnGap?: string;
    /** Gap between heading and links */
    headingGap?: string;
    /** Gap between individual links */
    linkGap?: string;
}

/** Layout configuration for column-based footer */
export interface FooterColumnsConfig {
    /** Layout style */
    layout: 'columns';
    /** Number of columns on different breakpoints */
    columns?: {
        mobile?: number;
        tablet?: number;
        desktop?: number;
    };
    /** Colors */
    colors?: FooterNavColors;
    /** Typography */
    typography?: FooterNavTypography;
    /** Spacing */
    spacing?: FooterNavSpacing;
}

/** Layout configuration for simple link list */
export interface FooterLinksConfig {
    /** Layout style */
    layout: 'horizontal' | 'vertical';
    /** Show separators between links */
    showSeparator?: boolean;
    /** Separator character */
    separator?: string;
    /** Colors */
    colors?: FooterNavColors;
    /** Typography - only uses link styles */
    typography?: Pick<FooterNavTypography, 'linkSize' | 'linkWeight'>;
    /** Spacing */
    spacing?: Pick<FooterNavSpacing, 'linkGap'>;
}

/** Union of all footer nav configurations */
export type FooterNavConfig = FooterColumnsConfig | FooterLinksConfig;

/** Default configuration for columns layout */
export const defaultColumnsConfig: FooterColumnsConfig = {
    layout: 'columns',
    columns: {
        mobile: 1,
        tablet: 2,
        desktop: 3,
    },
    colors: {
        background: 'transparent',
        headingText: 'inherit',
        linkText: 'inherit',
        linkHover: 'inherit',
    },
    typography: {
        headingSize: '0.8rem',
        headingWeight: 600,
        headingTransform: 'uppercase',
        headingLetterSpacing: '0.14em',
        linkSize: '0.95rem',
        linkWeight: 400,
    },
    spacing: {
        columnGap: '2rem',
        headingGap: '0.5rem',
        linkGap: '0.25rem',
    },
};

/** Default configuration for horizontal links layout */
export const defaultLinksConfig: FooterLinksConfig = {
    layout: 'horizontal',
    showSeparator: false,
    colors: {
        linkText: 'inherit',
        linkHover: 'inherit',
    },
    typography: {
        linkSize: '0.95rem',
        linkWeight: 500,
    },
    spacing: {
        linkGap: '0.5rem',
    },
};

/** Helper to check if config is columns layout */
export function isColumnsConfig(config: FooterNavConfig): config is FooterColumnsConfig {
    return config.layout === 'columns';
}

/** Helper to merge config with defaults */
export function mergeFooterConfig<T extends FooterNavConfig>(
    config: Partial<T>,
    defaults: T
): T {
    return {
        ...defaults,
        ...config,
        colors: { ...defaults.colors, ...config.colors },
        typography: { ...defaults.typography, ...config.typography },
        spacing: { ...defaults.spacing, ...config.spacing },
    } as T;
}
