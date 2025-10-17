/**
 * Credentials Plugin - Email/password authentication
 * Handles username/password login with rate limiting
 */

import type { AuthPlugin, PluginContext } from '../core/plugin.js';
import { comparePassword, hashToken, buildSessionCookie, parseSessionCookie, generateSessionToken } from '../../utils/auth.js';

export interface CredentialsPluginOptions {
  /** Cookie name for session storage (default: 'kuratchi_session') */
  cookieName?: string;
  
  /** Login route (default: '/auth/credentials/login') */
  loginRoute?: string;
  
  /** Logout route (default: '/auth/credentials/logout') */
  logoutRoute?: string;
  
  /** Max login attempts before lockout (default: 5) */
  maxAttempts?: number;
  
  /** Lockout duration in milliseconds (default: 900000 = 15 min) */
  lockoutDuration?: number;
  
  /** Custom authentication function */
  authenticate?: (email: string, password: string, ctx: PluginContext) => Promise<any | null>;
  
  /** Callback after successful login */
  onSuccess?: (user: any) => Promise<void>;
  
  /** Callback after failed login */
  onFailure?: (email: string) => Promise<void>;
}

async function findOrganizationIdByEmail(adminDb: any, email: string): Promise<string | null> {
  if (!adminDb) return null;
  
  try {
    const { data: orgUsers } = await adminDb.organizationUsers
      .where({ email })
      .first();
    
    // Use camelCase to match admin plugin schema
    return orgUsers?.organizationId || null;
  } catch (error) {
    console.warn('[Credentials] Failed to find organization for email:', error);
    return null;
  }
}

// Use shared password comparison utility
const verifyPassword = comparePassword;

async function checkRateLimit(
  kv: any,
  email: string,
  maxAttempts: number,
  lockoutDuration: number
): Promise<{ allowed: boolean; remainingAttempts: number }> {
  if (!kv) return { allowed: true, remainingAttempts: maxAttempts };
  
  const key = `login_attempts:${email}`;
  const data = await kv.get(key, { type: 'json' });
  
  if (!data) {
    return { allowed: true, remainingAttempts: maxAttempts };
  }
  
  const attempts = data.attempts || 0;
  const lockedUntil = data.lockedUntil || 0;
  
  // Check if still locked
  if (lockedUntil > Date.now()) {
    return { allowed: false, remainingAttempts: 0 };
  }
  
  const remaining = Math.max(0, maxAttempts - attempts);
  return { allowed: remaining > 0, remainingAttempts: remaining };
}

async function recordFailedAttempt(
  kv: any,
  email: string,
  maxAttempts: number,
  lockoutDuration: number
): Promise<void> {
  if (!kv) return;
  
  const key = `login_attempts:${email}`;
  const data = await kv.get(key, { type: 'json' }) || { attempts: 0 };
  
  const attempts = (data.attempts || 0) + 1;
  const newData: any = { attempts };
  
  // If max attempts reached, set lockout
  if (attempts >= maxAttempts) {
    newData.lockedUntil = Date.now() + lockoutDuration;
  }
  
  await kv.put(key, JSON.stringify(newData), {
    expirationTtl: Math.floor(lockoutDuration / 1000)
  });
}

async function clearAttempts(kv: any, email: string): Promise<void> {
  if (!kv) return;
  await kv.delete(`login_attempts:${email}`);
}

