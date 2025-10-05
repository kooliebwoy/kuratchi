/**
 * Email Auth Plugin - Magic link authentication
 * Handles magic link generation, sending, and verification
 */

import type { AuthPlugin, PluginContext } from '../core/plugin.js';
import type { RequestEvent } from '@sveltejs/kit';

export interface EmailAuthPluginOptions {
  /** Email provider: 'resend' or custom function */
  provider?: 'resend' | ((to: string, link: string, from: string) => Promise<void>);
  
  /** API key for email provider */
  apiKey?: string;
  
  /** From email address */
  from?: string;
  
  /** Magic link send route (default: '/auth/magic/send') */
  sendRoute?: string;
  
  /** Magic link callback route (default: '/auth/magic/callback') */
  callbackRoute?: string;
  
  /** Token expiry in milliseconds (default: 900000 = 15 min) */
  tokenExpiry?: number;
  
  /** Custom email template */
  emailTemplate?: (link: string, email: string) => { subject: string; html: string };
  
  /** Callback before sending email */
  onBeforeSend?: (email: string, organizationId: string) => Promise<void>;
  
  /** Callback after successful verification */
  onSuccess?: (email: string, user: any) => Promise<void>;
}

async function sendEmail(
  provider: 'resend' | ((to: string, link: string, from: string) => Promise<void>),
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
) {
  if (typeof provider === 'function') {
    const link = html.match(/href="([^"]+)"/)?.[1] || '';
    return provider(to, link, from);
  }
  
  if (provider === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }
  }
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
    console.warn('[EmailAuth] Failed to find organization for email:', error);
    return null;
  }
}

export function emailAuthPlugin(options: EmailAuthPluginOptions = {}): AuthPlugin {
  const tokenExpiry = options.tokenExpiry || 900000; // 15 min
  const provider = options.provider || 'resend';
  
  return {
    name: 'email-auth',
    priority: 50, // After session and admin
    
    async onRequest(ctx: PluginContext) {
      // Expose email auth API on ctx.locals.kuratchi.auth.email
      ctx.locals.kuratchi = ctx.locals.kuratchi || {} as any;
      ctx.locals.kuratchi.auth = ctx.locals.kuratchi.auth || {} as any;
      
      ctx.locals.kuratchi.auth.email = {
        /**
         * Send magic link email
         * @param email - User's email address
         * @param emailOptions - Optional redirect URL and organization ID
         */
        send: async (
          email: string,
          emailOptions?: { redirectTo?: string; organizationId?: string }
        ): Promise<{ success: true } | { success: false; error: string }> => {
          try {
            if (!email) {
              return { success: false, error: 'email_required' };
            }
            
            const apiKey = options.apiKey || ctx.env.RESEND_API_KEY;
            const from = options.from || ctx.env.EMAIL_FROM;
            
            if (!apiKey || !from) {
              return { success: false, error: 'email_not_configured' };
            }
            
            const redirectTo = emailOptions?.redirectTo || '/';
            let orgId = emailOptions?.organizationId;
            
            // Find organization if not provided
            if (!orgId) {
              const getAdminDb = ctx.locals.kuratchi?.getAdminDb;
              if (getAdminDb) {
                const adminDb = await getAdminDb();
                const foundOrgId = await findOrganizationIdByEmail(adminDb, email);
                orgId = foundOrgId || undefined;
              }
            }
            
            if (!orgId) {
              return { success: false, error: 'organization_not_found_for_email' };
            }
            
            // Callback before sending
            if (options.onBeforeSend) {
              await options.onBeforeSend(email, orgId);
            }
            
            // Get organization database
            const orgDb = await ctx.locals.kuratchi?.orgDatabaseClient?.(orgId);
            if (!orgDb) {
              return { success: false, error: 'organization_database_not_found' };
            }
            
            // Create magic link token
            const token = crypto.randomUUID();
            const expiresAt = Date.now() + tokenExpiry;
            
            await orgDb.magicLinkTokens.insert({
              token,
              email,
              redirect_to: redirectTo,
              expires_at: expiresAt,
              created_at: Date.now()
            });
            
            // Build magic link URL - user must provide callback route
            const url = new URL(ctx.event.request.url);
            const origin = ctx.env.ORIGIN || `${url.protocol}//${url.host}`;
            const link = `${origin}/auth/magic/callback?token=${encodeURIComponent(token)}&org=${encodeURIComponent(orgId)}`;
            
            // Send email
            const template = options.emailTemplate
              ? options.emailTemplate(link, email)
              : {
                  subject: 'Sign in to your account',
                  html: `
                    <h2>Sign in to your account</h2>
                    <p>Click the link below to sign in:</p>
                    <a href="${link}">Sign In</a>
                    <p>This link will expire in 15 minutes.</p>
                    <p>If you didn't request this, you can safely ignore this email.</p>
                  `
                };
            
            await sendEmail(provider, apiKey, from, email, template.subject, template.html);
            
            return { success: true };
          } catch (e: any) {
            console.error('[Email Auth] Send failed:', e);
            return { success: false, error: e?.message || 'send_failed' };
          }
        },
        
        /**
         * Verify magic link token and create session
         * @param token - Magic link token from URL
         * @param organizationId - Organization ID
         */
        verify: async (
          token: string,
          organizationId: string
        ): Promise<
          | { success: true; user: any; session: any; redirectTo: string }
          | { success: false; error: string }
        > => {
          try {
            if (!token || !organizationId) {
              return { success: false, error: 'token_and_org_required' };
            }
            
            // Get organization database
            const orgDb = await ctx.locals.kuratchi?.orgDatabaseClient?.(organizationId);
            if (!orgDb) {
              return { success: false, error: 'organization_database_not_found' };
            }
            
            // Verify token
            const { data: tokenRecord } = await orgDb.magicLinkTokens
              .where({ token })
              .first();
            
            if (!tokenRecord) {
              return { success: false, error: 'invalid_token' };
            }
            
            if (tokenRecord.expires_at < Date.now()) {
              return { success: false, error: 'token_expired' };
            }
            
            // Get or create user
            let user;
            const { data: existingUser } = await orgDb.users
              .where({ email: tokenRecord.email })
              .first();
            
            if (existingUser) {
              user = existingUser;
            } else {
              // Create new user
              const userId = crypto.randomUUID();
              await orgDb.users.insert({
                id: userId,
                email: tokenRecord.email,
                created_at: Date.now(),
                updated_at: Date.now(),
                deleted_at: null
              });
              
              user = {
                id: userId,
                email: tokenRecord.email
              };
            }
            
            // Create session
            const sessionId = crypto.randomUUID();
            const sessionData = {
              userId: user.id,
              email: user.email,
              organizationId: organizationId,
              createdAt: Date.now()
            };
            
            await orgDb.sessions.insert({
              id: sessionId,
              user_id: user.id,
              organization_id: organizationId,
              created_at: Date.now(),
              expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
            });
            
            // Delete used token
            await orgDb.magicLinkTokens.delete({ token });
            
            // Callback after success
            if (options.onSuccess) {
              await options.onSuccess(user.email, user);
            }
            
            // Sanitize user (remove sensitive fields)
            const { password_hash, ...safeUser } = user;
            
            return {
              success: true,
              user: safeUser,
              session: sessionData,
              redirectTo: tokenRecord.redirect_to || '/'
            };
          } catch (e: any) {
            console.error('[Email Auth] Verification failed:', e);
            return { success: false, error: e?.message || 'verification_failed' };
          }
        }
      };
    }
  };
}
