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
import { getAdminDatabase, getDatabase } from '$lib/server/db-context';
import { deleteCustomHostname, getCustomHostname } from 'kuratchi-sdk/domains';
import { removeCustomDomainFromKV } from '$lib/server/kv-sync';

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
  name: v.pipe(v.string(), v.minLength(3), v.maxLength(255)),
  purpose: v.optional(v.picklist(['email', 'site', 'both']))
});

export const addEmailDomain = guardedCommand(addDomainSchema, async (data) => {
  try {
    const { event } = ensureSession();
    const db = await getAdminDatabase(event.locals);
    const purpose = data.purpose || 'email';
    
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
    let normalizedDomain = data.name
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
    
    // Only strip www. for email-only domains
    if (purpose === 'email') {
      normalizedDomain = normalizedDomain.replace(/^www\./, '');
    }

    let dkimTokens: string[] = [];
    let verificationToken: string | undefined;
    let dnsRecords: any[] = [];
    let emailEnabled = false;

    // Only set up SES if email is enabled
    if (purpose !== 'site') {
      emailEnabled = true;
      const ses = getSESClient();

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

      dkimTokens = identityDetails.DkimAttributes?.Tokens || [];
      verificationToken = identityDetails.DkimAttributes?.SigningAttributesOrigin;

      console.log('[emailDomains.add] DKIM tokens:', dkimTokens);
      console.log('[emailDomains.add] Verification token:', verificationToken);

      // Build DNS records for user to configure
      dnsRecords = [
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
    }

    // Insert domain in database
    const now = new Date().toISOString();
    const result = await db.domains.insert({
      id: crypto.randomUUID(),
      name: normalizedDomain,
      organizationId,
      emailEnabled,
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
      // Cleanup: delete from SES if DB insert fails and email was enabled
      if (emailEnabled) {
        try {
          const ses = getSESClient();
          await ses.send(new DeleteEmailIdentityCommand({ EmailIdentity: normalizedDomain }));
        } catch (cleanupErr) {
          console.error('[emailDomains.add] Cleanup failed:', cleanupErr);
        }
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
    const adminDb = await getAdminDatabase(event.locals);
    const orgDb = await getDatabase(event.locals);
    
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    // Get domain
    const domainResult = await adminDb.domains
      .where({ id: data.domainId, deleted_at: { isNullish: true } })
      .first();

    if (!domainResult.success || !domainResult.data) {
      return { success: false, error: 'Domain not found' };
    }

    const domain = domainResult.data;

    // If domain is linked to a site, clean up Cloudflare and site custom domain
    if (domain.siteId && domain.cloudflareHostnameId) {
      try {
        const zoneId = env.CF_SSL_FOR_SAAS_ZONE_ID;
        if (zoneId) {
          // Delete custom hostname from Cloudflare
          await deleteCustomHostname(zoneId, domain.cloudflareHostnameId);
        }
      } catch (err) {
        console.warn('[emailDomains.delete] Failed to delete Cloudflare hostname:', err);
        // Continue with other cleanup even if Cloudflare fails
      }

      // Remove from KV store
      try {
        await removeCustomDomainFromKV(event.locals, domain.name);
      } catch (err) {
        console.warn('[emailDomains.delete] Failed to remove from KV:', err);
      }

      // Delete site custom domain record
      if (orgDb && domain.siteCustomDomainId) {
        try {
          await orgDb.siteCustomDomains.delete({ id: domain.siteCustomDomainId });
        } catch (err) {
          console.warn('[emailDomains.delete] Failed to delete site custom domain record:', err);
        }
      }

      // Unlink domain from site in admin DB
      await adminDb.domains
        .where({ id: data.domainId })
        .update({
          siteId: null,
          siteCustomDomainId: null,
          cloudflareHostnameId: null,
          cloudflareHostnameStatus: null,
          cloudflareVerification: null
        });
    }

    // Delete email identity from SES V2 (if email was enabled)
    if (domain.emailEnabled) {
      try {
        const ses = getSESClient();
        const deleteCommand = new DeleteEmailIdentityCommand({
          EmailIdentity: domain.name
        });
        await ses.send(deleteCommand);
      } catch (err) {
        console.warn('[emailDomains.delete] Failed to delete from SES:', err);
        // Continue with DB deletion even if SES fails
      }
    }

    // Soft delete from database
    const now = new Date().toISOString();
    const result = await adminDb.domains
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

/**
 * Sync domain statuses from Cloudflare
 * Fetches latest hostname data and updates database
 */
export const syncDomainStatuses = guardedCommand(v.object({}), async () => {
  try {
    const { event } = ensureSession();
    const adminDb = await getAdminDatabase(event.locals);
    
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    const organizationId = (event.locals.session as any)?.organizationId;
    if (!organizationId) {
      return { success: false, error: 'Organization not found' };
    }

    // Get all domains for this org that have Cloudflare hostname IDs
    const domainsResult = await adminDb.domains
      .where({ 
        organizationId, 
        deleted_at: { isNullish: true },
        cloudflareHostnameId: { isNotNullish: true }
      })
      .many();

    if (!domainsResult.success || !domainsResult.data) {
      return { success: true, updated: 0 }; // No domains to sync
    }

    const zoneId = env.CF_SSL_FOR_SAAS_ZONE_ID;
    if (!zoneId) {
      return { success: false, error: 'Cloudflare zone not configured' };
    }

    let updated = 0;
    const now = new Date().toISOString();

    // Update each domain with fresh Cloudflare data
    for (const domain of domainsResult.data) {
      if (!domain.cloudflareHostnameId) continue;

      try {
        const cfResponse = await getCustomHostname(zoneId, domain.cloudflareHostnameId);
        
        if (cfResponse?.success && cfResponse.result) {
          const cfData = cfResponse.result;
          
          await adminDb.domains
            .where({ id: domain.id })
            .update({
              cloudflareHostnameStatus: cfData.status || 'pending',
              cloudflareVerification: JSON.stringify({
                ownership_verification: cfData.ownership_verification || {},
                ssl: cfData.ssl || {}
              }),
              updated_at: now
            });
          
          updated++;
        }
      } catch (err) {
        console.warn(`[syncDomainStatuses] Failed to sync domain ${domain.id}:`, err);
        // Continue with next domain
      }
    }

    return { success: true, updated };
  } catch (err) {
    console.error('[syncDomainStatuses] error:', err);
    return { success: false, error: 'Failed to sync domain statuses' };
  }
});
