import { relations, sql, type InferSelectModel } from "drizzle-orm";
import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";

// columns helpers
const timestamps = {
    updated_at: text().default(sql`(CURRENT_TIMESTAMP)`),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`),
    deleted_at: text(),
}

// Users in an organization database
export const Users = sqliteTable('users', {
    id: text("id").notNull().primaryKey(),
    name: text("name"),
    firstName: text("firstName"),
    lastName: text("lastName"),
    phone: text("phone"),
    email: text("email").notNull().unique(),
    emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
    image: text("image"),
    status: integer('status', { mode: 'boolean' }),
    role: text('role', { enum: ["owner", "editor", "member"] }),
    password_hash: text("password_hash"),
    accessAttempts: integer("accessAttempts"),
    tenantId: text("tenantId"),
    organization: text("organization"),
    ...timestamps
});

// Sessions (DB-backed sessions with TTL)
export const Sessions = sqliteTable('session', {
    sessionToken: text("sessionToken").notNull().primaryKey(),
    userId: text("userId")
        .notNull()
        .references(() => Users.id, { onDelete: "cascade" }),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
    ...timestamps
});

// Password reset tokens
export const PasswordResetTokens = sqliteTable('passwordResetTokens', {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    email: text("email").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
    ...timestamps
});

// Email verification tokens
export const EmailVerificationTokens = sqliteTable('emailVerificationToken', {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    email: text("email").notNull(),
    userId: text("userId").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
    ...timestamps
});

// Magic link tokens (per-organization)
export const MagicLinkTokens = sqliteTable('magicLinkTokens', {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    email: text("email").notNull(),
    redirectTo: text("redirectTo"),
    consumed_at: integer("consumed_at", { mode: "timestamp_ms" }),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
    ...timestamps
});

// Activity log
export const Activity = sqliteTable('activity', {
    id: text("id").primaryKey(),
    userId: text("userId"),
    action: text("action").notNull(),
    data: text("data", { mode: 'json' }).$type<any>().default(sql`(json_object())`),
    status: integer('status', { mode: 'boolean' }),
    ip: text("ip"),
    userAgent: text("userAgent"),
    ...timestamps
});

// Roles
export const Roles = sqliteTable('roles', {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    permissions: text("permissions", { mode: 'json' }).$type<string[]>(),
    ...timestamps
});

// OAuth accounts (per provider, per-organization)
export const OAuthAccounts = sqliteTable('oauthAccounts', {
    id: text("id").primaryKey(),
    userId: text("userId").references(() => Users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    access_token: text("access_token"),
    refresh_token: text("refresh_token"),
    expires_at: integer("expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    token_type: text("token_type"),
    id_token: text("id_token"),
    ...timestamps
});

// Relations
export const UserRelations = relations(Users, ({ many }) => ({
    Sessions: many(Sessions),
    Activity: many(Activity)
}));

export const SessionRelations = relations(Sessions, ({ one }) => ({
    User: one(Users, { fields: [Sessions.userId], references: [Users.id] })
}));

export const ActivityRelations = relations(Activity, ({ one }) => ({
    User: one(Users, { fields: [Activity.userId], references: [Users.id] })
}));

// Export schema for Drizzle
export const organizationSchema = {
    Users,
    Sessions,
    PasswordResetTokens,
    EmailVerificationTokens,
    MagicLinkTokens,
    Activity,
    Roles,
    OAuthAccounts,
    // Relations
    UserRelations,
    SessionRelations,
    ActivityRelations
};

export type User = InferSelectModel<typeof Users>;
export type Session = InferSelectModel<typeof Sessions>;
export type PasswordResetToken = InferSelectModel<typeof PasswordResetTokens>;
export type MagicLinkToken = InferSelectModel<typeof MagicLinkTokens>;
export type OAuthAccount = InferSelectModel<typeof OAuthAccounts>;
export type Activity = InferSelectModel<typeof Activity>;