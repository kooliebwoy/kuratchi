/**
 * Site Custom Domains API
 * Manages custom domains for sites (CNAME-based, no nameserver delegation)
 */

import { getRequestEvent, query, command } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { getDatabase, getAdminDatabase } from '$lib/server/db-context';
import { syncCustomDomainToKV, removeCustomDomainFromKV } from '$lib/server/kv-sync';
import { createCustomHostname } from 'kuratchi-sdk/domains';
import { env } from '$env/dynamic/private';

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
 * Get all custom domains for a site
 */
export const getSiteCustomDomains = guardedQuery(async () => {
  try {
    const { event } = ensureSession();
    const siteId = event.url.searchParams.get('siteId');
    
    if (!siteId) {
      return [];
    }

    const db = await getDatabase(event.locals);
    if (!db) {
      console.error('[siteCustomDomains.get] Database not available');
      return [];
    }

    const domains = await db.query.siteCustomDomains.findMany({
      where: (fields: any, { eq }: any) => eq(fields.siteId, siteId),
      orderBy: (fields: any, { desc }: any) => [desc(fields.created_at)]
    });

    return domains || [];
  } catch (err) {
    console.error('[siteCustomDomains.get] error:', err);
    return [];
  }
});

/**
 * Add a custom domain to a site
 */
const addDomainSchema = v.object({
  siteId: v.string(),
  domain: v.pipe(v.string(), v.minLength(3), v.maxLength(255))
});

export const addSiteCustomDomain = guardedCommand(addDomainSchema, async (data) => {
  try {
    const { event } = ensureSession();
    const db = await getDatabase(event.locals);
    
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    // Normalize domain (remove protocol, www, trailing slash)
    const normalizedDomain = data.domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');

    // Generate verification token
    const verificationToken = `kuratchi-verify-${crypto.randomUUID()}`;

    // Get site info for CNAME target
    const site = await db.query.sites.findFirst({
      where: (fields: any, { eq }: any) => eq(fields.id, data.siteId)
    });

    if (!site) {
      return { success: false, error: 'Site not found' };
    }

    const cnameTarget = `${site.subdomain}.kuratchi.com`;

    // Insert domain
    const result = await db.insert.siteCustomDomains({
      id: crypto.randomUUID(),
      siteId: data.siteId,
      domain: normalizedDomain,
      verified: false,
      cnameTarget,
      verificationToken,
      cloudflareStatus: 'pending',
      sslStatus: 'pending'
    });

    if (!result.success) {
      return { success: false, error: 'Failed to add domain' };
    }

    return { 
      success: true, 
      domain: result.results,
      verificationToken,
      cnameTarget
    };
  } catch (err) {
    console.error('[siteCustomDomains.add] error:', err);
    return { success: false, error: 'Failed to add domain' };
  }
});

/**
 * Verify a custom domain
 */
const verifyDomainSchema = v.object({
  domainId: v.string()
});

export const verifySiteCustomDomain = guardedCommand(verifyDomainSchema, async (data) => {
  try {
    const { event } = ensureSession();
    const db = await getDatabase(event.locals);
    
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    // Get domain
    const domain = await db.query.siteCustomDomains.findFirst({
      where: (fields: any, { eq }: any) => eq(fields.id, data.domainId)
    });

    if (!domain) {
      return { success: false, error: 'Domain not found' };
    }

    // TODO: Implement actual DNS verification
    // For now, we'll check if CNAME record exists using DNS lookup
    // This would typically use a DNS API or Node's dns module
    
    // Simulate verification check
    const isVerified = true; // Replace with actual DNS check

    if (isVerified) {
      await db.update.siteCustomDomains(
        { verified: true, cloudflareStatus: 'active', sslStatus: 'active' },
        (fields: any, { eq }: any) => eq(fields.id, data.domainId)
      );

      // Sync verified domain to KV for fast lookups
      // Get site info for KV mapping
      const site = await db.query.sites.findFirst({
        where: (fields: any, { eq }: any) => eq(fields.id, domain.siteId)
      });

      if (site) {
        const adminDb = await (event.locals.kuratchi as any)?.getAdminDb?.();
        if (adminDb) {
          const dbRecord = await adminDb.databases
            .where({ id: site.databaseId, deleted_at: { isNullish: true } })
            .first();

          if (dbRecord.success && dbRecord.data) {
            await syncCustomDomainToKV(event.locals, domain.domain, {
              siteId: site.id,
              orgId: (event.locals.session as any)?.organizationId,
              databaseId: site.databaseId,
              dbuuid: dbRecord.data.dbuuid,
              workerName: dbRecord.data.workerName
            });
          }
        }
      }

      return { success: true, verified: true };
    }

    return { success: false, error: 'DNS records not found. Please ensure CNAME is configured.' };
  } catch (err) {
    console.error('[siteCustomDomains.verify] error:', err);
    return { success: false, error: 'Failed to verify domain' };
  }
});

/**
 * Delete a custom domain
 */
