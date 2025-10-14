/**
 * Email Auth Plugin - Magic link authentication
 * Handles magic link generation, sending, and verification
 * Uses the email service for sending and tracking
 */

import type { AuthPlugin, PluginContext } from '../core/plugin.js';
import { sendEmail as sendEmailService } from '../../email/index.js';

export interface EmailAuthPluginOptions {
  /** Token expiry in milliseconds (default: 900000 = 15 min) */
  tokenExpiry?: number;
  
  /** Custom email template */
  emailTemplate?: (link: string, email: string) => { subject: string; html: string };
  
  /** Callback before sending email */
  onBeforeSend?: (email: string, organizationId: string) => Promise<void>;
  
  /** Callback after successful verification */
  onSuccess?: (email: string, user: any) => Promise<void>;
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
            
            // Build magic link URL
            const url = new URL(ctx.event.request.url);
            const origin = ctx.env.ORIGIN || `${url.protocol}//${url.host}`;
            const link = `${origin}/auth/magic/callback?token=${encodeURIComponent(token)}&org=${encodeURIComponent(orgId)}`;
            
            // Generate email template
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
            
            // Send email using email service (auto-tracked)
            const result = await sendEmailService(ctx.event, {
              to: email,
              subject: template.subject,
              html: template.html,
              emailType: 'magic_link',
              organizationId: orgId,
              metadata: {
                tokenId: token,
                expiresAt: new Date(expiresAt).toISOString(),
                redirectTo
              }
            });
            
            if (!result.success) {
              return { success: false, error: result.error || 'send_failed' };
            }
            
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
