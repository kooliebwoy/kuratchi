/**
 * Section Layout Types and Utilities
 * Provides consistent width, spacing, and height controls across all sections
 */

/**
 * Width presets for sections
 */
export type SectionWidth = 'full' | 'wide' | 'medium' | 'narrow' | 'compact';

/**
 * Spacing/padding presets using user-friendly names
 */
export type SectionSpacing = 'none' | 'tight' | 'comfortable' | 'spacious' | 'relaxed';

/**
 * Height mode options
 */
export type SectionHeightMode = 'auto' | 'small' | 'medium' | 'large' | 'viewport' | 'custom';

/**
 * Section layout configuration
 */
export interface SectionLayout {
    /** Section width - controls max-width */
    width: SectionWidth;
    /** Horizontal spacing (left/right) - uses friendly names */
    horizontalSpacing: SectionSpacing;
    /** Vertical spacing (top/bottom) - uses friendly names */
    verticalSpacing: SectionSpacing;
    /** Height mode */
    heightMode: SectionHeightMode;
    /** Custom height value (only used when heightMode is 'custom') */
    customHeight?: string;
    /** Whether section should have rounded corners */
    roundedCorners: boolean;
}

/**
 * Default section layout values
 */
export const DEFAULT_SECTION_LAYOUT: SectionLayout = {
    width: 'full',
    horizontalSpacing: 'comfortable',
    verticalSpacing: 'comfortable',
    heightMode: 'auto',
    roundedCorners: true
};

/**
 * Width preset values in pixels
 */
export const WIDTH_VALUES: Record<SectionWidth, string> = {
    full: '100%',
    wide: '1440px',
    medium: '1200px',
    narrow: '960px',
    compact: '720px'
};

/**
 * User-friendly labels for width options
 */
export const WIDTH_OPTIONS: { value: SectionWidth; label: string; description: string }[] = [
    { value: 'full', label: 'Full Width', description: 'Spans entire container' },
    { value: 'wide', label: 'Wide', description: '1440px max' },
    { value: 'medium', label: 'Medium', description: '1200px max' },
    { value: 'narrow', label: 'Narrow', description: '960px max' },
    { value: 'compact', label: 'Compact', description: '720px max' }
];

/**
 * Spacing preset values (CSS padding values)
 */
export const SPACING_VALUES: Record<SectionSpacing, string> = {
    none: '0',
    tight: 'clamp(0.75rem, 2vw, 1rem)',
    comfortable: 'clamp(1.5rem, 4vw, 2.5rem)',
    spacious: 'clamp(2.5rem, 6vw, 4rem)',
    relaxed: 'clamp(3.5rem, 8vw, 6rem)'
};

/**
 * User-friendly labels for spacing options
 */
export const SPACING_OPTIONS: { value: SectionSpacing; label: string; icon: string }[] = [
    { value: 'none', label: 'None', icon: '⊡' },
    { value: 'tight', label: 'Tight', icon: '▪' },
    { value: 'comfortable', label: 'Comfortable', icon: '◾' },
    { value: 'spacious', label: 'Spacious', icon: '◼' },
    { value: 'relaxed', label: 'Relaxed', icon: '⬛' }
];

/**
 * Height preset values
 */
export const HEIGHT_VALUES: Record<SectionHeightMode, string> = {
    auto: 'auto',
    small: 'clamp(200px, 30vh, 300px)',
    medium: 'clamp(320px, 50vh, 480px)',
    large: 'clamp(480px, 70vh, 720px)',
    viewport: '100vh',
    custom: 'auto' // Will use customHeight value
};

/**
 * User-friendly labels for height options
 */
export const HEIGHT_OPTIONS: { value: SectionHeightMode; label: string; description: string }[] = [
    { value: 'auto', label: 'Auto', description: 'Fits content' },
    { value: 'small', label: 'Small', description: '~30vh' },
    { value: 'medium', label: 'Medium', description: '~50vh' },
    { value: 'large', label: 'Large', description: '~70vh' },
    { value: 'viewport', label: 'Full Screen', description: '100vh' },
    { value: 'custom', label: 'Custom', description: 'Enter value' }
];

/**
 * Generate CSS variables for a section layout
 */
export function getSectionLayoutStyles(layout: Partial<SectionLayout> = {}): string {
    const merged = { ...DEFAULT_SECTION_LAYOUT, ...layout };
    
    const width = WIDTH_VALUES[merged.width];
    const paddingX = SPACING_VALUES[merged.horizontalSpacing];
    const paddingY = SPACING_VALUES[merged.verticalSpacing];
    const height = merged.heightMode === 'custom' && merged.customHeight 
        ? merged.customHeight 
        : HEIGHT_VALUES[merged.heightMode];
    // Use theme radius when rounded corners enabled, otherwise 0
    const radius = merged.roundedCorners ? 'var(--krt-theme-radius, 0.5rem)' : '0';

    return [
        `--section-max-width: ${width}`,
        `--section-padding-x: ${paddingX}`,
        `--section-padding-y: ${paddingY}`,
        `--section-min-height: ${height}`,
        `--section-border-radius: ${radius}`
    ].join('; ');
}

/**
 * CSS class that applies section layout variables
 * Add this to your section's root element
 */
export const SECTION_LAYOUT_CSS = `
    max-width: var(--section-max-width, 100%);
    margin-inline: auto;
    padding-inline: var(--section-padding-x, clamp(1.5rem, 4vw, 2.5rem));
    padding-block: var(--section-padding-y, clamp(1.5rem, 4vw, 2.5rem));
    min-height: var(--section-min-height, auto);
    border-radius: var(--section-border-radius, var(--krt-theme-radius, 0.5rem));
`;

/**
 * Merge a partial layout with defaults
 */
export function mergeLayoutWithDefaults(layout?: Partial<SectionLayout>): SectionLayout {
    return { ...DEFAULT_SECTION_LAYOUT, ...layout };
}
