/**
 * Email Verification Plugin - Verify user email addresses
 * Handles sending verification emails, verifying tokens, and resending
 * Uses the email service for sending via AWS SES
 * 
 * Routes handled:
 * - GET  /auth/verify-email/callback  - Verify token from email link
 * - POST /auth/verify-email/resend    - Resend verification email
 * - POST /auth/verify-email/ses-request - Request SES identity verification (sandbox mode)
 * - POST /auth/verify-email/ses-check   - Check SES verification status
 */

import type { AuthPlugin, PluginContext } from '../core/plugin.js';
import { 
  sendEmail as sendEmailService,
  requestSesVerification,
  getSesIdentityStatus
} from '../../email/index.js';
import { redirect } from '@sveltejs/kit';

export interface EmailVerificationPluginOptions {
  /** Token expiry in milliseconds (default: 86400000 = 24 hours) */
  tokenExpiry?: number;
  
  /** Custom email template */
  emailTemplate?: (link: string, email: string) => { subject: string; html: string };
  
  /** Callback before sending email */
  onBeforeSend?: (email: string, userId: string) => Promise<void>;
  
  /** Callback after successful verification */
  onVerified?: (email: string, userId: string) => Promise<void>;
  
  /** Resend cooldown in milliseconds (default: 60000 = 1 minute) */
  resendCooldown?: number;
  
  /** Callback route path (default: '/auth/verify-email/callback') */
  callbackRoute?: string;
  
  /** Resend route path (default: '/auth/verify-email/resend') */
  resendRoute?: string;
  
  /** Redirect URL after successful verification (default: '/?verified=true') */
  successRedirect?: string;
  
  /** Redirect URL on error (default: '/auth/verify-email?error=') */
  errorRedirect?: string;
  
  /** Use SES identity verification instead of app-sent emails (for sandbox mode) */
  useSesVerification?: boolean;
}

export interface EmailVerificationExtension {
  /**
   * Send verification email to user
   * @param userId - User ID to send verification to
   * @param email - Email address to verify
   * @param redirectTo - Optional redirect URL after verification
   */
  send: (
    userId: string,
    email: string,
    redirectTo?: string
  ) => Promise<{ success: true } | { success: false; error: string }>;
  
  /**
   * Verify email with token
   * @param token - Verification token from email link
   * @param organizationId - Organization ID
   */
  verify: (
    token: string,
    organizationId: string
  ) => Promise<{ success: true; userId: string } | { success: false; error: string }>;
  
  /**
   * Resend verification email
   * @param userId - User ID to resend verification to
   */
  resend: (
    userId: string
  ) => Promise<{ success: true } | { success: false; error: string }>;
  
  /**
   * Check if user's email is verified
   * @param userId - User ID to check
   */
  isVerified: (userId: string) => Promise<boolean>;
}

