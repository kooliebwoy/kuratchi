/**
 * Activity Tracking Plugin
 * Provides dual-logging: admin + org level with admin distinction
 */

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

export function activityPlugin() {
	return {
		name: 'activity',
		
		install(ctx: any) {
			const logActivityFn = async (options: ActivityLogOptions) => {
				const session = ctx.locals.session;
				const now = new Date().toISOString();
				const activityId = crypto.randomUUID();
				
				const baseData = {
					id: activityId,
					userId: options.userId || session?.user?.id || null,
					action: options.action,
					data: options.data ? JSON.stringify(options.data) : null,
					status: options.status ?? true,
					isAdminAction: options.isAdminAction ?? false,
					ip: options.ip || ctx.request?.headers.get('x-forwarded-for') || ctx.request?.headers.get('cf-connecting-ip') || null,
					userAgent: options.userAgent || ctx.request?.headers.get('user-agent') || null,
					created_at: now,
					updated_at: now,
					deleted_at: null
				};
				
				// 1. Always log to admin
				const adminDb = await ctx.locals.kuratchi.getAdminDb();
				if (adminDb) {
					await adminDb.activity.insert({
						...baseData,
						isHidden: options.isHidden ?? false,
						organizationId: options.organizationId || null
					});
				}
				
				// 2. Log to org if NOT hidden and org specified
				if (!options.isHidden && options.organizationId) {
					try {
						const orgDb = await ctx.locals.kuratchi.getOrgDb(options.organizationId);
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
			};
			
			return {
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
					const adminDb = await ctx.locals.kuratchi.getAdminDb();
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
						ip: options.ip || ctx.request?.headers.get('x-forwarded-for') || ctx.request?.headers.get('cf-connecting-ip') || null,
						userAgent: options.userAgent || ctx.request?.headers.get('user-agent') || null,
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
						ip: options.ip || ctx.request?.headers.get('x-forwarded-for') || ctx.request?.headers.get('cf-connecting-ip') || null,
						userAgent: options.userAgent || ctx.request?.headers.get('user-agent') || null,
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
					const adminDb = await ctx.locals.kuratchi.getAdminDb();
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
