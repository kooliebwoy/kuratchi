/**
 * Centralized kuratchi:* virtual module resolution.
 *
 * All kuratchi:* imports are rewritten to @kuratchi/js runtime paths.
 * This is the single source of truth for virtual module mapping.
 *
 * Usage:
 *   import { dev } from 'kuratchi:environment';
 *   import { url, params, locals } from 'kuratchi:request';
 *   import { redirect } from 'kuratchi:navigation';
 */

/**
 * Map of kuratchi:* module names to their @kuratchi/js runtime paths.
 * All paths use the ./runtime/*.js pattern for consistency.
 */
export const VIRTUAL_MODULE_MAP: Record<string, string> = {
  environment: '@kuratchi/js/runtime/environment.js',
  request: '@kuratchi/js/runtime/request.js',
  navigation: '@kuratchi/js/runtime/navigation.js',
};

/** All supported kuratchi:* module names */
export const VIRTUAL_MODULE_NAMES = Object.keys(VIRTUAL_MODULE_MAP);

/**
 * Check if a module specifier is a kuratchi:* virtual module
 */
export function isKuratchiVirtualModule(spec: string): boolean {
  return spec.startsWith('kuratchi:');
}

/**
 * Resolve a kuratchi:* virtual module to its @kuratchi/js runtime path.
 * Returns the original specifier if not a known virtual module.
 */
export function resolveKuratchiVirtualModule(spec: string): string {
  if (!spec.startsWith('kuratchi:')) return spec;
  const moduleName = spec.slice('kuratchi:'.length);
  return VIRTUAL_MODULE_MAP[moduleName] ?? spec;
}

/**
 * Get the module name from a kuratchi:* specifier (e.g., 'kuratchi:request' -> 'request')
 */
export function getKuratchiModuleName(spec: string): string | null {
  if (!spec.startsWith('kuratchi:')) return null;
  return spec.slice('kuratchi:'.length);
}

/**
 * TypeScript module declarations for all kuratchi:* virtual modules.
 * Used by type-generator.ts to emit into app.d.ts.
 */
export const VIRTUAL_MODULE_TYPE_DECLARATIONS = `
/** Virtual module: kuratchi:environment */
declare module 'kuratchi:environment' {
  /** True in development mode (kuratchi dev), false in production */
  export const dev: boolean;
}

/** Virtual module: kuratchi:request */
declare module 'kuratchi:request' {
  /** Current request URL */
  export const url: URL;
  /** Current pathname (e.g., '/blog/hello-world') */
  export const pathname: string;
  /** URL search params */
  export const searchParams: URLSearchParams;
  /** Request headers */
  export const headers: Headers;
  /** HTTP method (GET, POST, etc.) */
  export const method: string;
  /** Route params (e.g., { slug: 'hello-world' }) */
  export const params: Record<string, string>;
  /** Shorthand for params.slug or first param value */
  export const slug: string | undefined;
  /** Request-scoped locals set by runtime hooks */
  export const locals: App.Locals;
  /** Get request-scoped locals with full type safety */
  export function getLocals(): App.Locals;
}

/** Virtual module: kuratchi:navigation */
declare module 'kuratchi:navigation' {
  /** Redirect to a path. Throws RedirectError caught by the framework. */
  export function redirect(path: string, status?: number): never;
}
`.trim();
