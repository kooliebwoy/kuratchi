/**
 * Email API - Uses Kuratchi SDK email service
 * All emails are tracked in the organization database for tenant isolation
 */

import { getRequestEvent, query, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { getEmailHistory, getEmailById as getEmailByIdSDK, sendEmail } from 'kuratchi-sdk/email';
import * as v from 'valibot';

// Helpers
const guardedQuery = <R>(fn: () => Promise<R>) => {
  return query(async () => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');
    return fn();
  });
};

const guardedCommand = <Schema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: Schema,
  fn: (data: any) => Promise<any>
) => {
  return command(schema, async (data: any) => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');
    return fn(data);
  });
};

/**
 * Get list of emails from database (tracked by SDK in org DB)
 */
export const getEmails = guardedQuery(async () => {
  try {
    const event = getRequestEvent();
    
    // Get all emails from org database (auto-tracked by SDK)
    const emails = await getEmailHistory(event, {
      limit: 100
    });

    return emails;
  } catch (err) {
    console.error('[emails.getEmails] error:', err);
    return [];
  }
});

/**
 * Get email statistics from tracked emails
 */
export const getEmailStats = guardedQuery(async () => {
  try {
    const event = getRequestEvent();
    const emails = await getEmailHistory(event, { 
      limit: 1000 
    });

    if (!emails || emails.length === 0) {
      return {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
        last24h: 0
      };
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    return {
      total: emails.length,
      sent: emails.filter((e: any) => e.status === 'sent').length,
      failed: emails.filter((e: any) => e.status === 'failed').length,
      pending: emails.filter((e: any) => e.status === 'pending').length,
      last24h: emails.filter((e: any) => {
        const sentAt = new Date(e.sentAt).getTime();
        return sentAt > oneDayAgo;
      }).length
    };
  } catch (err) {
    console.error('[emails.getEmailStats] error:', err);
    return {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
      last24h: 0
    };
  }
});

/**
 * Get specific email details by ID
 */
export const getEmailById = guardedQuery(async () => {
  try {
    const event = getRequestEvent();
    const emailId = event.url.searchParams.get('id');
    
    if (!emailId) {
      return null;
    }

    const email = await getEmailByIdSDK(event, emailId);
    return email;
  } catch (err) {
    console.error('[emails.getEmailById] error:', err);
    return null;
  }
});

/**
 * Send a test email
 */
const testEmailSchema = v.object({
  to: v.pipe(v.string(), v.email()),
  from: v.pipe(v.string(), v.email()),
  subject: v.pipe(v.string(), v.minLength(1)),
  body: v.pipe(v.string(), v.minLength(1)),
  isHtml: v.optional(v.boolean())
});

export const sendTestEmail = guardedCommand(testEmailSchema, async (data) => {
  try {
    const event = getRequestEvent();
    const userId = event.locals.session?.user?.id;

    console.log('[sendTestEmail] Starting email send:', { to: data.to, from: data.from, subject: data.subject });

    // Send email using the SDK's email plugin
    // organizationId is implicit from the org DB context
    const result = await sendEmail(event, {
      to: data.to,
      from: data.from,
      subject: data.subject,
      html: data.isHtml ? data.body : undefined,
      text: !data.isHtml ? data.body : undefined,
      emailType: 'test',
      userId
    });

    console.log('[sendTestEmail] Result:', result);

    if (!result.success) {
      // Check if it's a sandbox mode error
      if (result.error?.includes('Email address is not verified') || result.error?.includes('MessageRejected')) {
        return { 
          success: false, 
          error: `AWS SES Sandbox Mode: Your account can only send emails to verified addresses. Please either:\n1. Verify the recipient email (${data.to}) in AWS SES Console\n2. Request production access in AWS SES to send to any email address`
        };
      }
      return { success: false, error: result.error || 'Failed to send email' };
    }

    return { success: true, messageId: result.id };
  } catch (err) {
    console.error('[emails.sendTestEmail] error:', err);
    return { success: false, error: (err as Error).message };
  }
});
