/**
 * Email Domains API
 * Manages organization-level domains for email sending via Resend
 */

import { getRequestEvent, query, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import * as v from 'valibot';
import { getAdminDatabase } from '$lib/server/db-context';

// Resend client helper
let resendClient: Resend | null = null;
const getResendClient = () => {
  if (!env.RESEND_API_KEY) {
    error(500, 'Resend API key not configured');
  }
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
};

const ensureSession = () => {
  const event = getRequestEvent();
  const session = event.locals.session;
  if (!session?.user) {
    error(401, 'Unauthorized');
  }
  return { event, session };
};

const guardedQuery = <R>(fn: () => Promise<R>) => {
  return query(async () => {
    ensureSession();
    return fn();
  });
};

const guardedCommand = <Schema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: Schema,
  fn: (data: any) => Promise<any>
) => {
  return command(schema, async (data: any) => {
    ensureSession();
    return fn(data);
  });
};

/**
 * Get all email domains for the organization
 */
export const getEmailDomains = guardedQuery(async () => {
  try {
    const { event } = ensureSession();
    const db = await getAdminDatabase(event.locals);
    
    if (!db) {
      console.error('[emailDomains.get] Database not available');
      return [];
    }

    const organizationId = (event.locals.session as any)?.organizationId;
    if (!organizationId) {
      return [];
    }

    const domains = await db.query.domains.findMany({
      where: (fields: any, { eq }: any) => eq(fields.organizationId, organizationId),
      orderBy: (fields: any, { desc }: any) => [desc(fields.created_at)]
    });

    return domains || [];
  } catch (err) {
    console.error('[emailDomains.get] error:', err);
    return [];
  }
});

/**
 * Add an email domain
 */
const addDomainSchema = v.object({
  name: v.pipe(v.string(), v.minLength(3), v.maxLength(255))
});

export const addEmailDomain = guardedCommand(addDomainSchema, async (data) => {
  try {
    const { event } = ensureSession();
    const db = await getAdminDatabase(event.locals);
    const resend = getResendClient();
    
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    const organizationId = (event.locals.session as any)?.organizationId;
    if (!organizationId) {
      return { success: false, error: 'Organization not found' };
    }

    // Normalize domain
    const normalizedDomain = data.name
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');

    // Create domain in Resend
    const resendDomain = await resend.domains.create({
      name: normalizedDomain,
      region: 'us-east-1' // or make this configurable
    });

    if (!resendDomain.data?.id) {
      return { success: false, error: 'Failed to create domain in Resend' };
    }

    // Get DNS records from Resend
    const dnsRecords = (resendDomain.data as any)?.records || [];

    // Insert domain in database
    const result = await db.insert.domains({
      id: crypto.randomUUID(),
      name: normalizedDomain,
      organizationId,
      emailEnabled: true,
      emailVerified: false,
      resendDomainId: resendDomain.data.id,
      emailDnsRecords: JSON.stringify(dnsRecords)
    });

    if (!result.success) {
      // Cleanup: delete from Resend if DB insert fails
      await resend.domains.remove(resendDomain.data.id);
      return { success: false, error: 'Failed to save domain' };
    }

    return { 
      success: true, 
      domain: result.results,
      dnsRecords
    };
  } catch (err) {
    console.error('[emailDomains.add] error:', err);
    return { success: false, error: 'Failed to add domain' };
  }
});

/**
 * Verify an email domain
 */
const verifyDomainSchema = v.object({
  domainId: v.string()
});

export const verifyEmailDomain = guardedCommand(verifyDomainSchema, async (data) => {
  try {
    const { event } = ensureSession();
    const db = await getAdminDatabase(event.locals);
    const resend = getResendClient();
    
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    // Get domain from database
    const domain = await db.query.domains.findFirst({
      where: (fields: any, { eq }: any) => eq(fields.id, data.domainId)
    });

    if (!domain || !domain.resendDomainId) {
      return { success: false, error: 'Domain not found' };
    }

    // Verify with Resend
    const resendDomain = await resend.domains.verify(domain.resendDomainId);

    if ((resendDomain.data as any)?.status === 'verified') {
      // Update database
      await db.update.domains(
        { emailVerified: true },
        (fields: any, { eq }: any) => eq(fields.id, data.domainId)
      );

      return { success: true, verified: true };
    }

    return { 
      success: false, 
      error: 'Domain not yet verified. Please ensure all DNS records are configured.',
      status: (resendDomain.data as any)?.status
    };
  } catch (err) {
    console.error('[emailDomains.verify] error:', err);
    return { success: false, error: 'Failed to verify domain' };
  }
});

/**
 * Delete an email domain
 */
const deleteDomainSchema = v.object({
  domainId: v.string()
});

export const deleteEmailDomain = guardedCommand(deleteDomainSchema, async (data) => {
  try {
    const { event } = ensureSession();
    const db = await getAdminDatabase(event.locals);
    const resend = getResendClient();
    
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    // Get domain
    const domain = await db.query.domains.findFirst({
      where: (fields: any, { eq }: any) => eq(fields.id, data.domainId)
    });

    if (!domain) {
      return { success: false, error: 'Domain not found' };
    }

    // Delete from Resend if it exists
    if (domain.resendDomainId) {
      try {
        await resend.domains.remove(domain.resendDomainId);
      } catch (err) {
        console.warn('[emailDomains.delete] Failed to delete from Resend:', err);
        // Continue with DB deletion even if Resend fails
      }
    }

    // Delete from database
    const result = await db.delete.domains(
      (fields: any, { eq }: any) => eq(fields.id, data.domainId)
    );

    if (!result.success) {
      return { success: false, error: 'Failed to delete domain' };
    }

    return { success: true };
  } catch (err) {
    console.error('[emailDomains.delete] error:', err);
    return { success: false, error: 'Failed to delete domain' };
  }
});
