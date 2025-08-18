import { relations, sql, type InferSelectModel } from "drizzle-orm";
import { text, integer, sqliteTable, uniqueIndex } from "drizzle-orm/sqlite-core";

// columns helpers
const timestamps = {
    updated_at: text().default(sql`(CURRENT_TIMESTAMP)`),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`),
    deleted_at: text(),
}

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
    role: text('role', { enum: ["superadmin", "owner", "editor", "member"] }), // this matches our tenant model
    password_hash: text("password_hash"),
	accessAttempts: integer("accessAttempts"),
    ...timestamps
});

export const PasswordResetTokens = sqliteTable('passwordResetTokens', {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    email: text("email").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
    ...timestamps
});

// Email verification tokens (DB-backed)
export const EmailVerificationTokens = sqliteTable('emailVerificationToken', {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    email: text("email").notNull(),
    userId: text("userId").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
    ...timestamps
});

export const OrganizationUsers = sqliteTable('organizationUsers', {
    id: text("id").notNull().primaryKey(),
    email: text("email"),
    organizationId: text("organizationId"),
    organizationSlug: text("organizationSlug"),
    ...timestamps
});

export const Organizations = sqliteTable('organizations', {
    id: text("id").notNull().primaryKey(),
    organizationName: text("organizationName"),
    email: text("email").unique(),
    organizationSlug: text("organizationSlug").unique(),
    notes: text("notes"),
    stripeCustomerId: text("stripeCustomerId"),
    stripeSubscriptionId: text("stripeSubscriptionId"),
    status: text('status', { enum: ["active", "inactive", "lead"] }),
    ...timestamps
});

// Activity
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

// Sessions (DB-backed sessions with TTL)
export const Sessions = sqliteTable('session', {
    sessionToken: text("sessionToken").notNull().primaryKey(),
    userId: text("userId")
        .notNull()
        .references(() => Users.id, { onDelete: "cascade" }),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
    ...timestamps
});

export const Databases = sqliteTable(
    'databases', 
    {
        id: text("id").notNull().primaryKey(),
        name: text("name"),
        dbuuid: text("dbuuid").unique(),
        isArchived: integer("isArchived", { mode: "boolean" }),
        isActive: integer("isActive", { mode: "boolean" }),
        lastBackup: integer("lastBackup", { mode: "timestamp_ms" }),
        schemaVersion: integer("schemaVersion").default(sql`1`),
        needsSchemaUpdate: integer("needsSchemaUpdate", { mode: "boolean" }).default(sql`0`),
        lastSchemaSync: integer("lastSchemaSync", { mode: "timestamp_ms" }),
        organizationId: text("organizationId").references(() => Organizations.id),
        ...timestamps
    },
    (table) => [
        uniqueIndex("dbuuid_idx").on(table.dbuuid),
        uniqueIndex("name_idx").on(table.name)
    ]
);

export const DBApiTokens = sqliteTable(
    'dbApiTokens', 
    {
        id: text("id").notNull().primaryKey(),
        token: text("token").notNull().unique(),
        name: text("name"),
        databaseId: text("databaseId").references(() => Databases.id),
        expires: integer("expires", { mode: "timestamp_ms" }),
        revoked: integer("revoked", { mode: "boolean" }),
        ...timestamps
    },
    (table) => [
        uniqueIndex("token_idx").on(table.token)
    ]
);

// Organization Relations
export const OrganizationsRelations = relations(Organizations, ({ one, many }) => ({
    Users: many(OrganizationUsers),
}));

// Organization User Relations
export const OrganizationUsersRelations = relations(OrganizationUsers, ({ one }) => ({
    Organization: one(Organizations, { fields: [OrganizationUsers.organizationId], references: [Organizations.id] }),
}));

//Activity Relations
export const ActivityUserRelations = relations(Activity, ({ one }) => ({
    Users: one(Users, { fields: [Activity.userId], references: [Users.id] }),
}));

export const databasesRelations = relations(Databases, ({ one }) => ({
    Organization: one(Organizations, {
        fields: [Databases.organizationId],
        references: [Organizations.id],
    }),
    ApiToken: one(DBApiTokens, {
        fields: [Databases.id],
        references: [DBApiTokens.databaseId],
    }),
}));

export const dbApiTokensRelations = relations(DBApiTokens, ({ one }) => ({
    Database: one(Databases, {
        fields: [DBApiTokens.databaseId],
        references: [Databases.id],
    }),
}));

export type User = InferSelectModel<typeof Users>;
export type Session = InferSelectModel<typeof Sessions>;
export type PasswordResetToken = InferSelectModel<typeof PasswordResetTokens>;
export type OrganizationUser = InferSelectModel<typeof OrganizationUsers>;
export type Organization = InferSelectModel<typeof Organizations>;
export type Activity = InferSelectModel<typeof Activity>;
export type Database = InferSelectModel<typeof Databases>;
export type DBApiToken = InferSelectModel<typeof DBApiTokens>;

// Export schema for Drizzle
export const adminSchema = {
    Users,
    Organizations,
    Sessions,
    PasswordResetTokens,
    EmailVerificationTokens,
    OrganizationUsers,
    Activity,
    Databases,
    DBApiTokens,
    // Relations
    OrganizationsRelations,
    OrganizationUsersRelations,
    ActivityUserRelations,
    databasesRelations,
    dbApiTokensRelations
};