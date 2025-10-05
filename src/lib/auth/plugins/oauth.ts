/**
 * OAuth Plugin - Social authentication (Google, GitHub, etc.)
 * Handles OAuth flows with multiple providers
 */

import type { AuthPlugin, PluginContext } from '../core/plugin.js';
import { signState, verifyState } from '../../utils/auth.js';

export interface OAuthProviderConfig {
  name: 'google' | 'github' | 'microsoft' | string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  authorizeUrl?: string;
  tokenUrl?: string;
  profileUrl?: string;
}

export interface OAuthPluginOptions {
  /** OAuth providers configuration */
  providers: OAuthProviderConfig[];
  
  /** Start route pattern (default: '/auth/oauth/:provider/start') */
  startRoute?: string;
  
  /** Callback route pattern (default: '/auth/oauth/:provider/callback') */
  callbackRoute?: string;
  
  /** State TTL in milliseconds (default: 600000 = 10 min) */
  stateTtl?: number;
  
  /** Callback to handle user profile */
  onProfile?: (provider: string, profile: any, ctx: PluginContext) => Promise<any>;
  
  /** Callback after successful authentication */
  onSuccess?: (user: any, provider: string) => Promise<void>;
}

const PROVIDER_CONFIGS: Record<string, { authorizeUrl: string; tokenUrl: string; profileUrl: string; scopes: string[] }> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile']
  },
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    profileUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email']
  },
  microsoft: {
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    profileUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: ['openid', 'profile', 'email']
  }
};

async function findOrganizationIdByEmail(adminDb: any, email: string): Promise<string | null> {
  if (!adminDb) return null;
  
  try {
    const { data: orgUsers } = await adminDb.organizationUsers
      .where({ email })
      .first();
    
    // Use camelCase to match admin plugin schema
    return orgUsers?.organizationId || null;
  } catch (error) {
    console.warn('[OAuth] Failed to find organization for email:', error);
    return null;
  }
}

