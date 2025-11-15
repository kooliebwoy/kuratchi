/**
 * Email API - Uses Kuratchi SDK email service
 * All emails are tracked in the admin database
 */

import { getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { getEmailHistory, getEmailById as getEmailByIdSDK } from 'kuratchi-sdk/email';

// Helpers
const guardedQuery = <R>(fn: () => Promise<R>) => {
  return query(async () => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');
    return fn();
  });
};

/**
 * Get list of emails from database (tracked by SDK)
 */
export const getEmails = guardedQuery(async () => {
  try {
    const event = getRequestEvent();
    
    // Get all emails from database (auto-tracked by SDK)
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
    const emails = await getEmailHistory(event, { limit: 1000 });

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
