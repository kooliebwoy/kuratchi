/**
 * Email tracking schema
 * Add this to your admin schema to track sent emails
 */

export const emailsTableSchema = {
	emails: {
		id: 'text primary key not null',
		to: 'text not null',
		from: 'text not null',
		subject: 'text not null',
		emailType: 'text', // e.g., 'magic_link', 'password_reset', 'notification'
		status: 'enum(sent,failed,pending) default sent',
		resendId: 'text', // Resend email ID for tracking
		error: 'text', // Error message if failed
		userId: 'text',
		organizationId: 'text',
		metadata: 'json', // Additional metadata
		sentAt: 'text', // ISO timestamp when email was sent
		created_at: 'text default now',
		updated_at: 'text default now',
		deleted_at: 'text',
	}
} as const;

/**
 * Example: Add to your admin schema
 * 
 * import { emailsTableSchema } from 'kuratchi-sdk/email';
 * 
 * export const adminSchema = {
 *   name: 'admin',
 *   version: 5,
 *   tables: {
 *     ...yourExistingTables,
 *     ...emailsTableSchema
 *   }
 * };
 */
