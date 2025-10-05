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
    priority: 45, // Run after admin (30) and organization (40) plugins to access database helpers
    
    async onRequest(ctx: PluginContext) {
      // Initialize session placeholders
      if (!ctx.locals.kuratchi) ctx.locals.kuratchi = {};
      ctx.locals.kuratchi.auth = ctx.locals.kuratchi.auth || {} as any;
      ctx.locals.kuratchi.auth.session = ctx.locals.kuratchi.auth.session || {} as any;
      
      ctx.locals.session = null;
      
      // Helper: Set session cookie
      ctx.locals.kuratchi.auth.session.setCookie = (value: string, opts?: { expires?: Date }) => {
        const expires = opts?.expires;
        const isHttps = new URL(ctx.event.request.url).protocol === 'https:';
        ctx.event.cookies.set(cookieName, value, {
          path: '/',
          httpOnly: true,
          secure: isHttps,
          sameSite: 'lax',
          expires
        });
      };
      
      // Helper: Clear session cookie
      ctx.locals.kuratchi.auth.session.clearCookie = () => {
        ctx.event.cookies.delete(cookieName, { path: '/' });
      };
      
      // Parse session from cookie and load from database
      const rawCookie = ctx.event.cookies.get(cookieName);
      
      if (rawCookie && ctx.env.KURATCHI_AUTH_SECRET) {
        try {
          // Parse cookie to get orgId and tokenHash
          const parsed = await parseSession(ctx.env.KURATCHI_AUTH_SECRET, rawCookie);
          
          if (parsed && parsed.tokenHash) {
            // Get database client based on orgId
            let db: any;
            if (parsed.orgId && parsed.orgId !== 'admin') {
              // Organization database
              const getOrgDb = ctx.locals.kuratchi?.orgDatabaseClient;
              if (getOrgDb) {
                db = await getOrgDb(parsed.orgId);
              }
            } else {
              // Admin database
              const getAdminDb = ctx.locals.kuratchi?.getAdminDb;
              if (getAdminDb) {
                db = await getAdminDb();
              }
            }
            
            if (db) {
              // Look up session in database
              const { data: sessionRecord } = await db.session
                .where({ sessionToken: parsed.tokenHash })
                .first();
              
              if (sessionRecord) {
                // Check if session is expired
                const now = new Date();
                
                if (sessionRecord.expires && new Date(sessionRecord.expires) > now) {
                  // Load user from database
                  const { data: user } = await db.users
                    .where({ id: sessionRecord.userId })
                    .first();
                  
                  if (user) {
                    // Build enriched session (batteries included)
                    const enrichedSession = {
                      userId: user.id,
                      email: user.email,
                      organizationId: parsed.orgId,
                      roles: user.role ? [user.role] : [],
                      isEmailVerified: !!user.emailVerified,
                      user: {
                        id: user.id,
                        email: user.email,
                        name: user.name || null,
                        firstName: user.firstName || null,
                        lastName: user.lastName || null,
                        role: user.role || null,
                        image: user.image || null,
                        organizationId: parsed.orgId || null
                      },
                      createdAt: sessionRecord.created_at,
                      lastAccessedAt: new Date().toISOString(),
                      ipAddress: ctx.event.request.headers.get('cf-connecting-ip') 
                        || ctx.event.request.headers.get('x-forwarded-for') 
                        || (ctx.event as any).getClientAddress?.(),
                      userAgent: ctx.event.request.headers.get('user-agent')
                    };
                    
                    // Set session in locals (access via locals.session.user)
                    ctx.locals.session = enrichedSession;
                  } else {
                    // User not found - delete session
                    await db.session.delete({ sessionToken: parsed.tokenHash });
                  }
                } else {
                  // Session expired - delete it
                  await db.session.delete({ sessionToken: parsed.tokenHash });
                }
              }
            }
          }
        } catch (error) {
          console.warn('[Kuratchi Session] Failed to load session:', error);
        }
      }
    },
    
    async onSession(ctx: SessionContext) {
      // Session is already resolved in onRequest
      // This hook allows other plugins to enrich the session
    }
  };
}