export function emailVerificationPlugin(options: EmailVerificationPluginOptions = {}): AuthPlugin {
  const tokenExpiry = options.tokenExpiry || 24 * 60 * 60 * 1000; // 24 hours
  const resendCooldown = options.resendCooldown || 60 * 1000; // 1 minute
  const callbackRoute = options.callbackRoute || '/auth/verify-email/callback';
  const resendRoute = options.resendRoute || '/auth/verify-email/resend';
  const successRedirect = options.successRedirect || '/?verified=true';
  const errorRedirect = options.errorRedirect || '/auth/verify-email?error=';
  
  return {
    name: 'email-verification',
    priority: 55, // After session and admin
    
    async onRequest(ctx: PluginContext) {
      const url = new URL(ctx.event.request.url);
      const pathname = url.pathname;
      
      // Expose email verification API on ctx.locals.kuratchi.auth.emailVerification
      ctx.locals.kuratchi = ctx.locals.kuratchi || {} as any;
      ctx.locals.kuratchi.auth = ctx.locals.kuratchi.auth || {} as any;
      
      const getOrganizationId = () => {
        return (ctx.locals.session as any)?.organizationId;
      };
      
      const getOrgDb = async () => {
        const orgId = getOrganizationId();
        if (!orgId) return null;
        return ctx.locals.kuratchi?.orgDatabaseClient?.(orgId);
      };
      
      // Internal verify function (used by both route handler and API)
      const verifyToken = async (
        token: string,
        organizationId: string
      ): Promise<{ success: true; userId: string; redirectTo?: string } | { success: false; error: string }> => {
        try {
          if (!token || !organizationId) {
            return { success: false, error: 'token_and_org_required' };
          }
          
          // Get organization database
          const orgDb = await ctx.locals.kuratchi?.orgDatabaseClient?.(organizationId);
          if (!orgDb) {
            return { success: false, error: 'organization_database_not_found' };
          }
          
          // Find token
          let tokenRecord;
          if (orgDb.emailVerificationTokens) {
            const { data } = await orgDb.emailVerificationTokens
              .where({ token })
              .first();
            tokenRecord = data;
          } else {
            // Fallback: check magicLinkTokens with token_type
            const { data } = await orgDb.magicLinkTokens
              ?.where({ token, token_type: 'email_verification' })
              .first();
            tokenRecord = data;
          }
          
          if (!tokenRecord) {
            return { success: false, error: 'invalid_token' };
          }
          
          if (tokenRecord.expires_at < Date.now()) {
            return { success: false, error: 'token_expired' };
          }
          
          const userId = tokenRecord.userId || tokenRecord.user_id;
          const redirectTo = tokenRecord.redirect_to;
          
          // Update user's emailVerified field
          await orgDb.users.where({ id: userId }).update({ 
            emailVerified: Date.now(),
            updated_at: Date.now()
          });
          
          // Delete used token
          if (orgDb.emailVerificationTokens) {
            await orgDb.emailVerificationTokens.delete({ token });
          } else {
            await orgDb.magicLinkTokens?.delete({ token });
          }
          
          // Log activity - email verified via token
          if (ctx.locals.kuratchi?.activity?.log) {
            try {
              await ctx.locals.kuratchi.activity.log({
                action: 'user.email_verified',
                userId,
                data: { email: tokenRecord.email, method: 'token' }
              });
            } catch (e) {
              console.warn('[Email Verification] Failed to log activity:', e);
            }
          }
          
          // Callback after verification
          if (options.onVerified) {
            await options.onVerified(tokenRecord.email, userId);
          }
          
          return { success: true, userId, redirectTo };
        } catch (e: any) {
          console.error('[Email Verification] Verify failed:', e);
          return { success: false, error: e?.message || 'verification_failed' };
        }
      };
      
      // ============================================
      // Route: GET /auth/verify-email/callback
      // Handles verification link clicks from email
      // ============================================
      if (pathname === callbackRoute && ctx.event.request.method === 'GET') {
        const token = url.searchParams.get('token');
        const org = url.searchParams.get('org');
        
        if (!token || !org) {
          throw redirect(303, `${errorRedirect}invalid_link`);
        }
        
        try {
          const result = await verifyToken(token, org);
          
          if (!result.success) {
            console.error('[Email Verification] Verification failed:', result.error);
            throw redirect(303, `${errorRedirect}${result.error}`);
          }
          
          // Success - redirect to success URL or custom redirect from token
          const finalRedirect = result.redirectTo && result.redirectTo !== '/' 
            ? `${result.redirectTo}${result.redirectTo.includes('?') ? '&' : '?'}verified=true`
            : successRedirect;
          throw redirect(303, finalRedirect);
        } catch (e: any) {
          // Re-throw redirects
          if (e?.status && e?.location) {
            throw e;
          }
          
          console.error('[Email Verification] Error:', e);
          throw redirect(303, `${errorRedirect}verification_failed`);
        }
      }
      
      // ============================================
      // Route: POST /auth/verify-email/resend
      // Resends verification email to current user
      // ============================================
      if (pathname === resendRoute && ctx.event.request.method === 'POST') {
        const session = ctx.locals.session as any;
        
        if (!session?.user?.id) {
          return new Response(
            JSON.stringify({ success: false, error: 'not_authenticated' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        try {
          const orgDb = await getOrgDb();
          if (!orgDb) {
            return new Response(
              JSON.stringify({ success: false, error: 'organization_database_not_found' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          // Get user
          const { data: user } = await orgDb.users.where({ id: session.user.id }).first();
          if (!user) {
            return new Response(
              JSON.stringify({ success: false, error: 'user_not_found' }),
              { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          if (user.emailVerified) {
            return new Response(
              JSON.stringify({ success: false, error: 'email_already_verified' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          if (!user.email) {
            return new Response(
              JSON.stringify({ success: false, error: 'user_has_no_email' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          // Check for recent verification token (cooldown)
          if (orgDb.emailVerificationTokens) {
            const { data: recentToken } = await orgDb.emailVerificationTokens
              .where({ userId: session.user.id })
              .orderBy({ created_at: 'desc' })
              .first();
            
            if (recentToken && (Date.now() - recentToken.created_at) < resendCooldown) {
              const waitTime = Math.ceil((resendCooldown - (Date.now() - recentToken.created_at)) / 1000);
              return new Response(
                JSON.stringify({ success: false, error: `please_wait_${waitTime}_seconds` }),
                { status: 429, headers: { 'Content-Type': 'application/json' } }
              );
            }
          }
          
          // Callback before sending
          if (options.onBeforeSend) {
            await options.onBeforeSend(user.email, session.user.id);
          }
          
          // Create verification token
          const token = crypto.randomUUID();
          const expiresAt = Date.now() + tokenExpiry;
          const orgId = getOrganizationId();
          
          // Store token
          if (orgDb.emailVerificationTokens) {
            await orgDb.emailVerificationTokens.insert({
              id: crypto.randomUUID(),
              token,
              userId: session.user.id,
              email: user.email,
              redirect_to: '/',
              expires_at: expiresAt,
              created_at: Date.now(),
              updated_at: Date.now(),
              deleted_at: null
            });
          } else {
            await orgDb.magicLinkTokens?.insert({
              token,
              email: user.email,
              redirect_to: '/',
              expires_at: expiresAt,
              created_at: Date.now(),
              token_type: 'email_verification',
              user_id: session.user.id
            });
          }
          
          // Build verification link URL
          const origin = ctx.env.ORIGIN || `${url.protocol}//${url.host}`;
          const link = `${origin}${callbackRoute}?token=${encodeURIComponent(token)}&org=${encodeURIComponent(orgId)}`;
          
          // Generate email template
          const template = options.emailTemplate
            ? options.emailTemplate(link, user.email)
            : {
                subject: 'Verify your email address',
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                    <h2 style="color: #0f172a; margin-bottom: 24px;">Verify your email address</h2>
                    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                      Please click the button below to verify your email address and complete your account setup.
                    </p>
                    <a href="${link}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                      Verify Email
                    </a>
                    <p style="color: #94a3b8; font-size: 14px; margin-top: 32px;">
                      This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
                    </p>
                  </div>
                `
              };
          
          // Send email
          const result = await sendEmailService(ctx.event, {
            to: user.email,
            subject: template.subject,
            html: template.html,
            emailType: 'email_verification',
            organizationId: orgId,
            userId: session.user.id,
            metadata: {
              tokenId: token,
              expiresAt: new Date(expiresAt).toISOString()
            }
          });
          
          if (!result.success) {
            return new Response(
              JSON.stringify({ success: false, error: result.error || 'send_failed' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          // Log activity - verification email sent
          if (ctx.locals.kuratchi?.activity?.log) {
            try {
              await ctx.locals.kuratchi.activity.log({
                action: 'user.email_verification_sent',
                userId: session.user.id,
                data: { email: user.email, method: 'email' }
              });
            } catch (e) {
              console.warn('[Email Verification] Failed to log activity:', e);
            }
          }
          
          return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        } catch (e: any) {
          console.error('[Email Verification] Resend failed:', e);
          return new Response(
            JSON.stringify({ success: false, error: e?.message || 'resend_failed' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // ============================================
      // Route: POST /auth/verify-email/ses-request
      // Request SES identity verification (sandbox mode)
      // ============================================
      if (pathname === '/auth/verify-email/ses-request' && ctx.event.request.method === 'POST') {
        const session = ctx.locals.session as any;
        
        if (!session?.user?.id) {
          return new Response(
            JSON.stringify({ success: false, error: 'not_authenticated' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        try {
          const orgDb = await getOrgDb();
          if (!orgDb) {
            return new Response(
              JSON.stringify({ success: false, error: 'organization_database_not_found' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          // Get user
          const { data: user } = await orgDb.users.where({ id: session.user.id }).first();
          if (!user?.email) {
            return new Response(
              JSON.stringify({ success: false, error: 'user_has_no_email' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          if (user.emailVerified) {
            return new Response(
              JSON.stringify({ success: true, alreadyVerified: true }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          // Request SES verification
          const result = await requestSesVerification(user.email);
          
          if (result.alreadyVerified) {
            // Update user's emailVerified field
            await orgDb.users.where({ id: session.user.id }).update({ 
              emailVerified: Date.now(),
              updated_at: new Date().toISOString()
            });
            
            // Log activity - already verified
            if (ctx.locals.kuratchi?.activity?.log) {
              try {
                await ctx.locals.kuratchi.activity.log({
                  action: 'user.email_verified',
                  userId: session.user.id,
                  data: { email: user.email, method: 'ses', alreadyVerified: true }
                });
              } catch (e) {
                console.warn('[Email Verification] Failed to log activity:', e);
              }
            }
            
            return new Response(
              JSON.stringify({ success: true, alreadyVerified: true }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          // Log activity - verification request sent
          if (result.success && ctx.locals.kuratchi?.activity?.log) {
            try {
              await ctx.locals.kuratchi.activity.log({
                action: 'user.email_verification_sent',
                userId: session.user.id,
                data: { email: user.email, method: 'ses' }
              });
            } catch (e) {
              console.warn('[Email Verification] Failed to log activity:', e);
            }
          }
          
          return new Response(
            JSON.stringify({ success: result.success, error: result.error }),
            { status: result.success ? 200 : 500, headers: { 'Content-Type': 'application/json' } }
          );
        } catch (e: any) {
          console.error('[Email Verification] SES request failed:', e);
          return new Response(
            JSON.stringify({ success: false, error: e?.message || 'ses_request_failed' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // ============================================
      // Route: POST /auth/verify-email/ses-check
      // Check SES verification status and update DB
      // ============================================
      if (pathname === '/auth/verify-email/ses-check' && ctx.event.request.method === 'POST') {
        console.log('[Email Verification] SES check route hit');
        const session = ctx.locals.session as any;
        
        if (!session?.user?.id) {
          return new Response(
            JSON.stringify({ success: false, error: 'not_authenticated' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        try {
          const orgDb = await getOrgDb();
          if (!orgDb) {
            return new Response(
              JSON.stringify({ success: false, error: 'organization_database_not_found' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          // Get user
          const { data: user } = await orgDb.users.where({ id: session.user.id }).first();
          if (!user?.email) {
            return new Response(
              JSON.stringify({ success: false, error: 'user_has_no_email' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          if (user.emailVerified) {
            return new Response(
              JSON.stringify({ verified: true }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          // Check SES verification status
          console.log('[Email Verification] Checking SES status for:', user.email);
          const status = await getSesIdentityStatus(user.email);
          console.log('[Email Verification] SES status result:', status);
          
          if (status.verified) {
            // Update user's emailVerified field
            await orgDb.users.where({ id: session.user.id }).update({ 
              emailVerified: Date.now(),
              updated_at: new Date().toISOString()
            });
            
            // Log activity - email verified
            if (ctx.locals.kuratchi?.activity?.log) {
              try {
                await ctx.locals.kuratchi.activity.log({
                  action: 'user.email_verified',
                  userId: session.user.id,
                  data: { email: user.email, method: 'ses' }
                });
              } catch (e) {
                console.warn('[Email Verification] Failed to log activity:', e);
              }
            }
            
            // Callback after verification
            if (options.onVerified) {
              await options.onVerified(user.email, session.user.id);
            }
            
            return new Response(
              JSON.stringify({ verified: true }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          
          return new Response(
            JSON.stringify({ verified: false, status: status.verificationStatus }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        } catch (e: any) {
          console.error('[Email Verification] SES check failed:', e);
          return new Response(
            JSON.stringify({ success: false, error: e?.message || 'ses_check_failed' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // ============================================
      // Expose email verification API on locals
      // ============================================
      ctx.locals.kuratchi.auth.emailVerification = {
        /**
         * Send verification email to user
         */
        send: async (
          userId: string,
          email: string,
          redirectTo?: string
        ): Promise<{ success: true } | { success: false; error: string }> => {
          try {
            if (!userId || !email) {
              return { success: false, error: 'user_id_and_email_required' };
            }
            
            const orgId = getOrganizationId();
            if (!orgId) {
              return { success: false, error: 'organization_not_found' };
            }
            
            const orgDb = await getOrgDb();
            if (!orgDb) {
              return { success: false, error: 'organization_database_not_found' };
            }
            
            // Check if already verified
            const { data: user } = await orgDb.users.where({ id: userId }).first();
            if (user?.emailVerified) {
              return { success: false, error: 'email_already_verified' };
            }
            
            // Check for recent verification token (cooldown)
            const { data: recentToken } = await orgDb.emailVerificationTokens
              ?.where({ userId })
              .orderBy({ created_at: 'desc' })
              .first();
            
            if (recentToken && (Date.now() - recentToken.created_at) < resendCooldown) {
              const waitTime = Math.ceil((resendCooldown - (Date.now() - recentToken.created_at)) / 1000);
              return { success: false, error: `please_wait_${waitTime}_seconds` };
            }
            
            // Callback before sending
            if (options.onBeforeSend) {
              await options.onBeforeSend(email, userId);
            }
            
            // Create verification token
            const token = crypto.randomUUID();
            const expiresAt = Date.now() + tokenExpiry;
            
            // Store token (create table if using emailVerificationTokens)
            if (orgDb.emailVerificationTokens) {
              await orgDb.emailVerificationTokens.insert({
                id: crypto.randomUUID(),
                token,
                userId,
                email,
                redirect_to: redirectTo || '/',
                expires_at: expiresAt,
                created_at: Date.now(),
                updated_at: Date.now(),
                deleted_at: null
              });
            } else {
              // Fallback: use a generic tokens table or magicLinkTokens
              await orgDb.magicLinkTokens?.insert({
                token,
                email,
                redirect_to: redirectTo || '/',
                expires_at: expiresAt,
                created_at: Date.now(),
                token_type: 'email_verification',
                user_id: userId
              });
            }
            
            // Build verification link URL
            const url = new URL(ctx.event.request.url);
            const origin = ctx.env.ORIGIN || `${url.protocol}//${url.host}`;
            const link = `${origin}/auth/verify-email/callback?token=${encodeURIComponent(token)}&org=${encodeURIComponent(orgId)}`;
            
            // Generate email template
            const template = options.emailTemplate
              ? options.emailTemplate(link, email)
              : {
                  subject: 'Verify your email address',
                  html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                      <h2 style="color: #0f172a; margin-bottom: 24px;">Verify your email address</h2>
                      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                        Please click the button below to verify your email address and complete your account setup.
                      </p>
                      <a href="${link}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                        Verify Email
                      </a>
                      <p style="color: #94a3b8; font-size: 14px; margin-top: 32px;">
                        This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
                      </p>
                    </div>
                  `
                };
            
            // Send email using email service (auto-tracked)
            const result = await sendEmailService(ctx.event, {
              to: email,
              subject: template.subject,
              html: template.html,
              emailType: 'email_verification',
              organizationId: orgId,
              userId,
              metadata: {
                tokenId: token,
                expiresAt: new Date(expiresAt).toISOString()
              }
            });
            
            if (!result.success) {
              return { success: false, error: result.error || 'send_failed' };
            }
            
            return { success: true };
          } catch (e: any) {
            console.error('[Email Verification] Send failed:', e);
            return { success: false, error: e?.message || 'send_failed' };
          }
        },
        
        /**
         * Verify email with token (uses internal verifyToken function)
         */
        verify: async (
          token: string,
          organizationId: string
        ): Promise<{ success: true; userId: string } | { success: false; error: string }> => {
          const result = await verifyToken(token, organizationId);
          if (result.success) {
            return { success: true, userId: result.userId };
          }
          return result;
        },
        
        /**
         * Resend verification email (uses internal route handler logic)
         */
        resend: async (
          userId: string
        ): Promise<{ success: true } | { success: false; error: string }> => {
          try {
            const orgDb = await getOrgDb();
            if (!orgDb) {
              return { success: false, error: 'organization_database_not_found' };
            }
            
            // Get user
            const { data: user } = await orgDb.users.where({ id: userId }).first();
            if (!user) {
              return { success: false, error: 'user_not_found' };
            }
            
            if (user.emailVerified) {
              return { success: false, error: 'email_already_verified' };
            }
            
            if (!user.email) {
              return { success: false, error: 'user_has_no_email' };
            }
            
            // Use the send method
            return ctx.locals.kuratchi.auth.emailVerification.send(
              userId,
              user.email,
              '/'
            );
          } catch (e: any) {
            console.error('[Email Verification] Resend failed:', e);
            return { success: false, error: e?.message || 'resend_failed' };
          }
        },
        
        /**
         * Check if user's email is verified
         */
        isVerified: async (userId: string): Promise<boolean> => {
          try {
            const orgDb = await getOrgDb();
            if (!orgDb) return false;
            
            const { data: user } = await orgDb.users.where({ id: userId }).first();
            return !!user?.emailVerified;
          } catch {
            return false;
          }
        }
      } satisfies EmailVerificationExtension;
    }
  };
}
