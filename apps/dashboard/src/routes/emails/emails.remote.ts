import { getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { Resend } from 'resend';

// Helpers
const guardedQuery = <R>(fn: () => Promise<R>) => {
  return query(async () => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');
    return fn();
  });
};

/**
 * Get list of emails from Resend
 */
export const getEmails = guardedQuery(async () => {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('[emails.getEmails] RESEND_API_KEY not configured');
      return [];
    }

    const resend = new Resend(resendApiKey);

    // List emails (Resend API returns most recent first)
    const { data, error: resendError } = await resend.emails.list({
      limit: 100
    });

    if (resendError) {
      console.error('[emails.getEmails] Resend error:', resendError);
      return [];
    }

    return data?.data || [];
  } catch (err) {
    console.error('[emails.getEmails] error:', err);
    return [];
  }
});

/**
 * Get email statistics
 */
export const getEmailStats = guardedQuery(async () => {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return {
        total: 0,
        delivered: 0,
        bounced: 0,
        complained: 0,
        last24h: 0
      };
    }

    const resend = new Resend(resendApiKey);
    const { data } = await resend.emails.list({ limit: 100 });

    if (!data?.data) {
      return {
        total: 0,
        delivered: 0,
        bounced: 0,
        complained: 0,
        last24h: 0
      };
    }

    const emails = data.data;
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    return {
      total: emails.length,
      delivered: emails.filter((e: any) => e.last_event === 'delivered').length,
      bounced: emails.filter((e: any) => e.last_event === 'bounced').length,
      complained: emails.filter((e: any) => e.last_event === 'complained').length,
      last24h: emails.filter((e: any) => {
        const createdAt = new Date(e.created_at).getTime();
        return createdAt > oneDayAgo;
      }).length
    };
  } catch (err) {
    console.error('[emails.getEmailStats] error:', err);
    return {
      total: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      last24h: 0
    };
  }
});

/**
 * Get specific email details
 */
export const getEmailById = guardedQuery(async () => {
  try {
    const { url } = getRequestEvent();
    const emailId = url.searchParams.get('id');
    
    if (!emailId) {
      return null;
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('[emails.getEmailById] RESEND_API_KEY not configured');
      return null;
    }

    const resend = new Resend(resendApiKey);
    const { data, error: resendError } = await resend.emails.get(emailId);

    if (resendError) {
      console.error('[emails.getEmailById] Resend error:', resendError);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[emails.getEmailById] error:', err);
    return null;
  }
});
