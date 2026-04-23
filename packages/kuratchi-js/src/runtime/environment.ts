/**
 * Environment module for kuratchi:environment virtual import.
 *
 * Provides compile-time environment flags that are set by the framework.
 * The `dev` flag is true during development builds and false in production.
 *
 * Usage in server code (middleware.ts, .do.ts, etc.):
 * ```ts
 * import { dev } from 'kuratchi:environment';
 *
 * if (dev) {
 *   // Skip auth checks, enable debug logging, etc.
 * }
 * ```
 */

declare const globalThis: {
  __kuratchi_DEV__?: boolean;
};

/**
 * True when running in development mode (kuratchi dev), false in production.
 * This is a compile-time constant set by the framework.
 */
export const dev: boolean = globalThis.__kuratchi_DEV__ === true;