const deleteDomainSchema = v.object({
  domainId: v.string()
});

export const deleteSiteCustomDomain = guardedCommand(deleteDomainSchema, async (data) => {
  try {
    const { event } = ensureSession();
    const db = await getDatabase(event.locals);
    
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    // Get domain before deleting to remove from KV
    const domain = await db.query.siteCustomDomains.findFirst({
      where: (fields: any, { eq }: any) => eq(fields.id, data.domainId)
    });

    const result = await db.delete.siteCustomDomains(
      (fields: any, { eq }: any) => eq(fields.id, data.domainId)
    );

    if (!result.success) {
      return { success: false, error: 'Failed to delete domain' };
    }

    // Remove from KV if it was verified
    if (domain && domain.verified) {
      await removeCustomDomainFromKV(event.locals, domain.domain);
    }

    return { success: true };
  } catch (err) {
    console.error('[siteCustomDomains.delete] error:', err);
    return { success: false, error: 'Failed to delete domain' };
  }
});

/**
 * Link an existing domain to a site
 * Creates Cloudflare custom hostname with HTTP validation and syncs to KV
 */
const linkDomainSchema = v.object({
  domainId: v.string(),
  siteId: v.string()
});

const domainInstructionsSchema = v.object({
  domainId: v.string()
});

export const getDomainLinkInstructions = guardedCommand(domainInstructionsSchema, async (data) => {
  try {
    const { event } = ensureSession();
    const orgDb = await getDatabase(event.locals);
    const adminDb = await getAdminDatabase(event.locals);
    
    if (!adminDb || !orgDb) {
      return { success: false, error: 'Database not available' };
    }

    const organizationId = (event.locals.session as any)?.organizationId;
    if (!organizationId) {
      return { success: false, error: 'Organization not found' };
    }

    // Get domain from admin DB
    const domainResult = await adminDb.domains
      .where({ id: data.domainId, organizationId, deleted_at: { isNullish: true } })
      .first();

    if (!domainResult.success || !domainResult.data) {
      return { success: false, error: 'Domain not found' };
    }

    const domain = domainResult.data;

    // Parse cloudflareVerification JSON if present
    let httpValidation: { http_url?: string; http_body?: string } | undefined;
    if (domain.cloudflareVerification) {
      try {
        const parsed = typeof domain.cloudflareVerification === 'string' 
          ? JSON.parse(domain.cloudflareVerification)
          : domain.cloudflareVerification;
        
        // Check for HTTP validation (ownership_verification_http)
        if (parsed.ownership_verification_http) {
          httpValidation = parsed.ownership_verification_http;
        }
      } catch (e) {
        console.error('Failed to parse cloudflareVerification:', e);
      }
    }

    // Get the linked site to fetch its subdomain for CNAME target
    let cnameTarget = env.SITE_RENDERER_ORIGIN_HOST || 'Not configured';
    if (domain.siteId) {
      const siteResult = await orgDb.sites
        .where({ id: domain.siteId, deleted_at: { isNullish: true } })
        .first();
      
      if (siteResult.success && siteResult.data?.subdomain) {
        cnameTarget = `${siteResult.data.subdomain}.kuratchi.site`;
      }
    }

    return {
      success: true,
      instructions: {
        httpValidation,
        cname: {
          name: domain.name,
          target: cnameTarget,
          description: 'Point your domain to this CNAME target. Cloudflare will automatically verify ownership via HTTP.'
        }
      },
      hostnameStatus: domain.cloudflareHostnameStatus || 'pending'
    };
  } catch (err) {
    console.error('[siteCustomDomains.getDomainLinkInstructions] error:', err);
    return { success: false, error: 'Failed to fetch instructions: ' + (err as Error).message };
  }
});

