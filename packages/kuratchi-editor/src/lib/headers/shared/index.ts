/**
 * Shared Header Exports
 * 
 * Central export point for all shared header utilities and types.
 */

// Types
export * from './types.js';

// Configuration utilities
export {
    normalizeMenuItems,
    createDesktopNavConfig,
    createMobileNavConfig,
    DEFAULT_LOGO,
    DEFAULT_MENU,
    DEFAULT_SOCIAL_ICONS,
    type CreateDesktopNavConfigOptions,
    type CreateMobileNavConfigOptions,
} from './config.js';
