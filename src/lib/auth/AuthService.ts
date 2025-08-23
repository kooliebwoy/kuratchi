import { comparePassword, hashPassword, generateSessionToken, hashToken, buildSessionCookie, parseSessionCookie } from "./utils.js";
import { EmailService } from "../email/EmailService.js";
import { OrgService } from "../org/OrgService.js";
import type { TableApi } from "../orm/kuratchi-orm.js";
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

// Minimal tables the AuthService expects on the runtime client
type AuthClientTables = {
    users: TableApi<any>;
    session: TableApi<any>;
    passwordResetTokens: TableApi<any>;
    emailVerificationToken: TableApi<any>;
    magicLinkTokens: TableApi<any>;
    oauthAccounts?: TableApi<any>;
};

// Helper to infer a table row type from the runtime client
type UsersRowOf<C> = C extends { users: TableApi<infer R> } ? R : never;

// Helper field resolver: if UsersRow has key K, infer its type; otherwise fall back to F
type FieldOr<C, K extends string, F> = UsersRowOf<C> extends { [P in K]?: infer T } ? T : F;

// Helper user row type used throughout AuthService, normalized to ensure presence of common keys
type UserRow<C> = UsersRowOf<C> & {
    id: string;
    email: string;
    emailVerified?: FieldOr<C, 'emailVerified', Date | null | undefined>;
    role?: FieldOr<C, 'role', string | null>;
    firstName?: FieldOr<C, 'firstName', string | null>;
    lastName?: FieldOr<C, 'lastName', string | null>;
    name?: FieldOr<C, 'name', string | null>;
    image?: FieldOr<C, 'image', string | null>;
    password_hash?: FieldOr<C, 'password_hash', string | null>;
};

export class AuthService<C extends AuthClientTables & Record<string, TableApi> = AuthClientTables & Record<string, TableApi>> {
    private client: C;
    private env: Env; // Store env for EmailService creation
    
    private emailService: EmailService;
    private orgService?: OrgService;
    
    /**
     * Creates an instance of AuthService that works with either D1 or Durable Object databases
     * @param client - A runtime ORM client (property-based API)
     * @param env - Environment variables
     */
    constructor(
        client: C,
        env: Env,
    ) {
        this.client = client;
        this.env = env;
        this.emailService = new EmailService(env as any); // Centralized templated email sender
        // Always initialize OrgService with the same runtime client
        this.orgService = new OrgService(client as any, env);
    }

    /**
     * Create a new user
     * @param userData - User data to insert
     * @param sendVerificationEmail - Whether to send a verification email (default: true)
     * @returns Object containing the created user and verification token
     */
    async createUser(userData: (Partial<UserRow<C>> & Record<string, any>) & { email: string; password?: string }, sendVerificationEmail: boolean = true): Promise<UserRow<C> | null> {
        // Generate a UUID for the new user
        const userId = crypto.randomUUID();
        
        // Hash password if plain provided and password_hash missing
        let toInsert = { ...userData } as Record<string, any>;
        if (!toInsert['password_hash'] && toInsert.password) {
            const pepper = this.env.KURATCHI_AUTH_SECRET; // reuse local secret as pepper
            toInsert['password_hash'] = (await hashPassword(toInsert.password, undefined, pepper)) as any;
            delete toInsert.password; // never persist plain password
        }

        // Create user with emailVerified set to null (unverified)
        await this.client.users.insert({
            ...toInsert,
            id: userId,
            emailVerified: null
        });
        const got = await this.client.users.findFirst({ id: userId } as any);
        const user = (got as any)?.data as UserRow<C> | undefined;
        
        // Generate an email verification token
        // const verificationToken = await this.createEmailVerificationToken(userId, userData.email);
        
        // Here you would send the verification email with the token
        // This would typically be handled by an email service
        // if (sendVerificationEmail) {
        //     // Example email sending logic (placeholder):
        //     // await this.emailService.sendVerificationEmail(userData.email, verificationToken.token);
        //     console.log(`Verification token for ${userData.email}: ${verificationToken.token}`);
        // }
        
        return user ?? null;
    }