export const linkDomainToSite = guardedCommand(linkDomainSchema, async (data) => {
  try {
    const { event } = ensureSession();
    const orgDb = await getDatabase(event.locals);
    const adminDb = await getAdminDatabase(event.locals);
    
    if (!orgDb || !adminDb) {
      return { success: false, error: 'Database not available' };
    }

    const organizationId = (event.locals.session as any)?.organizationId;
    if (!organizationId) {
      return { success: false, error: 'Organization not found' };
    }

    // Get domain from admin DB
    const domainResult = await adminDb.domains
      .where({ id: data.domainId, organizationId, deleted_at: { isNullish: true } })
      .first();

    if (!domainResult.success || !domainResult.data) {
      return { success: false, error: 'Domain not found' };
    }

    const domain = domainResult.data;

    // Check if domain is already linked to a site
    if (domain.siteId) {
      return { success: false, error: 'Domain is already linked to a site' };
    }

    // Check if it's an apex domain (no subdomain)
    const domainParts = domain.name.split('.');
    if (domainParts.length === 2) {
      return { 
        success: false, 
        error: 'Apex domains are not supported. Please use a subdomain like www.' + domain.name + ' instead. Cloudflare SSL for SaaS requires a subdomain on non-enterprise plans.' 
      };
    }

    // Get site from org DB
    const siteResult = await orgDb.sites
      .where({ id: data.siteId, deleted_at: { isNullish: true } })
      .first();

    if (!siteResult.success || !siteResult.data) {
      return { success: false, error: 'Site not found' };
    }

    const site = siteResult.data;

    // Get database record for KV mapping
    const dbRecord = await adminDb.databases
      .where({ id: site.databaseId, deleted_at: { isNullish: true } })
      .first();

    if (!dbRecord.success || !dbRecord.data) {
      return { success: false, error: 'Site database not found' };
    }

    // Create custom hostname in Cloudflare
    const zoneId = env.CF_SSL_FOR_SAAS_ZONE_ID;
    const originHost = env.SITE_RENDERER_ORIGIN_HOST;

    if (!zoneId || !originHost) {
      return { success: false, error: 'Cloudflare SSL for SaaS not configured' };
    }

    const hostnameResult = await createCustomHostname({
      zoneId,
      hostname: domain.name,
      originHost,
      ssl: {
        method: 'http',
        type: 'dv'
      },
      metadata: {
        organizationId,
        siteId: data.siteId,
        domainId: data.domainId
      }
    });

    if (!hostnameResult.success || !hostnameResult.hostname) {
      return { 
        success: false, 
        error: hostnameResult.error || 'Failed to create Cloudflare custom hostname' 
      };
    }

    const cfHostname = hostnameResult.hostname;

    // Create siteCustomDomain record
    const customDomainId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Build CNAME target using site subdomain
    const cnameTarget = `${site.subdomain}.kuratchi.site`;

    const insertResult = await orgDb.siteCustomDomains.insert({
      id: customDomainId,
      siteId: data.siteId,
      domain: domain.name,
      domainId: data.domainId,
      verified: false,
      cnameTarget: cnameTarget,
      cloudflareStatus: cfHostname.status || 'pending',
      cloudflareHostnameId: cfHostname.id,
      sslStatus: cfHostname.ssl?.status || 'pending',
      created_at: now,
      updated_at: now
    });

    if (!insertResult.success) {
      return { success: false, error: 'Failed to create site custom domain record' };
    }

    // Update admin domain record with linkage
    await adminDb.domains
      .where({ id: data.domainId })
      .update({
        siteId: data.siteId,
        siteCustomDomainId: customDomainId,
        cloudflareHostnameId: cfHostname.id,
        cloudflareHostnameStatus: cfHostname.status || 'pending',
        cloudflareVerification: JSON.stringify(cfHostname.ownership_verification || {}),
        updated_at: now
      });

    // Store HTTP validation data in KV for site-renderer to access
    if (cfHostname.ownership_verification?.ownership_verification_http) {
      const httpValidation = cfHostname.ownership_verification.ownership_verification_http;
      const kvKey = `cf-validation:${domain.name}`;
      
      try {
        const kv = (event.locals.kuratchi as any)?.kv?.default;
        if (kv) {
          await kv.put(
            kvKey,
            JSON.stringify({
              http_url: httpValidation.http_url,
              http_body: httpValidation.http_body,
              hostname: domain.name,
              created_at: now
            }),
            {
              expirationTtl: 86400 // 24 hours - validation should complete well before this
            }
          );
          console.log(`[siteCustomDomains] Stored validation data in KV for ${domain.name}`);
        } else {
          console.warn('[siteCustomDomains] KV not available for storing validation data');
        }
      } catch (err) {
        console.error('[siteCustomDomains] Failed to store validation in KV:', err);
      }
    }

    // If hostname is already active, sync to KV immediately
    if (cfHostname.status === 'active') {
      await syncCustomDomainToKV(event.locals, domain.name, {
        siteId: site.id,
        orgId: organizationId,
        databaseId: site.databaseId,
        dbuuid: dbRecord.data.dbuuid,
        workerName: dbRecord.data.workerName
      });

      // Update verified status
      await orgDb.siteCustomDomains
        .where({ id: customDomainId })
        .update({ verified: true });
    }

    const verificationRecord = cfHostname.ownership_verification && typeof cfHostname.ownership_verification === 'object'
      ? (cfHostname.ownership_verification as { type?: string; name?: string; value?: string })
      : undefined;

    return { 
      success: true,
      customDomain: insertResult.results,
      cloudflareHostname: cfHostname,
      instructions: {
        verification: verificationRecord?.type && verificationRecord?.name && verificationRecord?.value
          ? {
              type: verificationRecord.type.toUpperCase(),
              name: verificationRecord.name,
              value: verificationRecord.value,
              description: 'Add this TXT record to prove ownership so Cloudflare can issue the certificate.'
            }
          : undefined,
        cname: {
          name: domain.name,
          target: cnameTarget,
          description: 'Point your domain to this CNAME target after verification completes.'
        }
      }
    };
  } catch (err) {
    console.error('[siteCustomDomains.link] error:', err);
    return { success: false, error: 'Failed to link domain: ' + (err as Error).message };
  }
});
