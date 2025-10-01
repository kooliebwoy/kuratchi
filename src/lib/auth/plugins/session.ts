/**
 * Session plugin - Core session management
 * Handles session cookies and basic session resolution
 */

import type { AuthPlugin, PluginContext, SessionContext } from '../core/plugin.js';
import { parseSessionCookie } from '../../utils/auth.js';

export interface SessionPluginOptions {
  /** Cookie name for session storage (default: 'kuratchi_session') */
  cookieName?: string;
  
  /** Custom session parser (optional) */
  parseSession?: (secret: string, cookie: string) => Promise<any>;
}

export function sessionPlugin(options: SessionPluginOptions = {}): AuthPlugin {
  const cookieName = options.cookieName || 'kuratchi_session';
  const parseSession = options.parseSession || parseSessionCookie;
  
  return {
    name: 'session',
    priority: 20, // Run early
    
    async onRequest(ctx: PluginContext) {
      // Initialize session placeholders
      if (!ctx.locals.kuratchi) ctx.locals.kuratchi = {};
      ctx.locals.kuratchi.user = null;
      ctx.locals.kuratchi.session = null;
      
      // Mirror at top level for convenience
      ctx.locals.user = null;
      ctx.locals.session = null;
      
      // Helper: Set session cookie
      ctx.locals.kuratchi.setSessionCookie = (value: string, opts?: { expires?: Date }) => {
        const expires = opts?.expires;
        const isHttps = new URL(ctx.event.request.url).protocol === 'https:';
        ctx.event.cookies.set(cookieName, value, {
          httpOnly: true,
          sameSite: 'lax',
          secure: isHttps,
          path: '/',
          ...(expires ? { expires } : {})
        });
      };
      
      // Helper: Clear session cookie
      ctx.locals.kuratchi.clearSessionCookie = () => {
        ctx.event.cookies.delete(cookieName, { path: '/' });
      };
      
      // Parse session from cookie
      const rawCookie = ctx.event.cookies.get(cookieName);
      if (rawCookie && ctx.env.KURATCHI_AUTH_SECRET) {
        try {
          const session = await parseSession(ctx.env.KURATCHI_AUTH_SECRET, rawCookie);
          if (session) {
            ctx.locals.kuratchi.session = session;
            ctx.locals.session = session;
            
            // Basic user object from session
            if (session.userId || session.email) {
              ctx.locals.kuratchi.user = {
                id: session.userId,
                email: session.email,
                organizationId: session.organizationId
              };
              ctx.locals.user = ctx.locals.kuratchi.user;
            }
          }
        } catch (error) {
          console.warn('[Kuratchi Session] Failed to parse session cookie:', error);
        }
      }
    },
    
    async onSession(ctx: SessionContext) {
      // Session is already resolved in onRequest
      // This hook allows other plugins to enrich the session
    }
  };
}
