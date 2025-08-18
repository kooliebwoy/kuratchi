// Auth types and interfaces
export interface Session {
    sessionToken: string;
    userId: string;
    expires: Date;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

export interface OrganizationInfo {
    id: string;
    organization: string;
    email: string;
    status: 'active' | 'inactive' | 'lead';
    notes?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
}

export interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    role?: 'owner' | 'editor' | 'member';
    password_hash?: string;
    emailVerified?: Date | null;
    organizationId?: string;
    organization?: string;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
}

export interface UserMapping {
    id: string;
    email: string;
    organizationId: string;
    organization: string;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
}

// Backward-compat type alias (to be removed in a future major version)
export type Tenant = OrganizationInfo;
