/**
 * Activity Types - Auto-loaded from Database
 * 
 * This file provides typed constants for all activity actions.
 * Usage: ActivityAction.ORG_CREATED instead of 'organization.created'
 */

import { database } from 'kuratchi-sdk';

// Cache for activity types
let activityTypesCache: Record<string, string> | null = null;

/**
 * Load activity types from database and create typed constants
 */
async function loadActivityTypes() {
	if (activityTypesCache) {
		return activityTypesCache;
	}

	try {
		const { orm: adminOrm } = await database.admin();
		const result = await adminOrm.activityTypes
			.where({ deleted_at: { is: null } })
			.many();

		if (result.success && result.data) {
			const types: Record<string, string> = {};
			
			for (const type of result.data) {
				// Convert action to constant name: 'organization.created' -> 'ORG_CREATED'
				const constantName = type.action
					.toUpperCase()
					.replace(/\./g, '_')
					.replace(/-/g, '_');
				
				types[constantName] = type.action;
			}
			
			activityTypesCache = types;
			return types;
		}
	} catch (err) {
		console.warn('[ActivityTypes] Failed to load from database:', err);
	}

	// Fallback to empty object
	return {};
}

/**
 * Activity Action Constants
 * Provides autocomplete for activity actions
 */
export const ActivityAction = new Proxy({} as Record<string, string>, {
	get(target, prop: string) {
		// Return cached value if available
		if (activityTypesCache && prop in activityTypesCache) {
			return activityTypesCache[prop];
		}
		
		// If not cached, return the prop as-is (will be validated by SDK)
		// This allows the code to work even before types are loaded
		return prop.toLowerCase().replace(/_/g, '.');
	}
});

/**
 * Initialize activity types (call this on server startup)
 */
export async function initActivityTypes() {
	await loadActivityTypes();
}

/**
 * Get all available activity actions
 */
export function getActivityActions(): string[] {
	return activityTypesCache ? Object.values(activityTypesCache) : [];
}

/**
 * Check if an action is valid
 */
export function isValidAction(action: string): boolean {
	return activityTypesCache ? Object.values(activityTypesCache).includes(action) : false;
}
