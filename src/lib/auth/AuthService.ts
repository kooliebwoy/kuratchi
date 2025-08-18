import { eq, desc, asc, like, count, and, or } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { comparePassword, hashPassword, generateSessionToken, hashToken, buildSessionCookie, parseSessionCookie } from "./utils.js";
import { ResendService } from "./ResendService.js";
import type { D1Database } from "@cloudflare/workers-types";

// Session data built from DB on demand
export interface SessionData {
    userId: string;
    organizationId: string;
    email: string;
    roles: string[];
    isEmailVerified: boolean;
    user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        name: string | null;
        role: string | null;
        organizationSlug: string | null;
        organizationId: string | null;
    };
    createdAt: Date;
    lastAccessedAt: Date;
    ipAddress?: string;
    userAgent?: string;
}

// Session validation result
export interface SessionValidationResult {
    sessionData: SessionData | null;
    user: any | null;
}

interface Env {
    ADMIN_DB: D1Database;
    RESEND_API_KEY: string;
    EMAIL_FROM: string;
    ORIGIN: string;
    RESEND_CLUTCHCMS_AUDIENCE: string;
    KURATCHI_AUTH_SECRET: string;
}

export class AuthService {
    private db: DrizzleD1Database<any>;
    private env: Env; // Store env for ResendService creation
    private resendService: ResendService;
    private schema: any;
    
    /**
     * Creates an instance of AuthService that works with either D1 or Durable Object databases
     * @param db - An instance of a Drizzle database (either D1 or Durable Object SQLite)
     * @param env - Environment variables
     * @param schema - Database schema (clientSchema for SQLite DO, adminSchema for D1)
     */
    constructor(
        db: DrizzleD1Database<any>,
        env: Env,
        schema: any
    ) {
        this.db = db;
        this.env = env;
        this.resendService = new ResendService(env); // Initialize ResendService for all email operations
        this.schema = schema;
    }

    /**
     * Create a new user
     * @param userData - User data to insert
     * @param sendVerificationEmail - Whether to send a verification email (default: true)
     * @returns Object containing the created user and verification token
     */
    async createUser(userData: any, sendVerificationEmail: boolean = true) {
        // Generate a UUID for the new user
        const userId = crypto.randomUUID();
        
        // Hash password if plain provided and password_hash missing
        let toInsert = { ...userData } as any;
        if (!toInsert.password_hash && toInsert.password) {
            const pepper = this.env.KURATCHI_AUTH_SECRET; // reuse local secret as pepper
            toInsert.password_hash = await hashPassword(toInsert.password, undefined, pepper);
            delete toInsert.password; // never persist plain password
        }

        // Create user with emailVerified set to null (unverified)
        const user = await this.db.insert(this.schema.Users).values({ 
            ...toInsert, 
            id: userId,
            emailVerified: null // Explicitly set email to unverified
        }).returning().get();
        
        // Generate an email verification token
        // const verificationToken = await this.createEmailVerificationToken(userId, userData.email);
        
        // Here you would send the verification email with the token
        // This would typically be handled by an email service
        // if (sendVerificationEmail) {
        //     // Example email sending logic (placeholder):
        //     // await this.emailService.sendVerificationEmail(userData.email, verificationToken.token);
        //     console.log(`Verification token for ${userData.email}: ${verificationToken.token}`);
        // }
        
        return user;
    }

    /**
     * Get all users with their associated sites
     * @returns Array of users with sites
     */
    async getUsers(): Promise<any[]> {
        return this.db.select().from(this.schema.Users).all();
    }

    /**
     * Get a specific user by ID with their associated sites
     * @param id - User ID
     * @returns User with sites or undefined
     */
    async getUser(id: string): Promise<any | undefined> {
        return this.db.select().from(this.schema.Users).where(eq(this.schema.Users.id, id)).get();
    }

    /**
     * Update a user by ID
     * @param id - User ID
     * @param userData - Partial user data to update
     * @returns Updated user
     */
    async updateUser(id: string, userData: Partial<any>): Promise<any | undefined> {
        return this.db.update(this.schema.Users).set({ ...userData, updated_at: Date.now().toString() }).where(eq(this.schema.Users.id, id)).returning().get();
    }

