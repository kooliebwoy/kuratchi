import { getRequestEvent, query } from '$app/server';
import { env } from '$env/dynamic/private';
import { r2 } from 'kuratchi-sdk';
import { getDatabase, getAdminDatabase } from '$lib/server/db-context';

/**
 * List all R2 buckets from Cloudflare
 */
export const listCloudflareR2Buckets = query('unchecked', async () => {
	const apiToken = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN || env.KURATCHI_CF_API_TOKEN;
	const accountId = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || env.KURATCHI_CF_ACCOUNT_ID;

	if (!apiToken || !accountId) {
		return {
			success: false,
			error: 'Cloudflare credentials not configured',
			buckets: []
		};
	}

	try {
		const { getCloudflareClient } = await import('kuratchi-sdk/domains');
		const client = getCloudflareClient();
		const result = await client.listR2Buckets();
		
		console.log('[listCloudflareR2Buckets] Raw result:', JSON.stringify(result, null, 2));
		console.log('[listCloudflareR2Buckets] result.result type:', Array.isArray(result?.result) ? 'array' : typeof result?.result);
		console.log('[listCloudflareR2Buckets] result.result length:', result?.result?.length);

		return {
			success: true,
			buckets: result?.result || []
		};
	} catch (error: any) {
		console.error('[listCloudflareR2Buckets] Error:', error);
		return {
			success: false,
			error: error.message,
			buckets: []
		};
	}
});

/**
 * Get all R2 buckets for this organization from our database
 * No need to call Cloudflare API - we track everything in our DB
 */
export const getAllBuckets = query('unchecked', async () => {
	const { locals } = getRequestEvent();
	const session = locals.session;
	const activeOrgId = session?.organizationId;

	if (!activeOrgId) {
		return {
			success: false,
			error: 'Organization not found',
			buckets: [],
			orgBuckets: [],
			siteBuckets: [],
			stats: { total: 0, managed: 0, unmanaged: 0, orgLevel: 0, siteLevel: 0 }
		};
	}

	try {
		// Get organization database for sites
		const orgDb = await getDatabase(locals);
		
		// Get all sites with R2 buckets for this org
		const siteRecords = await orgDb.sites
			.where({ deleted_at: { isNullish: true } })
			.select();
		
		console.log('[getAllBuckets] Found sites:', siteRecords);

		// Build bucket list from sites
		const buckets = [];
		
		for (const site of siteRecords.data || []) {
			if (site.r2BucketName) {
				buckets.push({
					name: site.r2BucketName,
					binding: site.r2Binding || 'STORAGE',
					type: 'site',
					metadata: {
						type: 'site',
						name: site.name,
						subdomain: site.subdomain,
						id: site.id,
						status: site.status,
						databaseId: site.databaseId
					},
					isManaged: true,
					organizationId: activeOrgId
				});
			}
		}

		// Separate by type (all are site-level for now)
		const siteBuckets = buckets.filter((b: any) => b.metadata?.type === 'site');
		const orgBuckets: any[] = []; // No org-level buckets yet

		return {
			success: true,
			buckets,
			orgBuckets,
			siteBuckets,
			stats: {
				total: buckets.length,
				managed: buckets.length,
				unmanaged: 0,
				orgLevel: orgBuckets.length,
				siteLevel: siteBuckets.length
			}
		};
	} catch (error: any) {
		console.error('[getAllBuckets] Error:', error);
		return {
			success: false,
			error: error.message,
			buckets: [],
			orgBuckets: [],
			siteBuckets: [],
			stats: { total: 0, managed: 0, unmanaged: 0, orgLevel: 0, siteLevel: 0 }
		};
	}
});
