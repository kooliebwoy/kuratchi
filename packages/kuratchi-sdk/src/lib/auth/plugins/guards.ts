/**
 * Guards plugin - Route protection and authorization
 * Executes route guards to protect endpoints
 */

import type { AuthPlugin, SessionContext } from '../core/plugin.js';
import type { RouteGuard } from '../utils/types.js';

export interface GuardsPluginOptions {
  /**
   * Array of route guards to execute
   * Guards run in order and can short-circuit with a Response
   */
  guards?: RouteGuard[];
}

export function guardsPlugin(options: GuardsPluginOptions = {}): AuthPlugin {
  const guards = options.guards || [];
  
  return {
    name: 'guards',
    priority: 80, // Run late, after all auth flows
    
    async onSession(ctx: SessionContext) {
      // Execute all guards
      for (const guard of guards) {
        const result = await guard({
          event: ctx.event,
          locals: ctx.locals,
          session: ctx.session
        });
        
        // If guard returns a Response, store it to be returned
        if (result instanceof Response) {
          // Store in context so it can be returned by the handle
          (ctx as any).__guardResponse__ = result;
          break;
        }
      }
    }
  };
}

/**
 * Helper to create a simple auth guard
 */
export function requireAuth(options: {
  /** URL pattern to match (supports wildcards) */
  pattern?: string | RegExp;
  /** Redirect URL if not authenticated */
  redirectTo?: string;
  /** Custom check function */
  check?: (ctx: SessionContext) => boolean;
} = {}): RouteGuard {
  return async ({ event, session }) => {
    // Check pattern if provided
    if (options.pattern) {
      const pathname = new URL(event.request.url).pathname;
      const matches = typeof options.pattern === 'string'
        ? matchPattern(pathname, options.pattern)
        : options.pattern.test(pathname);
      
      if (!matches) return; // Pattern doesn't match, skip guard
    }
    
    // Check custom function
    if (options.check) {
      const ctx: SessionContext = { event, locals: event.locals, session, user: event.locals.user, env: {} as any };
      if (options.check(ctx)) return; // Check passed
    } else {
      // Default: check if session exists
      if (session) return; // Authenticated
    }
    
    // Not authenticated - redirect or return 401
    if (options.redirectTo) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: options.redirectTo
        }
      });
    }
    
    return new Response('Unauthorized', { status: 401 });
  };
}

/**
 * Simple glob pattern matcher
 * Supports * wildcard
 */
function matchPattern(pathname: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\//g, '\\/');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(pathname);
}