    /**
     * Delete a user by ID
     * @param id - User ID
     * @returns Deleted user
     */
    async deleteUser(id: string): Promise<any | undefined> {
        const user = await this.getUser(id);

        if (!user) {
            return null;
        }

        // invalidate all sessions for this user
        await this.invalidateAllSessions(id);

        return this.db.delete(this.schema.Users).where(eq(this.schema.Users.id, id)).returning().get();
    }

    /**
     * Delete all users
     * @returns Array of deleted users
     */
    async deleteUsers(): Promise<any[]> {
        return this.db.delete(this.schema.Users).returning().all();
    }

    /**
     * Get a user by email address
     * @param email - User email
     * @returns User or undefined
     */
    async getUserByEmail(email: string): Promise<any | undefined> {
        return this.db.select().from(this.schema.Users).where(eq(this.schema.Users.email, email)).get();
    }

    // Role Methods
    /**
     * Create a new role
     * @param roleData - Role data to insert (must include name and description)
     * @returns The created role
     */
    async createRole(roleData: any): Promise<any | undefined> {
        return this.db.insert(this.schema.Roles).values({ 
            ...roleData, 
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }).returning().get();
    }

    /**
     * Get all roles
     * @returns Array of roles
     */
    async getRoles(): Promise<any[]> {
        return this.db.select().from(this.schema.Roles).all();
    }

    /**
     * Get a specific role by ID
     * @param id - Role ID
     * @returns Role or undefined
     */
    async getRole(id: string): Promise<any | undefined> {
        const result = await this.db.select().from(this.schema.Roles).where(eq(this.schema.Roles.id, id)).get();
        return result;
    }

    /**
     * Update a role by ID
     * @param id - Role ID
     * @param roleData - Partial role data to update
     * @returns Updated role
     */
    async updateRole(id: string, roleData: Partial<any>): Promise<any | undefined> {
        return this.db.update(this.schema.Roles).set({ ...roleData, updated_at: Date.now().toString() }).where(eq(this.schema.Roles.id, id)).returning().get();
    }

    /**
     * Delete a role by ID
     * @param id - Role ID
     * @returns Deleted role
     */
    async deleteRole(id: string): Promise<any | undefined> {
        return this.db.delete(this.schema.Roles).where(eq(this.schema.Roles.id, id)).returning().get();
    }

    // Activity Methods
    /**
     * Create a new activity
     * @param activity - Activity data to insert
     * @returns The created activity
     */
    async createActivity(activity: any): Promise<any | undefined> {
        return this.db.insert(this.schema.Activity).values({ 
            ...activity, 
            id: crypto.randomUUID(), 
            created_at: new Date().toISOString(), 
            updated_at: new Date().toISOString() 
        }).returning().get();
    }

    /**
     * Get all activities with user information
     * @returns Array of activities with user data
     */
    async getAllActivity(): Promise<any[]> {
        return await this.db.select()
            .from(this.schema.Activity)
            .orderBy(desc(this.schema.Activity.created_at))
            .all();
    }

    /**
     * Get activities for a specific site
     * @param siteId - Site ID
     * @returns Array of activities for the site
     */
    async getSiteActivity(siteId: string): Promise<any[]> {
        return this.db.select().from(this.schema.Activity).where(eq(this.schema.Activity.siteId, siteId)).all();
    }

    /**
     * Get paginated activities with search and filter options
     * @param limit - Number of items per page
     * @param page - Page number
     * @param search - Search term for activity action
     * @param filter - Filter criteria
     * @param order - Sort order (asc or desc)
     * @returns Paginated activity data with total count
     */
    async getPaginatedActivity(limit = 10, page = 1, search = '', filter = '', order: 'asc' | 'desc' = 'desc'): Promise<{ data: any[], total: number }> {
        // Build optional where clause
        let whereOptions: any = undefined;
        if (search && search.trim() !== '') {
            whereOptions = like(this.schema.Activity.action, `%${search}%`);
        }

        // Total count
        const [total] = await (this.db as any)
            .select({ count: count() })
            .from(this.schema.Activity)
            .where(whereOptions as any);

        // Data page
        const activity = await (this.db as any).query.Activity.findMany({
            where: whereOptions as any,
            with: {
                User: {
                    columns: {
                        password_hash: false,
                    }
                },
                Site: {
                    columns: {
                        id: true,
                        name: true,
                        projectName: true,
                        domain: true
                    }
                }
            },
            limit: limit,
            offset: (page - 1) * limit,
            orderBy: order === 'asc' ? asc(this.schema.Activity.created_at) : desc(this.schema.Activity.created_at)
        });

        return {
            data: activity,
            total: total?.count ?? 0
        };
    }

