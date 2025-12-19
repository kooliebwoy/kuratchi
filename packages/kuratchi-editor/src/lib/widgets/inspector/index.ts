/**
 * Inspector Widgets
 * 
 * Reusable UI components for building block/header/footer inspectors.
 * These widgets provide consistent editing experiences across all components.
 */

// Layout & Structure
export { default as InspectorSection } from './InspectorSection.svelte';
export { default as InspectorCard } from './InspectorCard.svelte';

// Common Controls
export { default as ColorControl } from './ColorControl.svelte';
export { default as ToggleControl } from './ToggleControl.svelte';
export { default as SelectControl } from './SelectControl.svelte';

// Header-specific Widgets
export { default as LogoEditor } from './LogoEditor.svelte';
export { default as SocialLinksEditor } from './SocialLinksEditor.svelte';
export { default as MobileMenuSettings } from './MobileMenuSettings.svelte';

// Re-export types
export type { InspectorSectionProps } from './InspectorSection.svelte';
