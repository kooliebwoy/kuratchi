/**
 * Credentials Plugin - Email/password authentication
 * Handles username/password login with rate limiting
 */

import type { AuthPlugin, PluginContext } from '../core/plugin.js';

export interface CredentialsPluginOptions {
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
    
    return orgUsers?.organization_id || null;
  } catch (error) {
    console.warn('[Credentials] Failed to find organization for email:', error);
    return null;
  }
}

async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  // Use Web Crypto API for password verification
  // This assumes passwords are hashed with PBKDF2
  // In production, you'd want to support bcrypt, argon2, etc.
  
  try {
    // Parse stored hash format: algorithm:iterations:salt:hash
    const parts = storedHash.split(':');
    if (parts.length !== 4) return false;
    
    const [algorithm, iterationsStr, saltHex, hashHex] = parts;
    if (algorithm !== 'pbkdf2') return false;
    
    const iterations = parseInt(iterationsStr, 10);
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const expectedHash = new Uint8Array(hashHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    // Hash the provided password with the same salt
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256 // 32 bytes
    );
    
    const derivedHash = new Uint8Array(derivedBits);
    
    // Constant-time comparison
    if (derivedHash.length !== expectedHash.length) return false;
    
    let result = 0;
    for (let i = 0; i < derivedHash.length; i++) {
      result |= derivedHash[i] ^ expectedHash[i];
    }
    
    return result === 0;
  } catch (error) {
    console.error('[Credentials] Password verification failed:', error);
    return false;
  }
}

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
  const loginRoute = options.loginRoute || '/auth/credentials/login';
  const logoutRoute = options.logoutRoute || '/auth/credentials/logout';
  const maxAttempts = options.maxAttempts || 5;
  const lockoutDuration = options.lockoutDuration || 900000; // 15 min
  
  return {
    name: 'credentials',
    priority: 50, // After session and admin
    
    async onRequest(ctx: PluginContext) {
      const url = new URL(ctx.event.request.url);
      const pathname = url.pathname;
      
      // POST /auth/credentials/login
      if (pathname === loginRoute && ctx.event.request.method === 'POST') {
        try {
          const body = await ctx.event.request.json().catch(() => ({}));
          const email = (body?.email || '').trim();
          const password = body?.password || '';
          let orgId = body?.organizationId || url.searchParams.get('org');
          
          if (!email || !password) {
            return new Response(
              JSON.stringify({ success: false, error: 'email_and_password_required' }),
              { status: 400, headers: { 'content-type': 'application/json' } }
            );
          }
          
          // Check rate limiting (if KV available)
          const kv = ctx.locals.kuratchi?.kv?.default;
          if (kv) {
            const rateLimit = await checkRateLimit(kv, email, maxAttempts, lockoutDuration);
            if (!rateLimit.allowed) {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: 'too_many_attempts',
                  message: 'Account temporarily locked. Please try again later.'
                }),
                { status: 429, headers: { 'content-type': 'application/json' } }
              );
            }
          }
          
          // Find organization if not provided
          if (!orgId) {
            const getAdminDb = ctx.locals.kuratchi?.getAdminDb;
            if (getAdminDb) {
              const adminDb = await getAdminDb();
              orgId = await findOrganizationIdByEmail(adminDb, email);
            }
          }
          
          if (!orgId) {
            // Record failed attempt
            if (kv) await recordFailedAttempt(kv, email, maxAttempts, lockoutDuration);
            if (options.onFailure) await options.onFailure(email);
            
            return new Response(
              JSON.stringify({ success: false, error: 'invalid_credentials' }),
              { status: 401, headers: { 'content-type': 'application/json' } }
            );
          }
          
          // Get organization database
          const orgDb = await ctx.locals.kuratchi?.orgDatabaseClient?.(orgId);
          if (!orgDb) {
            return new Response(
              JSON.stringify({ success: false, error: 'organization_database_not_found' }),
              { status: 404, headers: { 'content-type': 'application/json' } }
            );
          }
          
          let user;
          
          // Custom authenticate function
          if (options.authenticate) {
            user = await options.authenticate(email, password, ctx);
          } else {
            // Default: verify against stored password hash
            const { data: existingUser } = await orgDb.users
              .where({ email })
              .first();
            
            if (!existingUser || !existingUser.password_hash) {
              // Record failed attempt
              if (kv) await recordFailedAttempt(kv, email, maxAttempts, lockoutDuration);
              if (options.onFailure) await options.onFailure(email);
              
              return new Response(
                JSON.stringify({ success: false, error: 'invalid_credentials' }),
                { status: 401, headers: { 'content-type': 'application/json' } }
              );
            }
            
            // Verify password
            const isValid = await verifyPassword(existingUser.password_hash, password);
            if (!isValid) {
              // Record failed attempt
              if (kv) await recordFailedAttempt(kv, email, maxAttempts, lockoutDuration);
              if (options.onFailure) await options.onFailure(email);
              
              return new Response(
                JSON.stringify({ success: false, error: 'invalid_credentials' }),
                { status: 401, headers: { 'content-type': 'application/json' } }
              );
            }
            
            user = existingUser;
          }
          
          if (!user) {
            // Record failed attempt
            if (kv) await recordFailedAttempt(kv, email, maxAttempts, lockoutDuration);
            if (options.onFailure) await options.onFailure(email);
            
            return new Response(
              JSON.stringify({ success: false, error: 'invalid_credentials' }),
              { status: 401, headers: { 'content-type': 'application/json' } }
            );
          }
          
          // Clear failed attempts on success
          if (kv) await clearAttempts(kv, email);
          
          // Create session
          const sessionId = crypto.randomUUID();
          const sessionData = {
            userId: user.id,
            email: user.email,
            organizationId: orgId,
            createdAt: Date.now()
          };
          
          await orgDb.sessions.insert({
            id: sessionId,
            user_id: user.id,
            organization_id: orgId,
            created_at: Date.now(),
            expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
          });
          
          // Set session cookie
          const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const sessionCookie = JSON.stringify(sessionData);
          ctx.locals.kuratchi?.setSessionCookie?.(sessionCookie, { expires });
          
          // Callback after success
          if (options.onSuccess) {
            await options.onSuccess(user);
          }
          
          return new Response(
            JSON.stringify({
              success: true,
              user: {
                id: user.id,
                email: user.email,
                name: user.name
              }
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        } catch (e: any) {
          console.error('[Credentials] Login failed:', e);
          return new Response(
            JSON.stringify({ success: false, error: 'login_failed', detail: e?.message || String(e) }),
            { status: 500, headers: { 'content-type': 'application/json' } }
          );
        }
      }
      
      // POST /auth/credentials/logout
      if (pathname === logoutRoute && ctx.event.request.method === 'POST') {
        try {
          // Clear session cookie
          ctx.locals.kuratchi?.clearSessionCookie?.();
          
          return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        } catch (e: any) {
          console.error('[Credentials] Logout failed:', e);
          return new Response(
            JSON.stringify({ success: false, error: 'logout_failed' }),
            { status: 500, headers: { 'content-type': 'application/json' } }
          );
        }
      }
    }
  };
}