export function credentialsPlugin(options: CredentialsPluginOptions = {}): AuthPlugin {
  const maxAttempts = options.maxAttempts || 5;
  const lockoutDuration = options.lockoutDuration || 900000; // 15 min
  
  return {
    name: 'credentials',
    priority: 50, // After session and admin
    
    async onRequest(ctx: PluginContext) {
      // Expose credentials API on ctx.locals.kuratchi.auth.credentials
      ctx.locals.kuratchi = ctx.locals.kuratchi || {} as any;
      ctx.locals.kuratchi.auth = ctx.locals.kuratchi.auth || {} as any;
      
      ctx.locals.kuratchi.auth.credentials = {
        /**
         * Sign in with email/password
         * - If admin + organizations: authenticates against organization DB
         * - If admin only (no orgs): authenticates against admin DB
         * - Creates session and sets session cookie automatically
         */
        signIn: async (
          email: string,
          password: string,
          authOptions?: { organizationId?: string; ipAddress?: string; userAgent?: string }
        ): Promise<
          | { success: true; cookie: string; user: any }
          | { success: false; error: string; message?: string }
        > => {
          try {
            if (!email || !password) {
              return { success: false, error: 'email_and_password_required' };
            }
            
            // Check rate limiting (if KV available)
            const kv = ctx.locals.kuratchi?.kv?.default;
            if (kv) {
              const rateLimit = await checkRateLimit(kv, email, maxAttempts, lockoutDuration);
              if (!rateLimit.allowed) {
                return {
                  success: false,
                  error: 'too_many_attempts',
                  message: 'Account temporarily locked. Please try again later.'
                };
              }
            }
            
            let orgId: string | undefined = authOptions?.organizationId;
            let targetDb: any;
            
            // Determine target database: Organization DB or Admin DB
            const getAdminDb = ctx.locals.kuratchi?.getAdminDb;
            const getOrgDb = ctx.locals.kuratchi?.orgDatabaseClient;
            
            // If organizations are enabled, authenticate against org DB
            if (getOrgDb && getAdminDb) {
              if (!orgId) {
                const adminDb = await getAdminDb();
                // Find their organization (all users, including superadmins, must have an org)
                const foundOrgId = await findOrganizationIdByEmail(adminDb, email);
                orgId = foundOrgId || undefined;
              }
              
              // If no org found, fail
              if (!orgId) {
                if (kv) await recordFailedAttempt(kv, email, maxAttempts, lockoutDuration);
                if (options.onFailure) await options.onFailure(email);
                return { success: false, error: 'no_organization_found', message: 'User must belong to an organization' };
              }
              
              // Get organization database
              targetDb = await getOrgDb(orgId);
              if (!targetDb) {
                return { success: false, error: 'organization_database_not_found' };
              }
            } else if (getAdminDb) {
              // Single-tenant mode: authenticate against admin DB
              targetDb = await getAdminDb();
              if (!targetDb) {
                return { success: false, error: 'admin_database_not_found' };
              }
            } else {
              return { success: false, error: 'no_database_configured' };
            }
            
            let user;
            
            // Custom authenticate function
            if (options.authenticate) {
              user = await options.authenticate(email, password, ctx);
            } else {
              // Default: verify against stored password hash
              const { data: existingUser } = await targetDb.users
                .where({ email })
                .first();
              
              if (!existingUser || !existingUser.password_hash) {
                if (kv) await recordFailedAttempt(kv, email, maxAttempts, lockoutDuration);
                if (options.onFailure) await options.onFailure(email);
                return { success: false, error: 'invalid_credentials' };
              }
              
              // Verify password (with pepper from auth secret)
              const authSecret = ctx.env.KURATCHI_AUTH_SECRET;
              const isValid = await verifyPassword(password, existingUser.password_hash, authSecret);
              
              if (!isValid) {
                if (kv) await recordFailedAttempt(kv, email, maxAttempts, lockoutDuration);
                if (options.onFailure) await options.onFailure(email);
                return { success: false, error: 'invalid_credentials' };
              }
              
              user = existingUser;
            }
            
            if (!user) {
              if (kv) await recordFailedAttempt(kv, email, maxAttempts, lockoutDuration);
              if (options.onFailure) await options.onFailure(email);
              return { success: false, error: 'invalid_credentials' };
            }
            
            // Clear failed attempts on success
            if (kv) await clearAttempts(kv, email);
            
            // Create session with proper token and encryption
            const authSecret = ctx.env.KURATCHI_AUTH_SECRET;
            if (!authSecret) {
              return { success: false, error: 'auth_secret_not_configured' };
            }
            
            const now = new Date();
            const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
            
            // Generate session token and hash it
            const sessionToken = `${orgId}.${generateSessionToken()}`;
            const sessionTokenHash = await hashToken(sessionToken);
            
            // Store session in database with hashed token
            const insertResult = await targetDb.session.insert({
              sessionToken: sessionTokenHash,
              userId: user.id,
              expires: expires.getTime(), // Convert Date to timestamp (milliseconds)
              created_at: now.toISOString(),
              updated_at: now.toISOString(),
              deleted_at: null
            });
            
            if (!insertResult?.success) {
              return { success: false, error: 'failed_to_create_session', message: insertResult?.error };
            }
            
            // Build encrypted session cookie
            const sessionCookie = await buildSessionCookie(
              authSecret,
              orgId as any,
              sessionTokenHash
            );
            
            // Sanitize user (remove password_hash) for return payload
            const { password_hash, ...safeUser } = user;
            
            // Set session cookie using session plugin helper
            const setCookie = ctx.locals.kuratchi?.auth?.session?.setCookie;
            if (setCookie) {
              setCookie(sessionCookie, { expires });
            }
            
            // Callback after success
            if (options.onSuccess) {
              await options.onSuccess(user);
            }
            
            return {
              success: true,
              cookie: sessionCookie,
              user: safeUser
            };
          } catch (e: any) {
            console.error('[Credentials] Authentication failed:', e);
            return { success: false, error: 'authentication_failed', message: e?.message };
          }
        },
        
        /**
         * Sign out current user
         * - Invalidates session in database
         * - Clears session cookie
         */
        signOut: async (): Promise<{ success: boolean; error?: string }> => {
          try {
            const sessionCookie = ctx.event.cookies.get(options.cookieName || 'kuratchi_session');
            if (!sessionCookie) {
              return { success: true }; // Already signed out
            }
            
            const authSecret = ctx.env.KURATCHI_AUTH_SECRET;
            if (!authSecret) {
              return { success: false, error: 'auth_secret_not_configured' };
            }
            
            // Parse session cookie to get token hash
            const parsed = await parseSessionCookie(authSecret, sessionCookie);
            if (parsed) {
              const { tokenHash } = parsed;
              
              // Delete session from database
              const getAdminDb = ctx.locals.kuratchi?.getAdminDb;
              const getOrgDb = ctx.locals.kuratchi?.orgDatabaseClient;
              
              // Try org DB first, fall back to admin DB
              let targetDb: any;
              if (getOrgDb && parsed.orgId !== 'admin') {
                targetDb = await getOrgDb(parsed.orgId);
              } else if (getAdminDb) {
                targetDb = await getAdminDb();
              }
              
              if (targetDb) {
                await targetDb.session.delete({ sessionToken: tokenHash });
              }
            }
            
            // Clear session cookie using session plugin helper
            const clearCookie = ctx.locals.kuratchi?.auth?.session?.clearCookie;
            if (clearCookie) {
              clearCookie();
            }
            
            // Clear session from locals
            ctx.locals.session = null;
            
            return { success: true };
          } catch (e: any) {
            console.error('[Credentials] Sign out failed:', e);
            return { success: false, error: e?.message || 'signout_failed' };
          }
        },
        
        /**
         * @deprecated Use signIn instead
         */
        authenticate: async (
          email: string,
          password: string,
          authOptions?: { organizationId?: string; ipAddress?: string; userAgent?: string }
        ) => {
          console.warn('[Credentials] authenticate() is deprecated. Use signIn() instead.');
          // @ts-ignore
          return ctx.locals.kuratchi.auth.credentials.signIn(email, password, authOptions);
        }
      };
    }
  };
}