    /**
     * Get all users
     * @returns Array of users
     */
    async getUsers(): Promise<UserRow<C>[]> {
        const res = await this.client.users.findMany();
        return ((res as any)?.data ?? []) as UserRow<C>[];
    }

    /**
     * Get a specific user by ID
     * @param id - User ID
     * @returns User or undefined
     */
    async getUser(id: string): Promise<UserRow<C> | undefined> {
        const res = await this.client.users.findFirst({ id } as any);
        return (res as any)?.data as UserRow<C> | undefined;
    }

    /**
     * Update a user by ID
     * @param id - User ID
     * @param userData - Partial user data to update
     * @returns Updated user
     */
    async updateUser(id: string, userData: Partial<UserRow<C>> & Record<string, any>): Promise<UserRow<C> | undefined> {
        await this.client.users.update({ id } as any, { ...userData, updated_at: new Date().toISOString() });
        const res = await this.client.users.findFirst({ id } as any);
        return (res as any)?.data as UserRow<C> | undefined;
    }

    /**
     * Delete a user by ID
     * @param id - User ID
     * @returns Deleted user
     */
    async deleteUser(id: string): Promise<UserRow<C> | null> {
        const user = await this.getUser(id);

        if (!user) {
            return null;
        }

        // invalidate all sessions for this user
        await this.invalidateAllSessions(id);

        await this.client.users.delete({ id } as any);
        return user as UserRow<C>;
    }

    /**
     * Delete all users
     * @returns Array of deleted users
     */
    async deleteUsers(): Promise<UserRow<C>[]> {
        const before = await this.getUsers();
        await this.client.users.delete({} as any);
        return before;
    }

    /**
     * Get a user by email address
     * @param email - User email
     * @returns User or undefined
     */
    async getUserByEmail(email: string): Promise<UserRow<C> | undefined> {
        const res = await this.client.users.findFirst({ email } as any);
        return (res as any)?.data as UserRow<C> | undefined;
    }

    // Role Methods
    /**
     * Create a new role
     * @param roleData - Role data to insert (must include name and description)
     * @returns The created role
     */
    // DEPRECATED: use OrgService.createRole()
    async createRole(roleData: any): Promise<any | undefined> {
        if (!this.orgService) throw new Error('OrgService not configured (runtime client missing)');
        return this.orgService.createRole(roleData);
    }

    /**
     * Get all roles
     * @returns Array of roles
     */
    // DEPRECATED: use OrgService.getRoles()
    async getRoles(): Promise<any[]> {
        if (!this.orgService) throw new Error('OrgService not configured (runtime client missing)');
        return this.orgService.getRoles();
    }

    /**
     * Get a specific role by ID
     * @param id - Role ID
     * @returns Role or undefined
     */
    // DEPRECATED: use OrgService.getRole()
    async getRole(id: string): Promise<any | undefined> {
        if (!this.orgService) throw new Error('OrgService not configured (runtime client missing)');
        return this.orgService.getRole(id);
    }

    /**
     * Update a role by ID
     * @param id - Role ID
     * @param roleData - Partial role data to update
     * @returns Updated role
     */
    // DEPRECATED: use OrgService.updateRole()
    async updateRole(id: string, roleData: Partial<any>): Promise<any | undefined> {
        if (!this.orgService) throw new Error('OrgService not configured (runtime client missing)');
        return this.orgService.updateRole(id, roleData);
    }

    /**
     * Delete a role by ID
     * @param id - Role ID
     * @returns Deleted role
     */
    // DEPRECATED: use OrgService.deleteRole()
    async deleteRole(id: string): Promise<any | undefined> {
        if (!this.orgService) throw new Error('OrgService not configured (runtime client missing)');
        return this.orgService.deleteRole(id);
    }

