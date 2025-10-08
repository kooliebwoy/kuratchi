/**
 * Activity Remote Functions
 * Thin wrapper around SDK activity plugin for SvelteKit app/server context
 */

import { getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';

// Guarded query helper
const guardedQuery = <R>(fn: () => Promise<R>) => {
	return query(async () => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');
		return fn();
	});
};

/**
 * Get admin activities via SDK
 */
export const getAdminActivities = guardedQuery(async () => {
  const { locals } = getRequestEvent();
  const result = await locals.kuratchi.activity.getAdminActivity();
  return result.success ? result.data : [];
});