    /**
     * Create a new session in KV storage
     * @param userId - User ID
     * @param ipAddress - Optional IP address
     * @param userAgent - Optional user agent
     * @returns The session ID
     */
    async createSession(
        userId: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<string> {
        // Use the unified upsertSession method for consistency
        return await this.upsertSession({
            userId,
            ipAddress,
            userAgent
        });
    }

    /**
     * Authenticate user with email and password
     * @param email - User email
     * @param password - User password
     * @returns User if authentication successful, null otherwise
     */
    async authenticateUser(email: string, password: string): Promise<any | null> {
        console.log('[AuthService.authenticateUser] Authenticating user:', email);
        const user = await this.getUserByEmail(email);

        console.log('[AuthService.authenticateUser] User found:', user);
        
        if (!user || !user.password_hash) {
            return null;
        }

        const pepper = this.env.KURATCHI_AUTH_SECRET; // use local key as pepper
        const isValidPassword = await comparePassword(password, user.password_hash, pepper);

        console.log('[AuthService.authenticateUser] Password is valid:', isValidPassword);
        
        if (!isValidPassword) {
            return null;
        }
        
        return user;
    }

    /**
     * Create a complete authentication session (user + session)
     * @param email - User email
     * @param password - User password
     * @param ipAddress - Optional IP address
     * @param userAgent - Optional user agent
     * @returns Authentication result with session data or null
     */
    async createAuthSession(
        email: string, 
        password: string, 
        ipAddress?: string, 
        userAgent?: string
    ): Promise<{
        user: any;
        sessionId: string;
        sessionData: SessionData;
    } | null> {
        
        const user = await this.authenticateUser(email, password);

        if (!user) {
            return null;
        }
        
        // Create session using the unified upsertSession method
        const sessionId = await this.upsertSession({
            userId: user.id,
            ipAddress,
            userAgent
        });

        // Build the session data for return
        const sessionData = await this.buildSessionData(user.id, ipAddress, userAgent);
        
        return {
            user,
            sessionId,
            sessionData: sessionData!
        };
    }

    /**
     * Invalidate (delete) a specific session
     * @param sessionId - ID of the session to invalidate
     */
    async invalidateSession(sessionCookie: string): Promise<void> {
        const parsed = await parseSessionCookie(this.env.KURATCHI_AUTH_SECRET, sessionCookie);
        if (!parsed) return;
        const { tokenHash } = parsed;
        await this.db
            .delete(this.schema.Sessions)
            .where(eq(this.schema.Sessions.sessionToken, tokenHash))
            .returning()
            .all();
    }

    /**
     * Get all session IDs for a user efficiently using the session index
     * @param userId - User ID
     * @returns Array of session IDs
     */
    private async getUserSessionIds(userId: string): Promise<string[]> {
        const rows = await this.db.select()
            .from(this.schema.Sessions)
            .where(eq(this.schema.Sessions.userId, userId))
            .all();
        // NOTE: sessionToken now stores the hash; returning hashes here is not useful to callers.
        // This method remains for compatibility but should not be used for plaintext operations.
        return rows.map((r: any) => r.sessionToken);
    }

    /**
     * Unified session creation/refresh method - the single source of truth
     * @param sessionId - Optional existing session ID (for refresh), generates new if not provided
     * @param userId - User ID
     * @param user - Optional pre-fetched user data (for efficiency)
     * @param preserveMetadata - Whether to preserve existing session metadata (for refresh)
     * @param ipAddress - Optional IP address
     * @param userAgent - Optional user agent
     * @returns Session ID
     */
    async upsertSession(options: {
        sessionId?: string | null;
        userId?: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<string> {
        const { sessionId } = options;
        let { userId } = options;

        const now = new Date();
        const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

        if (sessionId) {
            // sessionId is the opaque cookie; decrypt to get tokenHash
            const parsed = await parseSessionCookie(this.env.KURATCHI_AUTH_SECRET, sessionId);
            if (!parsed) throw new Error('Invalid session cookie');
            const { tokenHash } = parsed;
            const row = await this.db
                .select()
                .from(this.schema.Sessions)
                .where(eq(this.schema.Sessions.sessionToken, tokenHash))
                .get();
            if (!row) throw new Error('Session to refresh not found');
            userId = row.userId;

            await this.db.update(this.schema.Sessions)
                .set({ expires, updated_at: now.toISOString() })
                .where(eq(this.schema.Sessions.sessionToken, tokenHash))
                .returning()
                .get();
            return sessionId; // opaque cookie remains the same
        }

        if (!userId) throw new Error('User ID is required to create or refresh a session');

        // Ensure user exists
        const userData = await this.getUser(userId);
        if (!userData) throw new Error('User not found when creating/refreshing session');

        // Encode organizationId (or 'admin' for admin sessions) into the session token prefix (no legacy fallbacks)
        const organizationId = (userData as any).organizationId ?? 'admin';
        const prefix = String(organizationId);
        const finalSessionId = `${prefix}.${generateSessionToken()}`;
        const sessionTokenHash = await hashToken(finalSessionId);
        await this.db.insert(this.schema.Sessions).values({
            sessionToken: sessionTokenHash,
            userId,
            expires,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
            deleted_at: null,
        }).returning().get();
        // Build opaque cookie: encrypt { organizationId: prefix|admin, tokenHash }
        const cookie = await buildSessionCookie(this.env.KURATCHI_AUTH_SECRET, prefix as any, sessionTokenHash);
        return cookie;
    }

    /**
     * @param sessionId - Session ID to refresh
     * @returns Success status
     */
    async refreshSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
        try {
            await this.upsertSession({ sessionId });

            return { success: true };
        } catch (error) {
            console.error('Session refresh error:', error);
            return { success: false, error: 'Failed to refresh session' };
        }
    }

    /**
     * Refresh all sessions for a user with fresh database data
     * @param userId - User ID
     * @returns Number of sessions refreshed
     */
    async refreshUserSessions(userId: string): Promise<{ success: boolean; refreshedCount: number; error?: string }> {
        try {
            // Get fresh user data
            const freshUser = await this.getUser(userId);
            if (!freshUser) {
                // User was deleted, invalidate all sessions
                await this.invalidateAllSessions(userId);
                return { success: true, refreshedCount: 0 };
            }

            // Count existing sessions for the user
            const sessions = await this.db
                .select()
                .from(this.schema.Sessions)
                .where(eq(this.schema.Sessions.userId, userId))
                .all();

            if (!Array.isArray(sessions) || sessions.length === 0) {
                return { success: true, refreshedCount: 0 };
            }

            // Extend TTL for all sessions belonging to this user
            const now = new Date();
            const newExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            await this.db
                .update(this.schema.Sessions)
                .set({ expires: newExpires, updated_at: now.toISOString() })
                .where(eq(this.schema.Sessions.userId, userId))
                .returning()
                .all();

            return { success: true, refreshedCount: sessions.length };
        } catch (error) {
            return { success: false, refreshedCount: 0, error: 'Failed to refresh user sessions' };
        }
    }

    /**
     * Invalidate (delete) all sessions for a specific user efficiently using session index
     * @param userId - ID of the user whose sessions should be invalidated
     */
    async invalidateAllSessions(userId: string): Promise<void> {
        await this.db
            .delete(this.schema.Sessions)
            .where(eq(this.schema.Sessions.userId, userId))
            .returning()
            .all();
    }

    /**
     * Validate a session token
     * @param sessionId - The session ID to validate
     * @returns Session validation result with session data and user
     */
    async validateSessionToken(sessionCookie: string): Promise<SessionValidationResult> {
        // Decrypt cookie, extract tokenHash
        const parsed = await parseSessionCookie(this.env.KURATCHI_AUTH_SECRET, sessionCookie);
        if (!parsed) return { sessionData: null, user: null };
        const { tokenHash } = parsed;
        const sessionRow = await this.db
            .select()
            .from(this.schema.Sessions)
            .where(eq(this.schema.Sessions.sessionToken, tokenHash))
            .get();
        if (!sessionRow) return { sessionData: null, user: null };

        const now = new Date();
        const expired = sessionRow.expires && new Date(sessionRow.expires).getTime() <= now.getTime();
        if (expired) {
            await this.invalidateSession(sessionCookie);
            return { sessionData: null, user: null };
        }

        // Load user from DB
        const user = await this.getUser(sessionRow.userId);
        if (!user) {
            // In DB-backed, safe to invalidate if the user no longer exists
            await this.invalidateSession(sessionCookie);
            return { sessionData: null, user: null };
        }

        // Extend TTL on access
        const newExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await this.db
            .update(this.schema.Sessions)
            .set({ expires: newExpires, updated_at: now.toISOString() })
            .where(eq(this.schema.Sessions.sessionToken, tokenHash))
            .returning()
            .get();

        // Build SessionData on the fly
        const sessionData = await this.buildSessionData(user.id);
        sessionData.lastAccessedAt = now;
        return { sessionData, user };
    }

    private async buildSessionData(userId: string, ipAddress?: string, userAgent?: string): Promise<SessionData> {
        const userData = await this.getUser(userId);
        if (!userData) throw new Error('User not found for session data');
        const roles = userData.role ? [userData.role] : [];
        const now = new Date();
        return {
            userId: userData.id,
            organizationId: (userData as any).organizationId || '',
            email: userData.email,
            roles,
            isEmailVerified: userData.emailVerified ? true : false,
            user: {
                id: userData.id,
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                name: userData.name,
                role: userData.role,
                organizationSlug: (userData as any).organizationSlug ?? null,
                organizationId: (userData as any).organizationId ?? null
            },
            createdAt: now,
            lastAccessedAt: now,
            ipAddress,
            userAgent
        };
    }

    async createPasswordResetToken(email: string) {
        const now = new Date();
        const expiryDate = new Date(now);
        // Set expiry to 24 hours from now
        expiryDate.setHours(expiryDate.getHours() + 24);
        
        return await this.db.insert(this.schema.PasswordResetTokens).values({
            id: crypto.randomUUID(), // Add required id field
            email,
            token: crypto.randomUUID(),
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
            deleted_at: null,
            expires: expiryDate
        }).returning().get();
    }

    async deletePasswordResetToken(token: string) {
        const result = await this.db
            .delete(this.schema.PasswordResetTokens)
            .where(eq(this.schema.PasswordResetTokens.token, token))
            .returning()
            .all();
        return result.length > 0;
    }

    async getPasswordResetToken(token: string) {
        return await this.db.select().from(this.schema.PasswordResetTokens).where(eq(this.schema.PasswordResetTokens.token, token)).all();
    }

    /**
     * Create an email verification token for a user
     * @param userId - User ID
     * @param email - User email
     * @returns The created email verification token
     */
    async createEmailVerificationToken(userId: string, email: string) {
        const now = new Date();
        const expiryDate = new Date(now);
        // Set expiry to 15 minutes from now
        expiryDate.setMinutes(expiryDate.getMinutes() + 15);

        // Generate a 6-digit verification token
        const token = Math.floor(100000 + Math.random() * 900000).toString();

        const inserted = await this.db
            .insert(this.schema.EmailVerificationTokens)
            .values({
                id: crypto.randomUUID(),
                userId,
                email,
                token,
                expires: expiryDate,
                created_at: now.toISOString(),
                updated_at: now.toISOString(),
                deleted_at: null,
            })
            .returning()
            .get();

        return inserted;
    }

    /**
     * Delete an email verification token by email
     * @param email - Email to delete token for
     * @returns Whether the token was successfully deleted
     */
    async deleteEmailVerificationTokenByEmail(email: string) {
        await this.db
            .delete(this.schema.EmailVerificationTokens)
            .where(eq(this.schema.EmailVerificationTokens.email, email))
            .returning()
            .all();
        return true;
    }

    /**
     * Get an email verification token by email
     * @param email - Email to get token for
     * @returns The email verification token
     */
    async getEmailVerificationTokenByEmail(email: string) {
        // Return the most recent token for this email
        const tokens = await this.db
            .select()
            .from(this.schema.EmailVerificationTokens)
            .where(eq(this.schema.EmailVerificationTokens.email, email))
            .all();
        if (!Array.isArray(tokens) || tokens.length === 0) return null as any;
        // Choose the latest by expires
        const latest = tokens.sort((a: any, b: any) => {
            const ax = a.expires instanceof Date ? a.expires.getTime() : new Date(a.expires).getTime();
            const bx = b.expires instanceof Date ? b.expires.getTime() : new Date(b.expires).getTime();
            return bx - ax;
        })[0];
        return latest as any;
    }

    /**
     * Send a 6-digit verification token to user's email
     * @param email - User's email address
     * @param emailFrom - From email address
     * @returns Success status and email ID
     */
    async sendVerificationToken(email: string, emailFrom: string): Promise<{ success: boolean; data?: any; error?: string }> {
        console.log('[AuthService.sendVerificationToken] Starting for email:', email, 'emailFrom:', emailFrom);
        console.log('[AuthService.sendVerificationToken] ResendService exists:', !!this.resendService);
        console.log('[AuthService.sendVerificationToken] Database exists:', !!this.db);
        
        try {
            console.log('[AuthService.sendVerificationToken] Searching for user in database with email:', email);
            // Find the user by email to get their userId
            const user = await this.db.select().from(this.schema.Users).where(eq(this.schema.Users.email, email)).get();
            
            console.log('[AuthService.sendVerificationToken] User lookup result:', {
                userFound: !!user,
                userId: user?.id,
                userEmail: user?.email,
                emailVerified: user?.emailVerified
            });
            
            if (!user) {
                console.log('[AuthService.sendVerificationToken] ERROR: User not found in database');
                return {
                    success: false,
                    error: 'User not found'
                };
            }
            
            console.log('[AuthService.sendVerificationToken] Creating email verification token for userId:', user.id);
            // Create and store the verification token
            const tokenData = await this.createEmailVerificationToken(user.id, email);
            
            console.log('[AuthService.sendVerificationToken] Token creation result:', {
                tokenCreated: !!tokenData,
                token: tokenData?.token,
                tokenLength: tokenData?.token?.length
            });
            
            if (!tokenData) {
                console.log('[AuthService.sendVerificationToken] ERROR: Failed to create verification token');
                return {
                    success: false,
                    error: 'Failed to create verification token'
                };
            }

            console.log('[AuthService.sendVerificationToken] Calling ResendService.sendVerificationToken with token:', tokenData.token);
            // Delegate email sending to ResendService
            const result = await this.resendService.sendVerificationToken(email, tokenData.token, emailFrom);
            
            console.log('[AuthService.sendVerificationToken] ResendService result:', {
                success: result?.success,
                hasData: !!result?.data,
                error: result?.error,
                emailId: result?.data?.emailId
            });
            
            return result;
            
        } catch (error) {
            console.error('[AuthService.sendVerificationToken] EXCEPTION:', error);
            console.error('[AuthService.sendVerificationToken] Error stack:', (error as Error).stack);
            return {
                success: false,
                error: 'Failed to send verification token'
            };
        }
    };

    /**
     * Verify a user's email with a verification token
     * @param email - User's email address
     * @returns Object with success status and user data if successful
     */
    async verifyEmail(token: string, email?: string): Promise<{ success: boolean; user?: any; error?: string }> {
        // If email is not provided, we need to find it by searching all possible email verification tokens
        // For now, we'll require email to be passed
        if (!email) {
            return { success: false, error: 'Email is required for verification' };
        }
        
        // Get the verification token by email
        const verificationToken = await this.getEmailVerificationTokenByEmail(email);
        
        if (!verificationToken) {
            return { success: false, error: 'Invalid verification token' };
        }
        
        // Check if the provided token matches the stored token
        if (verificationToken.token !== token) {
            return { success: false, error: 'Invalid verification token' };
        }
        
        // Check if token is expired
        if (new Date() > new Date(verificationToken.expires)) {
            await this.deleteEmailVerificationTokenByEmail(email);
            return { success: false, error: 'Verification token has expired' };
        }
        
        // Find the user and update emailVerified
        const user = await this.db.select().from(this.schema.Users).where(eq(this.schema.Users.id, verificationToken.userId)).get();
        
        if (!user) {
            return { success: false, error: 'User not found' };
        }
        
        // Update the user's emailVerified status using updateUser for event-driven session updates
        const now = new Date();
        const updatedUser = await this.updateUser(verificationToken.userId, { emailVerified: now });
                
        // Delete the verification token
        await this.deleteEmailVerificationTokenByEmail(email);
        
        return { success: true, user: updatedUser };
    }

}