    // Activity Methods
    /**
     * Create a new activity
     * @param activity - Activity data to insert
     * @returns The created activity
     */
    // DEPRECATED: use OrgService.createActivity()
    async createActivity(activity: any): Promise<any | undefined> {
        if (!this.orgService) throw new Error('OrgService not configured (runtime client missing)');
        return this.orgService.createActivity(activity);
    }

    /**
     * Get all activities with user information
     * @returns Array of activities with user data
     */
    // DEPRECATED: use OrgService.getAllActivity()
    async getAllActivity(): Promise<any[]> {
        if (!this.orgService) throw new Error('OrgService not configured (runtime client missing)');
        return this.orgService.getAllActivity();
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
    // DEPRECATED: use OrgService.getPaginatedActivity()
    async getPaginatedActivity(limit = 10, page = 1, search = '', filter = '', order: 'asc' | 'desc' = 'desc'): Promise<{ data: any[], total: number }> {
        if (!this.orgService) throw new Error('OrgService not configured (runtime client missing)');
        return this.orgService.getPaginatedActivity(limit, page, search, filter, order);
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
    async authenticateUser(email: string, password: string): Promise<UserRow<C> | null> {
        const user = await this.getUserByEmail(email);
        
        if (!user || !user.password_hash) {
            return null;
        }

        const pepper = this.env.KURATCHI_AUTH_SECRET; // use local key as pepper
        const isValidPassword = await comparePassword(password, user.password_hash, pepper);
        
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
        user: UserRow<C>;
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
        await this.client.session.delete({ sessionToken: tokenHash } as any);
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
            const found = await this.client.session.findFirst({ sessionToken: tokenHash } as any);
            const row = (found as any)?.data;
            if (!row) throw new Error('Session to refresh not found');
            userId = row.userId;

            await this.client.session.update({ sessionToken: tokenHash } as any, { expires, updated_at: now.toISOString() });
            return sessionId; // opaque cookie remains the same
        }

        if (!userId) throw new Error('User ID is required to create or refresh a session');

        // Create a new session
        const userData = await this.getUser(userId);
        if (!userData) throw new Error('User not found for session creation');
        // Determine organization prefix for the session cookie
        const organizationId = (userData as any).organizationId
            ?? (userData as any).tenantId
            ?? (userData as any).organization
            ?? 'admin';
        const prefix = String(organizationId);
        const finalSessionId = `${prefix}.${generateSessionToken()}`;
        const sessionTokenHash = await hashToken(finalSessionId);
        await this.client.session.insert({
            sessionToken: sessionTokenHash,
            userId,
            expires,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
            deleted_at: null,
        });
        // Build opaque cookie envelope from orgId and tokenHash
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
            const sessionRes = await this.client.session.findMany({ userId } as any);
            const sessions = (sessionRes as any).data ?? [];

            if (!Array.isArray(sessions) || sessions.length === 0) {
                return { success: true, refreshedCount: 0 };
            }

            // Extend TTL for all sessions belonging to this user
            const now = new Date();
            const newExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            await this.client.session.update({ userId } as any, { expires: newExpires, updated_at: now.toISOString() });

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
        await this.client.session.delete({ userId } as any);
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
        const sessionRes = await this.client.session.findFirst({ sessionToken: tokenHash } as any);
        const sessionRow = (sessionRes as any)?.data;
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
        await this.client.session.update({ sessionToken: tokenHash } as any, { expires: newExpires, updated_at: now.toISOString() });

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
            organizationId: (userData as any).organizationId
                ?? (userData as any).tenantId
                ?? (userData as any).organization
                ?? '',
            email: userData.email,
            roles,
            isEmailVerified: userData.emailVerified ? true : false,
            user: {
                id: userData.id,
                email: userData.email,
                firstName: userData.firstName ?? null,
                lastName: userData.lastName ?? null,
                name: userData.name ?? null,
                role: userData.role ?? null,
                organizationSlug: (userData as any).organizationSlug ?? null,
                organizationId: (userData as any).organizationId
                    ?? (userData as any).tenantId
                    ?? (userData as any).organization
                    ?? null
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
        
        const id = crypto.randomUUID();
        const token = crypto.randomUUID();
        await this.client.passwordResetTokens.insert({
            id,
            email,
            token,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
            deleted_at: null,
            expires: expiryDate
        });
        return { id, email, token, expires: expiryDate } as any;
    }

    async deletePasswordResetToken(token: string) {
        const before = await this.client.passwordResetTokens.findMany({ token } as any);
        await this.client.passwordResetTokens.delete({ token } as any);
        const rows = ((before as any).data ?? []) as any[];
        return rows.length > 0;
    }

    async getPasswordResetToken(token: string) {
        const res = await this.client.passwordResetTokens.findMany({ token } as any);
        return ((res as any).data ?? []) as any[];
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

        const id = crypto.randomUUID();
        await this.client.emailVerificationToken.insert({
            id,
            userId,
            email,
            token,
            expires: expiryDate,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
            deleted_at: null,
        });
        return { id, userId, email, token, expires: expiryDate } as any;
    }

    /**
     * Delete an email verification token by email
     * @param email - Email to delete token for
     * @returns Whether the token was successfully deleted
     */
    async deleteEmailVerificationTokenByEmail(email: string) {
        await this.client.emailVerificationToken.delete({ email } as any);
        return true;
    }

    /**
     * Get an email verification token by email
     * @param email - Email to get token for
     * @returns The email verification token
     */
    async getEmailVerificationTokenByEmail(email: string) {
        // Return the most recent token for this email
        const res = await this.client.emailVerificationToken.findMany({ email } as any);
        const tokens = ((res as any).data ?? []) as any[];
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
        
        console.log('[AuthService.sendVerificationToken] Runtime client initialized:', !!this.client);
        
        try {
            console.log('[AuthService.sendVerificationToken] Searching for user in database with email:', email);
            // Find the user by email to get their userId
            const user = await this.getUserByEmail(email);
            
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

            console.log('[AuthService.sendVerificationToken] Sending via EmailService templated email with token:', tokenData.token);
            const sent = await this.emailService.sendVerification(email, tokenData.token, { from: emailFrom });
            const emailId = (sent as any)?.id;
            console.log('[AuthService.sendVerificationToken] EmailService result:', { emailId });
            return {
                success: true,
                data: { message: 'Verification token sent successfully', emailId }
            };
            
        } catch (error) {
            console.error('[AuthService.sendVerificationToken] EXCEPTION:', error);
            console.error('[AuthService.sendVerificationToken] Error stack:', (error as Error).stack);
            return {
                success: false,
                error: 'Failed to send verification token'
            };
        }
    }

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
        const user = await this.getUser(verificationToken.userId);
        
        if (!user) {
            return { success: false, error: 'User not found' };
        }
        
        // Update the user's emailVerified status using updateUser for event-driven session updates
        const now = new Date();
        const updatedUser = await this.updateUser(verificationToken.userId, { emailVerified: now as any } as any);
                
        // Delete the verification token
        await this.deleteEmailVerificationTokenByEmail(email);
        
        return { success: true, user: updatedUser };
    }

    

// =====================
// Magic Link
// =====================

async createMagicLinkToken(email: string, redirectTo?: string, ttlMinutes = 15) {
    const now = new Date();
    const expires = new Date(now.getTime() + ttlMinutes * 60 * 1000);
    const token = generateSessionToken();
    const id = crypto.randomUUID();
    await this.client.magicLinkTokens.insert({
        id,
        token,
        email,
        redirectTo: redirectTo || null,
        consumed_at: null,
        expires,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        deleted_at: null
    });
    return { token, expires, redirectTo };
}

async verifyMagicLink(token: string): Promise<{ success: boolean; cookie?: string; redirectTo?: string; user?: UserRow<C>; error?: string }> {
    const found = await this.client.magicLinkTokens.findFirst({ token } as any);
    const row = (found as any)?.data;
    if (!row) return { success: false, error: 'Invalid or expired token' };
    const now = new Date();
    const expired = row.expires && new Date(row.expires).getTime() <= now.getTime();
    if (expired) return { success: false, error: 'Token expired' };
    if (row.consumed_at) return { success: false, error: 'Token already used' };

    // Mark consumed
    await this.client.magicLinkTokens.update({ id: row.id } as any, { consumed_at: now, updated_at: now.toISOString() });

    // Ensure user exists
    let user = await this.getUserByEmail(row.email);
    if (!user) {
        const created = await this.createUser({ email: row.email, emailVerified: now as any } as any);
        if (!created) return { success: false, error: 'Failed to create user' };
        user = created;
    } else if (!user.emailVerified) {
        await this.updateUser(user.id, { emailVerified: now as any } as any);
    }

    // Create a session and return cookie
    const ensuredUser = user as UserRow<C>;
    const cookie = await this.upsertSession({ userId: ensuredUser.id });
    return { success: true, cookie, redirectTo: row.redirectTo ?? undefined, user: ensuredUser };
}

async sendMagicLink(email: string, link: string, opts?: { from?: string; subject?: string }) {
    return this.emailService.sendMagicLink(email, link, opts);
}

// =====================
// OAuth
// =====================

async getOrCreateUserFromOAuth(params: {
    provider: string;
    providerAccountId: string;
    email?: string;
    name?: string | null;
    image?: string | null;
    tokens?: {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number | Date | null;
        scope?: string | null;
        token_type?: string | null;
        id_token?: string | null;
    };
}): Promise<any> {
    const { provider, providerAccountId, email, name, image, tokens } = params;
    // Try existing link
    const existing = await (this.client as any).oauthAccounts?.findFirst({ provider, providerAccountId } as any);
    const existingRow = (existing as any)?.data;
    if (existingRow?.userId) {
        const u = await this.getUser(existingRow.userId);
        if (u) return u;
    }

    // Find or create user by email
    let user: any = null;
    if (email) {
        user = await this.getUserByEmail(email);
    }
    if (!user) {
        user = await this.createUser({
            email: email!,
            name: name ?? null,
            image: image ?? null,
            emailVerified: new Date() as any
        } as any, false);
    }

    // Upsert OAuth account
    const now = new Date();
    const expires_at = tokens?.expires_at ? (typeof tokens.expires_at === 'number' ? new Date(tokens.expires_at) : tokens.expires_at) : null;

    if ((this.client as any).oauthAccounts) {
        if (!user) throw new Error('Failed to resolve user');
        const ensuredUser = user as UserRow<C>;
        const link = await (this.client as any).oauthAccounts.findFirst({ provider, providerAccountId } as any);
        if ((link as any)?.data) {
            await (this.client as any).oauthAccounts.update({ provider, providerAccountId } as any, {
                userId: ensuredUser.id,
                access_token: tokens?.access_token ?? null,
                refresh_token: tokens?.refresh_token ?? null,
                expires_at,
                scope: tokens?.scope ?? null,
                token_type: tokens?.token_type ?? null,
                id_token: tokens?.id_token ?? null,
                updated_at: now.toISOString(),
            });
        } else {
            await (this.client as any).oauthAccounts.insert({
                id: crypto.randomUUID(),
                userId: ensuredUser.id,
                provider,
                providerAccountId,
                access_token: tokens?.access_token ?? null,
                refresh_token: tokens?.refresh_token ?? null,
                expires_at,
                scope: tokens?.scope ?? null,
                token_type: tokens?.token_type ?? null,
                id_token: tokens?.id_token ?? null,
                created_at: now.toISOString(),
                updated_at: now.toISOString(),
                deleted_at: null,
            });
        }
    }

    return user;
}
}