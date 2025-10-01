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
    
    return orgUsers?.organization_id || null;
  } catch (error) {
    console.warn('[Email Auth] Failed to find organization for email:', error);
    return null;
  }
}

export function emailAuthPlugin(options: EmailAuthPluginOptions = {}): AuthPlugin {
  const sendRoute = options.sendRoute || '/auth/magic/send';
  const callbackRoute = options.callbackRoute || '/auth/magic/callback';
  const tokenExpiry = options.tokenExpiry || 900000; // 15 min
  const provider = options.provider || 'resend';
  
  return {
    name: 'email-auth',
    priority: 50, // After session and admin
    
    async onRequest(ctx: PluginContext) {
      const url = new URL(ctx.event.request.url);
      const pathname = url.pathname;
      
      // POST /auth/magic/send
      if (pathname === sendRoute && ctx.event.request.method === 'POST') {
        try {
          const body = await ctx.event.request.json().catch(() => ({}));
          const email = (body?.email || '').trim();
          let redirectTo = body?.redirectTo || url.searchParams.get('redirectTo') || '/';
          let orgId = body?.organizationId || url.searchParams.get('org');
          
          const apiKey = options.apiKey || ctx.env.RESEND_API_KEY;
          const from = options.from || ctx.env.EMAIL_FROM;
          
          if (!apiKey || !from) {
            return new Response(
              JSON.stringify({ success: false, error: 'email_not_configured' }),
              { status: 500, headers: { 'content-type': 'application/json' } }
            );
          }
          
          if (!email) {
            return new Response(
              JSON.stringify({ success: false, error: 'email_required' }),
              { status: 400, headers: { 'content-type': 'application/json' } }
            );
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
            return new Response(
              JSON.stringify({ success: false, error: 'organization_not_found_for_email' }),
              { status: 404, headers: { 'content-type': 'application/json' } }
            );
          }
          
          // Callback before sending
          if (options.onBeforeSend) {
            await options.onBeforeSend(email, orgId);
          }
          
          // Get organization auth service
          const orgDb = await ctx.locals.kuratchi?.orgDatabaseClient?.(orgId);
          if (!orgDb) {
            return new Response(
              JSON.stringify({ success: false, error: 'organization_database_not_found' }),
              { status: 404, headers: { 'content-type': 'application/json' } }
            );
          }
          
          // Create magic link token
          const tokenData = {
            email,
            organizationId: orgId,
            redirectTo,
            expiresAt: Date.now() + tokenExpiry
          };
          
          // Store token in org database
          const token = crypto.randomUUID();
          await orgDb.magicLinkTokens.insert({
            token,
            email,
            redirect_to: redirectTo,
            expires_at: tokenData.expiresAt,
            created_at: Date.now()
          });
          
          // Build magic link
          const origin = ctx.env.ORIGIN || `${url.protocol}//${url.host}`;
          const link = `${origin}${callbackRoute}?token=${encodeURIComponent(token)}&org=${encodeURIComponent(orgId)}`;
          
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
          
          return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        } catch (e: any) {
          console.error('[Email Auth] Send failed:', e);
          return new Response(
            JSON.stringify({ success: false, error: 'send_failed', detail: e?.message || String(e) }),
            { status: 500, headers: { 'content-type': 'application/json' } }
          );
        }
      }
      
      // GET /auth/magic/callback
      if (pathname === callbackRoute && ctx.event.request.method === 'GET') {
        const token = url.searchParams.get('token') || '';
        const orgId = url.searchParams.get('org') || '';
        
        if (!token || !orgId) {
          return new Response('Bad Request', { status: 400 });
        }
        
        try {
          // Get organization database
          const orgDb = await ctx.locals.kuratchi?.orgDatabaseClient?.(orgId);
          if (!orgDb) {
            return new Response('Organization database not found', { status: 404 });
          }
          
          // Verify token
          const { data: tokenRecord } = await orgDb.magicLinkTokens
            .where({ token })
            .first();
          
          if (!tokenRecord) {
            return new Response('Invalid token', { status: 401 });
          }
          
          if (tokenRecord.expires_at < Date.now()) {
            return new Response('Token expired', { status: 401 });
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
            const { data: newUser } = await orgDb.users.insert({
              email: tokenRecord.email,
              created_at: Date.now()
            });
            user = newUser;
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
          
          // Delete used token
          await orgDb.magicLinkTokens.where({ token }).delete();
          
          // Set session cookie (use session plugin's helper)
          const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const sessionCookie = JSON.stringify(sessionData);
          ctx.locals.kuratchi?.setSessionCookie?.(sessionCookie, { expires });
          
          // Callback after success
          if (options.onSuccess) {
            await options.onSuccess(user.email, user);
          }
          
          // Redirect
          const dest = tokenRecord.redirect_to || '/';
          return new Response(null, { status: 303, headers: { Location: dest } });
        } catch (e: any) {
          console.error('[Email Auth] Callback failed:', e);
          return new Response('Internal Server Error', { status: 500 });
        }
      }
    }
  };
}
