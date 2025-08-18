import { relations, sql } from "drizzle-orm";
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

// Activity log
export const Activity = sqliteTable('activity', {
    id: text("id").primaryKey(),
    userId: text("userId"),
    action: text("action").notNull(),
    data: text("data", { mode: 'json' }).$type<any>().default(sql`(json_object())`),
    status: integer('status', { mode: 'boolean' }),
    ip: text("ip"),
    userAgent: text("userAgent"),
    siteId: text("siteId"), // For site-specific activities
    ...timestamps
});

// Sites (if organization has multiple sites)
export const Sites = sqliteTable('sites', {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    projectName: text("projectName"),
    domain: text("domain"),
    status: integer('status', { mode: 'boolean' }),
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

// Relations
export const UserRelations = relations(Users, ({ many }) => ({
    Sessions: many(Sessions),
    Activity: many(Activity)
}));

export const SessionRelations = relations(Sessions, ({ one }) => ({
    User: one(Users, { fields: [Sessions.userId], references: [Users.id] })
}));

export const ActivityRelations = relations(Activity, ({ one }) => ({
    User: one(Users, { fields: [Activity.userId], references: [Users.id] }),
    Site: one(Sites, { fields: [Activity.siteId], references: [Sites.id] })
}));

// Export schema for Drizzle
export const organizationSchema = {
    Users,
    Sessions,
    PasswordResetTokens,
    EmailVerificationTokens,
    Activity,
    Sites,
    Roles,
    // Relations
    UserRelations,
    SessionRelations,
    ActivityRelations
};
