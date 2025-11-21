/**
 * Newsletter Module Types
 * Database-backed email marketing with Amazon SES
 */

export interface NewsletterSegment {
	id: string;
	organizationId: string;
	name: string;
	description?: string;
	subscriberCount?: number;
	created_at: string;
	updated_at: string;
	deleted_at?: string;
}

export interface NewsletterContact {
	id: string;
	organizationId: string;
	email: string;
	firstName?: string;
	lastName?: string;
	unsubscribed: boolean;
	unsubscribedAt?: string;
	metadata?: Record<string, any>;
	created_at: string;
	updated_at: string;
	deleted_at?: string;
}

export interface NewsletterSegmentContact {
	segmentId: string;
	contactId: string;
	added_at: string;
}

export interface NewsletterTemplate {
	id: string;
	organizationId: string;
	name: string;
	subject: string;
	html: string;
	text?: string;
	previewText?: string;
	created_at: string;
	updated_at: string;
	deleted_at?: string;
}

export interface NewsletterBroadcast {
	id: string;
	organizationId: string;
	segmentId: string;
	name: string;
	subject: string;
	html?: string;
	text?: string;
	previewText?: string;
	status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
	scheduledAt?: string;
	sentAt?: string;
	recipientCount?: number;
	successCount?: number;
	failureCount?: number;
	created_at: string;
	updated_at: string;
	deleted_at?: string;
}

export interface NewsletterCampaign {
	id: string;
	organizationId: string;
	segmentId: string;
	name: string;
	description?: string;
	status: 'draft' | 'active' | 'paused' | 'completed';
	startAt?: string;
	lastLaunchAt?: string;
	contactsTargeted: number;
	totalScheduled: number;
	created_at: string;
	updated_at: string;
	deleted_at?: string;
}

export interface NewsletterCampaignStep {
	id: string;
	campaignId: string;
	organizationId: string;
	stepOrder: number;
	label: string;
	subject: string;
	html?: string;
	text?: string;
	previewText?: string;
	scheduleMode: 'relative' | 'absolute';
	sendAt?: string; // For absolute scheduling
	delayMinutes: number; // For relative scheduling
	status: 'draft' | 'scheduled' | 'completed';
	// Branching logic
	monitorEvent?: 'opened' | 'clicked';
	successStepId?: string;
	fallbackStepId?: string;
	evaluateAfterMinutes?: number;
	created_at: string;
	updated_at: string;
	deleted_at?: string;
}

export interface NewsletterSentEmail {
	id: string;
	organizationId: string;
	contactId: string;
	email: string;
	type: 'broadcast' | 'campaign';
	broadcastId?: string;
	campaignId?: string;
	campaignStepId?: string;
	subject: string;
	sesMessageId?: string;
	status: 'scheduled' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed';
	scheduledAt?: string;
	sentAt?: string;
	deliveredAt?: string;
	openedAt?: string;
	clickedAt?: string;
	failedAt?: string;
	error?: string;
	metadata?: Record<string, any>;
	created_at: string;
	updated_at: string;
}

export interface NewsletterBranchCheck {
	id: string;
	organizationId: string;
	campaignId: string;
	stepId: string;
	contactId: string;
	sentEmailId: string;
	monitorEvent: 'opened' | 'clicked';
	successStepId?: string;
	fallbackStepId?: string;
	evaluateAt: string;
	baseTime: string;
	processed: boolean;
	processedAt?: string;
	created_at: string;
}

// Input types for API functions
export interface CreateSegmentInput {
	name: string;
	description?: string;
}

export interface CreateContactInput {
	email: string;
	firstName?: string;
	lastName?: string;
	metadata?: Record<string, any>;
}

export interface AddContactToSegmentInput {
	segmentId: string;
	contactId?: string;
	email?: string;
	firstName?: string;
	lastName?: string;
}

export interface CreateTemplateInput {
	name: string;
	subject: string;
	html: string;
	text?: string;
	previewText?: string;
}

export interface CreateBroadcastInput {
	segmentId: string;
	name: string;
	subject: string;
	html?: string;
	text?: string;
	previewText?: string;
	scheduledAt?: string;
}

export interface CampaignStepInput {
	id?: string;
	label: string;
	subject: string;
	html?: string;
	text?: string;
	previewText?: string;
	scheduleMode: 'relative' | 'absolute';
	sendAt?: string;
	delayMinutes: number;
	// Branching
	monitorEvent?: 'opened' | 'clicked';
	successStepId?: string;
	fallbackStepId?: string;
	evaluateAfterMinutes?: number;
}

export interface CreateCampaignInput {
	segmentId: string;
	name: string;
	description?: string;
	startAt?: string;
	steps: CampaignStepInput[];
}

export interface NewsletterPluginOptions {
	/** SES configuration (inherited from email plugin or specified separately) */
	sesRegion?: string;
	sesAccessKeyId?: string;
	sesSecretAccessKey?: string;
	sesFrom?: string;
	sesFromName?: string;
	sesConfigurationSetName?: string;

	/** Database storage location (default: 'org') */
	storageDb?: 'admin' | 'org';

	/** Enable tracking of email events (default: true) */
	enableTracking?: boolean;

	/** Maximum contacts to process per broadcast/campaign launch (default: 1000) */
	maxContactsPerLaunch?: number;
}

export interface NewsletterResult {
	success: boolean;
	id?: string;
	error?: string;
	data?: any;
}
