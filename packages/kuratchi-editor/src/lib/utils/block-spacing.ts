/**
 * Block spacing utilities for controlling margins between blocks.
 * Provides consistent spacing controls for all editor blocks.
 */

export type BlockSpacing = 'none' | 'tight' | 'normal' | 'relaxed' | 'loose';

/**
 * CSS margin values for each spacing preset
 */
export const BLOCK_SPACING_VALUES: Record<BlockSpacing, string> = {
    none: '0',
    tight: '0.25rem',
    normal: '0.5rem',
    relaxed: '1rem',
    loose: '1.5rem'
};

/**
 * User-friendly labels for spacing options
 */
export const BLOCK_SPACING_OPTIONS: { value: BlockSpacing; label: string; description: string }[] = [
    { value: 'none', label: 'None', description: 'No space' },
    { value: 'tight', label: 'Tight', description: 'Minimal space' },
    { value: 'normal', label: 'Normal', description: 'Standard space' },
    { value: 'relaxed', label: 'Relaxed', description: 'Extra space' },
    { value: 'loose', label: 'Loose', description: 'Maximum space' }
];

/**
 * Get CSS style string for block spacing
 */
export function getBlockSpacingStyle(spacing?: BlockSpacing): string {
    const marginTop = BLOCK_SPACING_VALUES[spacing ?? 'normal'];
    return `margin-top: ${marginTop}`;
}

/**
 * Default metadata for blocks with spacing support
 */
export interface SpacingMetadata {
    spacingTop?: BlockSpacing;
    spacingBottom?: BlockSpacing;
}

export const DEFAULT_SPACING: SpacingMetadata = {
    spacingTop: 'normal',
    spacingBottom: 'normal'
};
