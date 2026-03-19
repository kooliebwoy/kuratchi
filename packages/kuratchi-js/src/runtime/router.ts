/**
 * URL router — matches incoming requests to route modules.
 *
 * Supports:
 *   /todos          → static
 *   /blog/:slug     → named param
 *   /files/*rest    → catch-all
 */

export interface MatchResult {
  params: Record<string, string>;
  index: number;
}

interface CompiledRoute {
  regex: RegExp;
  paramNames: string[];
  index: number;
}

export class Router {
  private staticRoutes = new Map<string, number>();
  private dynamicRoutes: CompiledRoute[] = [];

  /** Register a pattern (e.g. '/blog/:slug') and associate it with an index. */
  add(pattern: string, index: number): void {
    if (!pattern.includes(':') && !pattern.includes('*')) {
      this.staticRoutes.set(pattern, index);
      return;
    }

    const paramNames: string[] = [];

    // Convert pattern to regex
    // :param  → named capture group
    // *param  → catch-all capture group
    let regexStr = pattern
      // Catch-all: /files/*rest → /files/(?<rest>.+)
      .replace(/\*(\w+)/g, (_match, name) => {
        paramNames.push(name);
        return `(?<${name}>.+)`;
      })
      // Named params: /blog/:slug → /blog/(?<slug>[^/]+)
      .replace(/:(\w+)/g, (_match, name) => {
        paramNames.push(name);
        return `(?<${name}>[^/]+)`;
      });

    // Anchor
    regexStr = `^${regexStr}$`;

    this.dynamicRoutes.push({
      regex: new RegExp(regexStr),
      paramNames,
      index,
    });
  }

  /** Match a pathname against registered routes. Returns null if no match. */
  match(pathname: string): MatchResult | null {
    // Normalize: strip trailing slash (except root)
    const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');

    const staticIdx = this.staticRoutes.get(normalized);
    if (staticIdx !== undefined) {
      return { params: {}, index: staticIdx };
    }

    for (const route of this.dynamicRoutes) {
      const m = normalized.match(route.regex);
      if (m) {
        const params: Record<string, string> = {};
        for (const name of route.paramNames) {
          params[name] = m.groups?.[name] ?? '';
        }
        return { params, index: route.index };
      }
    }
    return null;
  }
}

/**
 * Convert a file-system path to a route pattern.
 *
 * Examples:
 *   'index'        → '/'
 *   'about'        → '/about'
 *   'blog/[slug]'  → '/blog/:slug'
 *   'files/[...path]' → '/files/*path'
 */
export function filePathToPattern(filePath: string): string {
  if (filePath === 'index') return '/';

  let pattern = '/' + filePath
    // [...param] → *param (catch-all)
    .replace(/\[\.\.\.(\w+)\]/g, '*$1')
    // [param] → :param
    .replace(/\[(\w+)\]/g, ':$1');

  // Remove trailing /index
  pattern = pattern.replace(/\/index$/, '') || '/';

  return pattern;
}
