/**
 * Activity Action Constants
 * 
 * Provides typed constants for activity actions loaded from the database.
 * This is populated by the activityPlugin during initialization.
 */

// Cache for activity types
let activityTypesCache: Record<string, string> = {};

/**
 * Activity Action Constants
 * Provides autocomplete for activity actions
 * 
 * Usage: ActivityAction.ORGANIZATION_CREATED
 */
export const ActivityAction = new Proxy({} as Record<string, string>, {
	get(target, prop: string) {
		// Return cached value if available
		if (prop in activityTypesCache) {
			return activityTypesCache[prop];
		}
		
		// If not cached, convert constant name to action string
		// ORGANIZATION_CREATED -> organization.created
		return prop.toLowerCase().replace(/_/g, '.');
	}
});

/**
 * Internal: Update the activity types cache
 * Called by activityPlugin during initialization
 */
export function _updateActivityTypesCache(types: Record<string, string>) {
	activityTypesCache = types;
}

/**
 * Get all available activity actions
 */
export function getActivityActions(): string[] {
	return Object.values(activityTypesCache);
}

/**
 * Check if an action is valid
 */
export function isValidAction(action: string): boolean {
	return Object.values(activityTypesCache).includes(action);
}
