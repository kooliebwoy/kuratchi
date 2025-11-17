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
  PutEmailIdentityDkimAttributesCommand,
  CreateTenantCommand,
  GetTenantCommand,
  DeleteTenantCommand,
  type EmailIdentity,
  type DkimAttributes
} from '@aws-sdk/client-sesv2';
import { env } from '$env/dynamic/private';
import * as v from 'valibot';
import { getAdminDatabase } from '$lib/server/db-context';

// SES V2 client helper
let sesClient: SESv2Client | null = null;
const getSESClient = () => {
  if (!env.AWS_SES_REGION || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    error(500, 'AWS SES credentials not configured');
  }
  if (!sesClient) {
    sesClient = new SESv2Client({
      region: env.AWS_SES_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      }
    });
  }
  return sesClient;
};

/**
 * Ensure organization has a SES tenant
 * Creates tenant if it doesn't exist
 */
const ensureTenant = async (db: any, organizationId: string, organizationName: string) => {
  const ses = getSESClient();
  
  // Get organization
  const org = await db.query.organizations.findFirst({
    where: (fields: any, { eq }: any) => eq(fields.id, organizationId)
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  // If tenant already exists, return it
  if (org.sesTenantId) {
    try {
      const getTenant = await ses.send(new GetTenantCommand({ TenantName: org.sesTenantId }));
      return org.sesTenantId;
    } catch (err) {
      // Tenant doesn't exist in SES, create it
      console.warn('[ensureTenant] Tenant exists in DB but not in SES, recreating');
    }
  }

  // Create new tenant
  const tenantName = `org-${organizationId.slice(0, 8)}-${Date.now()}`;
  
  try {
    await ses.send(new CreateTenantCommand({
      TenantName: tenantName,
      EngagementEventDestinations: [],
      EmailSendingEnabled: true
    }));

    // Update organization with tenant ID
    await db.update.organizations(
      { sesTenantId: tenantName },
      (fields: any, { eq }: any) => eq(fields.id, organizationId)
    );

    return tenantName;
  } catch (err) {
    console.error('[ensureTenant] Failed to create tenant:', err);
    throw new Error('Failed to create SES tenant');
  }
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
    const ses = getSESClient();
    
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    const organizationId = (event.locals.session as any)?.organizationId;
    if (!organizationId) {
      return { success: false, error: 'Organization not found' };
    }

    // Get organization
    const org = await db.query.organizations.findFirst({
      where: (fields: any, { eq }: any) => eq(fields.id, organizationId)
    });

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    // Ensure organization has a SES tenant
    const tenantId = await ensureTenant(db, organizationId, org.organizationName || 'Organization');

    // Normalize domain
    const normalizedDomain = data.name
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');

    // Create email identity in SES V2 with tenant isolation
    const createIdentityCommand = new CreateEmailIdentityCommand({
      EmailIdentity: normalizedDomain,
      DkimSigningAttributes: {
        DomainSigningSelector: 'ses',
      },
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

    // Build DNS records for user to configure
    const dnsRecords = [
      // DKIM CNAME records
      ...dkimTokens.map((token) => ({
        type: 'CNAME',
        name: `${token}._domainkey.${normalizedDomain}`,
        value: `${token}.dkim.amazonses.com`,
        priority: null,
        description: 'DKIM signing record for email authentication'
      }))
    ];

    // Insert domain in database
    const result = await db.insert.domains({
      id: crypto.randomUUID(),
      name: normalizedDomain,
      organizationId,
      emailEnabled: true,
      emailVerified: false,
      sesVerificationToken: verificationToken || '',
      sesDkimTokens: JSON.stringify(dkimTokens),
      emailDnsRecords: JSON.stringify(dnsRecords),
      sesTenantId: tenantId
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
      domain: result.results,
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
    const domain = await db.query.domains.findFirst({
      where: (fields: any, { eq }: any) => eq(fields.id, data.domainId)
    });

    if (!domain) {
      return { success: false, error: 'Domain not found' };
    }

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
      await db.update.domains(
        { emailVerified: true },
        (fields: any, { eq }: any) => eq(fields.id, data.domainId)
      );

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
    const domain = await db.query.domains.findFirst({
      where: (fields: any, { eq }: any) => eq(fields.id, data.domainId)
    });

    if (!domain) {
      return { success: false, error: 'Domain not found' };
    }

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
