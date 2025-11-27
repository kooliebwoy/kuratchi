/**
 * Activity Tracking Plugin
 * Provides dual-logging: admin + org level with admin distinction
 */

import type { AuthPlugin, PluginContext, SessionContext } from '../core/plugin.js';
import { _updateActivityTypesCache } from '../utils/activity-actions.js';

export interface ActivityLogOptions {
	action: string;
	data?: Record<string, any>;
	status?: boolean;
	userId?: string;
	ip?: string;
	userAgent?: string;
	isAdminAction?: boolean;  // UI distinction for admin actions
	isHidden?: boolean;        // If true, only logs to admin (not org)
	organizationId?: string;   // Target org for dual logging
}

export interface ActivityTypeDefinition {
	label: string;
	category?: string;
	severity?: 'info' | 'warning' | 'critical';
	description?: string;
	isAdminAction?: boolean;  // Default for this action type
	isHidden?: boolean;        // Default for this action type
}

export interface ActivityPluginOptions {
	/**
	 * Static activity type definitions (fallback/core actions)
	 */
	define?: Record<string, ActivityTypeDefinition>;
	
	/**
	 * Load activity types from database
	 */
	db?: {
		source: 'admin' | 'org';
		table: string;
		actionColumn?: string;
		labelColumn?: string;
		categoryColumn?: string;
		severityColumn?: string;
		descriptionColumn?: string;
		isAdminActionColumn?: string;
		isHiddenColumn?: string;
	};
}

