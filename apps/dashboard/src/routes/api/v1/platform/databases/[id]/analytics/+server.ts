import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApiRequest } from '$lib/server/api-auth';
import { database } from 'kuratchi-sdk';
import { env } from '$env/dynamic/private';

/**
 * GET /api/v1/platform/databases/:id/analytics
 * Get analytics for a specific database from Cloudflare
 * 
 * Query Parameters:
 * - days: Number of days to fetch (default: 7, max: 30)
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "readQueries": 1234,
 *     "writeQueries": 567,
 *     "rowsRead": 45678,
 *     "rowsWritten": 12345,
 *     "period": {
 *       "start": "2024-01-01",
 *       "end": "2024-01-07",
 *       "days": 7
 *     }
 *   }
 * }
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		const auth = await authenticateApiRequest(event);
		
		const { id } = event.params;
		
		if (!id) {
			return json(
				{ success: false, error: 'Database ID is required' },
				{ status: 400 }
			);
		}
		
		// Get query parameters
		const url = new URL(event.request.url);
		const daysParam = url.searchParams.get('days');
		const days = Math.min(Math.max(parseInt(daysParam || '7'), 1), 30);
		
		// Get account ID and API token from environment
		const accountId = env.CLOUDFLARE_ACCOUNT_ID;
		const apiToken = env.CLOUDFLARE_API_TOKEN;
		
		if (!accountId || !apiToken) {
			return json(
				{ 
					success: false, 
					error: 'Cloudflare credentials not configured',
					data: { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0 }
				},
				{ status: 503 }
			);
		}
		
		// Fetch the database record to get the D1 UUID (dbuuid)
		const { orm: adminOrm } = await database.admin();
		const dbRecord = await adminOrm.databases
			.where({ id: { eq: id } })
			.first();
		
		if (!dbRecord?.data?.dbuuid) {
			return json(
				{ success: false, error: 'Database not found or missing D1 UUID' },
				{ status: 404 }
			);
		}
		
		const d1DatabaseId = dbRecord.data.dbuuid;
		
		// Calculate date range
		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);
		
		const start = startDate.toISOString().split('T')[0];
		const end = endDate.toISOString().split('T')[0];
		
		// Query Cloudflare GraphQL API
		const query = `
			query {
				viewer {
					accounts(filter: { accountTag: "${accountId}" }) {
						d1AnalyticsAdaptiveGroups(
							limit: 10000
							filter: {
								date_geq: "${start}"
								date_leq: "${end}"
								databaseId: "${d1DatabaseId}"
							}
							orderBy: [date_DESC]
						) {
							sum {
								readQueries
								writeQueries
								rowsRead
								rowsWritten
							}
							dimensions {
								date
								databaseId
							}
						}
					}
				}
			}
		`;
		
		const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ query })
		});
		
		if (!response.ok) {
			const errorText = await response.text();
			console.error('[Platform API] GraphQL request failed:', response.status, errorText);
			return json(
				{ 
					success: false, 
					error: 'Failed to fetch analytics from Cloudflare',
					data: { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0 }
				},
				{ status: 502 }
			);
		}
		
		const data = await response.json();
		
		if (data.errors) {
			console.error('[Platform API] GraphQL errors:', data.errors);
			return json(
				{ 
					success: false, 
					error: 'GraphQL query failed',
					details: data.errors,
					data: { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0 }
				},
				{ status: 502 }
			);
		}
		
		const groups = data?.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups || [];
		
		// Sum up all metrics across all groups
		let totalReadQueries = 0;
		let totalWriteQueries = 0;
		let totalRowsRead = 0;
		let totalRowsWritten = 0;
		
		for (const group of groups) {
			totalReadQueries += group.sum?.readQueries || 0;
			totalWriteQueries += group.sum?.writeQueries || 0;
			totalRowsRead += group.sum?.rowsRead || 0;
			totalRowsWritten += group.sum?.rowsWritten || 0;
		}
		
		return json({
			success: true,
			data: {
				readQueries: totalReadQueries,
				writeQueries: totalWriteQueries,
				rowsRead: totalRowsRead,
				rowsWritten: totalRowsWritten,
				period: {
					start,
					end,
					days
				}
			}
		});
	} catch (err: any) {
		console.error('[Platform API] Error fetching analytics:', err);
		return json(
			{ 
				success: false, 
				error: err.message || 'Failed to fetch analytics',
				data: { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0 }
			},
			{ status: err.status || 500 }
		);
	}
};