export function oauthPlugin(options: OAuthPluginOptions): AuthPlugin {
  const startRouteBase = options.startRoute || '/auth/oauth';
  const callbackRouteBase = options.callbackRoute || '/auth/oauth';
  const stateTtl = options.stateTtl || 600000; // 10 min
  
  return {
    name: 'oauth',
    priority: 50, // After session and admin
    
    async onRequest(ctx: PluginContext) {
      const url = new URL(ctx.event.request.url);
      const pathname = url.pathname;
      
      // Handle OAuth start for any provider
      for (const providerConfig of options.providers) {
        const startPath = `${startRouteBase}/${providerConfig.name}/start`;
        const callbackPath = `${callbackRouteBase}/${providerConfig.name}/callback`;
        
        // GET /auth/oauth/:provider/start
        if (pathname === startPath && ctx.event.request.method === 'GET') {
          try {
            const overrideOrgId = url.searchParams.get('org') || '';
            const redirectTo = url.searchParams.get('redirectTo') || '/';
            
            if (!ctx.env.KURATCHI_AUTH_SECRET) {
              return new Response('OAuth not configured (missing auth secret)', { status: 500 });
            }
            
            // Build state
            const payload: Record<string, any> = {
              provider: providerConfig.name,
              redirectTo,
              ts: Date.now(),
              n: crypto.randomUUID()
            };
            if (overrideOrgId) payload.orgId = overrideOrgId;
            
            const state = await signState(ctx.env.KURATCHI_AUTH_SECRET, payload);
            
            // Get provider URLs
            const defaults = PROVIDER_CONFIGS[providerConfig.name] || {};
            const authorizeUrl = providerConfig.authorizeUrl || defaults.authorizeUrl;
            const scopes = providerConfig.scopes || defaults.scopes;
            
            if (!authorizeUrl) {
              return new Response(`Unknown OAuth provider: ${providerConfig.name}`, { status: 500 });
            }
            
            // Build redirect URI
            const origin = ctx.env.ORIGIN || `${url.protocol}//${url.host}`;
            const redirect_uri = `${origin}${callbackPath}`;
            
            // Build authorization URL
            const authUrl = new URL(authorizeUrl);
            authUrl.searchParams.set('client_id', providerConfig.clientId);
            authUrl.searchParams.set('redirect_uri', redirect_uri);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('scope', scopes.join(' '));
            authUrl.searchParams.set('state', state);
            
            // Provider-specific params
            if (providerConfig.name === 'google') {
              authUrl.searchParams.set('access_type', 'offline');
              authUrl.searchParams.set('prompt', 'consent');
              authUrl.searchParams.set('include_granted_scopes', 'true');
            }
            
            return new Response(null, { status: 302, headers: { Location: authUrl.toString() } });
          } catch (e: any) {
            console.error(`[OAuth ${providerConfig.name}] Start failed:`, e);
            return new Response(`OAuth start failed: ${e?.message}`, { status: 500 });
          }
        }
        
        // GET /auth/oauth/:provider/callback
        if (pathname === callbackPath && ctx.event.request.method === 'GET') {
          try {
            const code = url.searchParams.get('code') || '';
            const state = url.searchParams.get('state') || '';
            
            if (!ctx.env.KURATCHI_AUTH_SECRET) {
              return new Response('OAuth not configured (missing auth secret)', { status: 500 });
            }
            
            // Verify state
            const payload = await verifyState(ctx.env.KURATCHI_AUTH_SECRET, state);
            if (!code || !payload) {
              return new Response('Bad Request (invalid state or code)', { status: 400 });
            }
            
            const redirectTo = (payload as any)?.redirectTo || '/';
            const ts = (payload as any)?.ts;
            const stateOrgId: string | undefined = (payload as any)?.orgId;
            
            // Check state TTL
            if (typeof ts === 'number' && Date.now() - ts > stateTtl) {
              return new Response('State expired', { status: 400 });
            }
            
            // Exchange code for tokens
            const origin = ctx.env.ORIGIN || `${url.protocol}//${url.host}`;
            const redirect_uri = `${origin}${callbackPath}`;
            
            const defaults = PROVIDER_CONFIGS[providerConfig.name] || {};
            const tokenUrl = providerConfig.tokenUrl || defaults.tokenUrl;
            
            if (!tokenUrl) {
              return new Response(`Unknown OAuth provider: ${providerConfig.name}`, { status: 500 });
            }
            
            const tokenRes = await fetch(tokenUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
              },
              body: new URLSearchParams({
                code,
                client_id: providerConfig.clientId,
                client_secret: providerConfig.clientSecret,
                redirect_uri,
                grant_type: 'authorization_code'
              })
            });
            
            if (!tokenRes.ok) {
              const errText = await tokenRes.text();
              return new Response(`Token exchange failed: ${errText}`, { status: 401 });
            }
            
            const tokenJson = await tokenRes.json();
            const access_token = tokenJson.access_token;
            const refresh_token = tokenJson.refresh_token;
            const id_token = tokenJson.id_token;
            
            if (!access_token) {
              return new Response('No access token received', { status: 401 });
            }
            
            // Fetch user profile
            const profileUrl = providerConfig.profileUrl || defaults.profileUrl;
            if (!profileUrl) {
              return new Response('Profile URL not configured', { status: 500 });
            }
            
            const profileRes = await fetch(profileUrl, {
              headers: {
                'Authorization': `Bearer ${access_token}`,
                'Accept': 'application/json'
              }
            });
            
            if (!profileRes.ok) {
              const errText = await profileRes.text();
              return new Response(`Failed to fetch profile: ${errText}`, { status: 401 });
            }
            
            const profile = await profileRes.json();
            
            // Extract common fields (provider-specific)
            let providerAccountId: string;
            let email: string | undefined;
            let name: string | null = null;
            let image: string | null = null;
            
            if (providerConfig.name === 'google') {
              providerAccountId = String(profile.sub);
              email = profile.email;
              name = profile.name || null;
              image = profile.picture || null;
            } else if (providerConfig.name === 'github') {
              providerAccountId = String(profile.id);
              email = profile.email;
              name = profile.name || profile.login || null;
              image = profile.avatar_url || null;
            } else if (providerConfig.name === 'microsoft') {
              providerAccountId = String(profile.id);
              email = profile.mail || profile.userPrincipalName;
              name = profile.displayName || null;
              image = null;
            } else {
              // Custom provider
              providerAccountId = String(profile.id || profile.sub);
              email = profile.email;
              name = profile.name || null;
              image = profile.picture || profile.avatar_url || null;
            }
            
            // Resolve organization
            let orgId = stateOrgId || '';
            if (!orgId && email) {
              const getAdminDb = ctx.locals.kuratchi?.getAdminDb;
              if (getAdminDb) {
                const adminDb = await getAdminDb();
                orgId = (await findOrganizationIdByEmail(adminDb, email)) || '';
              }
            }
            
            if (!orgId) {
              return new Response('organization_not_found_for_email', { status: 404 });
            }
            
            // Get organization database
            const orgDb = await ctx.locals.kuratchi?.orgDatabaseClient?.(orgId);
            if (!orgDb) {
              return new Response('Organization database not found', { status: 404 });
            }
            
            // Custom profile handler
            let user;
            if (options.onProfile) {
              user = await options.onProfile(providerConfig.name, profile, ctx);
            } else {
              // Default: get or create user
              const { data: existingAccount } = await orgDb.oauthAccounts
                .where({ provider: providerConfig.name, provider_account_id: providerAccountId })
                .first();
              
              if (existingAccount) {
                // Get existing user
                const { data: existingUser } = await orgDb.users
                  .where({ id: existingAccount.user_id })
                  .first();
                user = existingUser;
              } else {
                // Check if user exists by email
                let existingUser;
                if (email) {
                  const result = await orgDb.users.where({ email }).first();
                  existingUser = result.data;
                }
                
                if (existingUser) {
                  user = existingUser;
                } else {
                  // Create new user
                  const { data: newUser } = await orgDb.users.insert({
                    email: email || null,
                    name: name || null,
                    image: image || null,
                    created_at: Date.now()
                  });
                  user = newUser;
                }
                
                // Link OAuth account
                await orgDb.oauthAccounts.insert({
                  user_id: user.id,
                  provider: providerConfig.name,
                  provider_account_id: providerAccountId,
                  access_token,
                  refresh_token: refresh_token || null,
                  id_token: id_token || null,
                  created_at: Date.now()
                });
              }
            }
            
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
              await options.onSuccess(user, providerConfig.name);
            }
            
            // Redirect
            return new Response(null, { status: 303, headers: { Location: redirectTo || '/' } });
          } catch (e: any) {
            console.error(`[OAuth ${providerConfig.name}] Callback failed:`, e);
            return new Response(`OAuth callback error: ${e?.message || String(e)}`, { status: 500 });
          }
        }
      }
    }
  };
}
