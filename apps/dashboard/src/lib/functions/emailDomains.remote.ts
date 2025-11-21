/**
 * Email Domains API
 * Manages organization-level domains for email sending via AWS SES
 */

import { getRequestEvent, query, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { 
  SESv2Client,
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityDkimAttributesCommand
} from '@aws-sdk/client-sesv2';
import { env } from '$env/dynamic/private';
import * as v from 'valibot';
import { getAdminDatabase } from '$lib/server/db-context';

// SES V2 client helper
let sesClient: SESv2Client | null = null;
const getSESClient = () => {
  const region = env.AWS_SES_REGION || env.AWS_REGION || 'us-east-1';
  if (!region || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    error(500, 'AWS SES credentials not configured');
  }
  if (!sesClient) {
    sesClient = new SESv2Client({
      region,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      }
    });
  }
  return sesClient;
};

/**
 * Generate a unique tenant identifier for the organization
 * This is used for tagging SES identities per organization
 */
const getTenantId = (organizationId: string) => {
  return `org-${organizationId.slice(0, 8)}`;
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

    const result = await db.domains
      .where({ organizationId, deleted_at: { isNullish: true } })
      .many();

    if (!result.success) {
      console.error('[emailDomains.get] Failed to fetch domains:', result.error);
      return [];
    }

    console.log('[emailDomains.get] Fetched domains:', result.data);

    return result.data || [];
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
    const ses = getSESClient();
    
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    const organizationId = (event.locals.session as any)?.organizationId;
    if (!organizationId) {
      return { success: false, error: 'Organization not found' };
    }

    // Get organization
    const orgResult = await db.organizations
      .where({ id: organizationId, deleted_at: { isNullish: true } })
      .first();

    if (!orgResult.success || !orgResult.data) {
      return { success: false, error: 'Organization not found' };
    }

    const org = orgResult.data;

    // Generate tenant ID for tagging
    const tenantId = getTenantId(organizationId);

    // Normalize domain
    const normalizedDomain = data.name
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');

    // Create email identity in SES V2 with tenant isolation
    // Let AWS manage DKIM signing automatically
    const createIdentityCommand = new CreateEmailIdentityCommand({
      EmailIdentity: normalizedDomain,
      Tags: [
        { Key: 'OrganizationId', Value: organizationId },
        { Key: 'TenantId', Value: tenantId },
        { Key: 'ManagedBy', Value: 'Kuratchi' }
      ]
    });

    const identityResponse = await ses.send(createIdentityCommand);

    if (!identityResponse.IdentityType) {
      return { success: false, error: 'Failed to create email identity in SES' };
    }

    // Get identity details including DKIM tokens
    const getIdentityCommand = new GetEmailIdentityCommand({
      EmailIdentity: normalizedDomain
    });
    const identityDetails = await ses.send(getIdentityCommand);

    const dkimTokens = identityDetails.DkimAttributes?.Tokens || [];
    const verificationToken = identityDetails.DkimAttributes?.SigningAttributesOrigin;

    console.log('[emailDomains.add] DKIM tokens:', dkimTokens);
    console.log('[emailDomains.add] Verification token:', verificationToken);

    // Build DNS records for user to configure
    const dnsRecords = [
      // DKIM CNAME records for email authentication
      ...dkimTokens.map((token) => ({
        type: 'CNAME',
        name: `${token}._domainkey.${normalizedDomain}`,
        value: `${token}.dkim.amazonses.com`,
        priority: null,
        description: 'DKIM signing record for email authentication'
      })),
      // DMARC policy record (recommended for email deliverability)
      {
        type: 'TXT',
        name: `_dmarc.${normalizedDomain}`,
        value: 'v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@' + normalizedDomain,
        priority: null,
        description: 'DMARC policy for email authentication and reporting'
      }
    ];

    console.log('[emailDomains.add] DNS records to save:', dnsRecords);

    // Insert domain in database
    const now = new Date().toISOString();
    const result = await db.domains.insert({
      id: crypto.randomUUID(),
      name: normalizedDomain,
      organizationId,
      emailEnabled: true,
      emailVerified: false,
      sesVerificationToken: verificationToken || '',
      sesDkimTokens: JSON.stringify(dkimTokens),
      emailDnsRecords: JSON.stringify(dnsRecords),
      sesTenantId: tenantId,
      siteId: null,
      created_at: now,
      updated_at: now,
      deleted_at: null
    });

    if (!result.success) {
      // Cleanup: delete from SES if DB insert fails
      try {
        await ses.send(new DeleteEmailIdentityCommand({ EmailIdentity: normalizedDomain }));
      } catch (cleanupErr) {
        console.error('[emailDomains.add] Cleanup failed:', cleanupErr);
      }
      return { success: false, error: 'Failed to save domain' };
    }

    return { 
      success: true, 
      domain: result.data,
      dnsRecords,
      tenantId
    };
  } catch (err) {
    console.error('[emailDomains.add] error:', err);
    return { success: false, error: 'Failed to add domain: ' + (err as Error).message };
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
    const ses = getSESClient();
    
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    // Get domain from database
    const domainResult = await db.domains
      .where({ id: data.domainId, deleted_at: { isNullish: true } })
      .first();

    if (!domainResult.success || !domainResult.data) {
      return { success: false, error: 'Domain not found' };
    }

    const domain = domainResult.data;

    // Get identity details from SES V2
    const getIdentityCommand = new GetEmailIdentityCommand({
      EmailIdentity: domain.name
    });
    const identityDetails = await ses.send(getIdentityCommand);

    const dkimStatus = identityDetails.DkimAttributes?.Status;
    const verifiedForSending = identityDetails.VerifiedForSendingStatus;

    const isFullyVerified = dkimStatus === 'SUCCESS' && verifiedForSending === true;

    if (isFullyVerified) {
      // Update database
      const now = new Date().toISOString();
      await db.domains
        .where({ id: data.domainId })
        .update({ emailVerified: true, updated_at: now });

      return { success: true, verified: true };
    }

    return { 
      success: false, 
      error: 'Domain not yet verified. Please ensure all DNS records are configured and have propagated.',
      status: {
        dkim: dkimStatus || 'PENDING',
        verifiedForSending: verifiedForSending || false
      }
    };
  } catch (err) {
    console.error('[emailDomains.verify] error:', err);
    return { success: false, error: 'Failed to verify domain: ' + (err as Error).message };
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
    const ses = getSESClient();
    
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    // Get domain
    const domainResult = await db.domains
      .where({ id: data.domainId, deleted_at: { isNullish: true } })
      .first();

    if (!domainResult.success || !domainResult.data) {
      return { success: false, error: 'Domain not found' };
    }

    const domain = domainResult.data;

    // Delete email identity from SES V2
    try {
      const deleteCommand = new DeleteEmailIdentityCommand({
        EmailIdentity: domain.name
      });
      await ses.send(deleteCommand);
    } catch (err) {
      console.warn('[emailDomains.delete] Failed to delete from SES:', err);
      // Continue with DB deletion even if SES fails
    }

    // Soft delete from database
    const now = new Date().toISOString();
    const result = await db.domains
      .where({ id: data.domainId })
      .update({ deleted_at: now });

    if (!result.success) {
      return { success: false, error: 'Failed to delete domain' };
    }

    return { success: true };
  } catch (err) {
    console.error('[emailDomains.delete] error:', err);
    return { success: false, error: 'Failed to delete domain' };
  }
});