export function activityPlugin(options: ActivityPluginOptions = {}): AuthPlugin {
	return {
		name: 'activity',
		priority: 35, // After session, before auth flows
		
		async onSession(ctx: SessionContext) {
			if (!ctx.locals.kuratchi) ctx.locals.kuratchi = {};
			
			// Load activity types from DB if configured
			let activityTypes: Record<string, ActivityTypeDefinition> = { ...options.define };
			
			if (options.db) {
				try {
					const db = options.db.source === 'admin' 
						? await ctx.locals.kuratchi?.getAdminDb?.()
						: await ctx.locals.kuratchi?.orgDatabaseClient?.(ctx.locals.session?.organizationId);
					
					if (db) {
						const table = db[options.db.table as keyof typeof db] as any;
						if (table) {
							const result = await table.where({ deleted_at: { is: null } }).many();
							const types = result?.data || [];
							
							types.forEach((type: any) => {
								const action = type[options.db!.actionColumn || 'action'];
								activityTypes[action] = {
									label: type[options.db!.labelColumn || 'label'],
									category: type[options.db!.categoryColumn || 'category'],
									severity: type[options.db!.severityColumn || 'severity'],
									description: type[options.db!.descriptionColumn || 'description'],
									isAdminAction: type[options.db!.isAdminActionColumn || 'isAdminAction'],
									isHidden: type[options.db!.isHiddenColumn || 'isHidden']
								};
							});
						}
					}
				} catch (err) {
					console.warn('[Activity] Failed to load activity types from DB:', err);
				}
			}
			
			// Update the ActivityAction constants cache
			const activityActionsCache: Record<string, string> = {};
			for (const [action, _] of Object.entries(activityTypes)) {
				// Convert action to constant name: 'organization.created' -> 'ORGANIZATION_CREATED'
				const constantName = action
					.toUpperCase()
					.replace(/\./g, '_')
					.replace(/-/g, '_');
				activityActionsCache[constantName] = action;
			}
			_updateActivityTypesCache(activityActionsCache);
			
			// Helper to log system errors
			const logSystemError = async (errorMessage: string, errorData: Record<string, any>) => {
				try {
					const session = ctx.locals.session;
					const now = new Date().toISOString();
					const adminDb = await ctx.locals.kuratchi?.getAdminDb?.();
					
					if (adminDb && activityTypes['system.error']) {
						await adminDb.activity.insert({
							id: crypto.randomUUID(),
							userId: session?.user?.id || null,
							action: 'system.error',
							data: JSON.stringify({ error: errorMessage, ...errorData }),
							status: false,
							isAdminAction: true,
							isHidden: true,
							organizationId: null,
							ip: ctx.event.request?.headers.get('x-forwarded-for') || ctx.event.request?.headers.get('cf-connecting-ip') || null,
							userAgent: ctx.event.request?.headers.get('user-agent') || null,
							created_at: now,
							updated_at: now,
							deleted_at: null
						});
					}
				} catch (err) {
					console.error('[Activity] Failed to log system error:', err);
				}
			};
			
			const logActivityFn = async (options: ActivityLogOptions) => {
				try {
					// Validate that the action exists in defined types
					const typeDef = activityTypes[options.action];
					
					if (!typeDef) {
						const availableActions = Object.keys(activityTypes).join(', ');
						const errorMsg = `[Activity] Unknown activity action: "${options.action}". ` +
							`This action is not defined in your activityPlugin configuration or database. ` +
							`Available actions: ${availableActions || 'none'}`;
						
						// Log the validation error as a system.error activity
						await logSystemError(errorMsg, {
							attemptedAction: options.action,
							availableActions: Object.keys(activityTypes)
						});
						
						throw new Error(errorMsg);
					}
					
					// Apply defaults from activity type definition
					const effectiveOptions = {
						...options,
						isAdminAction: options.isAdminAction ?? typeDef.isAdminAction ?? false,
						isHidden: options.isHidden ?? typeDef.isHidden ?? false
					};
					const session = ctx.locals.session;
					const now = new Date().toISOString();
					const activityId = crypto.randomUUID();
				
				const baseData = {
					id: activityId,
					userId: effectiveOptions.userId || session?.user?.id || null,
					action: effectiveOptions.action,
					data: effectiveOptions.data ? JSON.stringify(effectiveOptions.data) : null,
					status: effectiveOptions.status ?? true,
					isAdminAction: effectiveOptions.isAdminAction,
					ip: effectiveOptions.ip || ctx.event.request?.headers.get('x-forwarded-for') || ctx.event.request?.headers.get('cf-connecting-ip') || null,
					userAgent: effectiveOptions.userAgent || ctx.event.request?.headers.get('user-agent') || null,
					created_at: now,
					updated_at: now,
					deleted_at: null
				};
				
				// 1. Always log to admin
				const adminDb = await ctx.locals.kuratchi?.getAdminDb?.();
				if (adminDb) {
					await adminDb.activity.insert({
						...baseData,
						isHidden: effectiveOptions.isHidden,
						organizationId: effectiveOptions.organizationId || null
					});
				}
				
				// 2. Log to org if NOT hidden and org specified
				if (!effectiveOptions.isHidden && effectiveOptions.organizationId) {
					try {
						// Use orgDatabaseClient (the actual method name exposed by the SDK)
						const orgDb = await ctx.locals.kuratchi?.orgDatabaseClient?.(effectiveOptions.organizationId);
						if (orgDb) {
							// Org schema doesn't have 'isHidden' field
							const { isHidden, organizationId, ...orgData } = baseData as any;
							await orgDb.activity.insert(orgData);
						}
					} catch (err) {
						console.warn(`[Activity] Failed to log to org ${options.organizationId}:`, err);
					}
				}
				
				return { success: true, id: activityId };
				} catch (err) {
					// Log any errors that occur during activity logging
					const errorMessage = err instanceof Error ? err.message : String(err);
					await logSystemError(`Activity logging failed: ${errorMessage}`, {
						originalAction: options.action,
						error: errorMessage
					});
					
					// Re-throw the error
					throw err;
				}
			};
			
			ctx.locals.kuratchi.activity = {
				/**
				 * Log activity with dual-logging (admin + conditional org)
				 */
				logActivity: logActivityFn,
				
				// Alias for convenience
				log: logActivityFn,
				
				/**
				 * Log activity to admin database only (legacy)
				 */
				logAdminActivity: async (options: ActivityLogOptions) => {
					const adminDb = await ctx.locals.kuratchi?.getAdminDb?.();
					if (!adminDb) {
						console.warn('[Activity] Admin DB not configured');
						return { success: false, error: 'Admin DB not configured' };
					}
					
					const session = ctx.locals.session;
					const now = new Date().toISOString();
					
					const activityData = {
						id: crypto.randomUUID(),
						userId: options.userId || session?.user?.id || null,
						action: options.action,
						data: options.data ? JSON.stringify(options.data) : null,
						status: options.status ?? true,
						isAdminAction: options.isAdminAction ?? false,
						isHidden: options.isHidden ?? false,
						organizationId: options.organizationId || null,
						ip: options.ip || ctx.event.request?.headers.get('x-forwarded-for') || ctx.event.request?.headers.get('cf-connecting-ip') || null,
						userAgent: options.userAgent || ctx.event.request?.headers.get('user-agent') || null,
						created_at: now,
						updated_at: now,
						deleted_at: null
					};
					
					const result = await adminDb.activity.insert(activityData);
					
					return result;
				},
				
				/**
				 * Log activity to organization database only
				 */
				logOrgActivity: async (orgDbClient: any, options: ActivityLogOptions) => {
					const session = ctx.locals.session;
					const now = new Date().toISOString();
					
					const activityData = {
						id: crypto.randomUUID(),
						userId: options.userId || session?.user?.id || null,
						action: options.action,
						data: options.data ? JSON.stringify(options.data) : null,
						status: options.status ?? true,
						ip: options.ip || ctx.event.request?.headers.get('x-forwarded-for') || ctx.event.request?.headers.get('cf-connecting-ip') || null,
						userAgent: options.userAgent || ctx.event.request?.headers.get('user-agent') || null,
						created_at: now,
						updated_at: now,
						deleted_at: null
					};
					
					const result = await orgDbClient.activity.insert(activityData);
					
					return result;
				},
				
				/**
				 * Get activities from admin database
				 */
				getAdminActivity: async (options?: { limit?: number; userId?: string; action?: string }) => {
					const adminDb = await ctx.locals.kuratchi?.getAdminDb?.();
					if (!adminDb) {
						return { success: false, error: 'Admin DB not configured', data: [] };
					}
					
					let query = adminDb.activity.where({ deleted_at: { is: null } });
					
					if (options?.userId) {
						query = query.where({ userId: { eq: options.userId } });
					}
					
					if (options?.action) {
						query = query.where({ action: { eq: options.action } });
					}
					
					// Sort by most recent
					const result = await query.many();
					
					if (result.success && result.data) {
						// Sort in memory (SQLite doesn't have ORDER BY in ORM yet)
						const sorted = result.data.sort((a: any, b: any) => {
							return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
						});
						
						const limited = options?.limit ? sorted.slice(0, options.limit) : sorted;
						
						return { success: true, data: limited };
					}
					
					return result;
				},
				
				/**
				 * Get activities from organization database
				 */
				getOrgActivity: async (orgDbClient: any, options?: { limit?: number; userId?: string; action?: string }) => {
					let query = orgDbClient.activity.where({ deleted_at: { is: null } });
					
					if (options?.userId) {
						query = query.where({ userId: { eq: options.userId } });
					}
					
					if (options?.action) {
						query = query.where({ action: { eq: options.action } });
					}
					
					const result = await query.many();
					
					if (result.success && result.data) {
						const sorted = result.data.sort((a: any, b: any) => {
							return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
						});
						
						const limited = options?.limit ? sorted.slice(0, options.limit) : sorted;
						
						return { success: true, data: limited };
					}
					
					return result;
				}
			};
		}
	};
}
