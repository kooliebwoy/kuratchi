/**
 * Newsletter Module
 * Database-backed email marketing with Amazon SES
 */

import type { RequestEvent } from '@sveltejs/kit';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type {
	NewsletterSegment,
	NewsletterContact,
	NewsletterTemplate,
	NewsletterBroadcast,
	NewsletterCampaign,
	NewsletterCampaignStep,
	NewsletterSentEmail,
	NewsletterBranchCheck,
	CreateSegmentInput,
	CreateContactInput,
	AddContactToSegmentInput,
	CreateTemplateInput,
	CreateBroadcastInput,
	CreateCampaignInput,
	NewsletterPluginOptions,
	NewsletterResult,
} from './types.js';

export * from './types.js';

let sesClient: SESv2Client | null = null;
let pluginOptions: NewsletterPluginOptions | null = null;

/**
 * Initialize newsletter plugin
 */
export function initNewsletterPlugin(options: NewsletterPluginOptions) {
	pluginOptions = options;

	if (options.sesRegion && options.sesAccessKeyId && options.sesSecretAccessKey) {
		sesClient = new SESv2Client({
			region: options.sesRegion,
			credentials: {
				accessKeyId: options.sesAccessKeyId,
				secretAccessKey: options.sesSecretAccessKey,
			}
		});
	}
}

// Helper to get database
async function getDb(event: RequestEvent, organizationId?: string) {
	if (pluginOptions?.storageDb === 'admin') {
		return await event.locals.kuratchi?.getAdminDb?.();
	}
	// Use orgDatabaseClient (set by organizationPlugin)
	const getOrgDb = event.locals.kuratchi?.orgDatabaseClient;
	if (!getOrgDb) {
		console.log('[Newsletter] orgDatabaseClient not available on event.locals.kuratchi');
		return null;
	}
	return await getOrgDb(organizationId);
}

// Helper to get organization ID
function getOrgId(event: RequestEvent): string {
	const orgId = (event.locals as any).session?.user?.organizationId;
	if (!orgId) {
		throw new Error('Organization context required');
	}
	return orgId;
}

// ============================================================================
// SEGMENTS
// ============================================================================

/**
 * List all segments for an organization
 */
export async function listSegments(event: RequestEvent): Promise<NewsletterSegment[]> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_segments) return [];

		const result = await db.newsletter_segments
			.where({ organizationId: orgId, deleted_at: { is: null } })
			.orderBy({ created_at: 'desc' })
			.many();

		// Get subscriber counts
		const segments = result?.data || [];
		for (const segment of segments) {
			if (db.newsletter_segment_contacts) {
				const countResult = await db.newsletter_segment_contacts.count({ segmentId: segment.id });
				const countData = countResult?.data?.[0]?.count ?? countResult?.data ?? 0;
				segment.subscriberCount = typeof countData === 'number' ? countData : 0;
			}
		}

		return segments;
	} catch (error) {
		console.error('[Newsletter] Error listing segments:', error);
		return [];
	}
}

/**
 * Create a new segment
 */
export async function createSegment(
	event: RequestEvent,
	input: CreateSegmentInput
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_segments) {
			return { success: false, error: 'Newsletter segments table not found' };
		}

		const segment: NewsletterSegment = {
			id: crypto.randomUUID(),
			organizationId: orgId,
			name: input.name,
			description: input.description,
			subscriberCount: 0,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		await db.newsletter_segments.insert(segment);

		return { success: true, id: segment.id, data: segment };
	} catch (error: any) {
		console.error('[Newsletter] Error creating segment:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Delete a segment
 */
export async function deleteSegment(
	event: RequestEvent,
	segmentId: string
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_segments) {
			return { success: false, error: 'Newsletter segments table not found' };
		}

		await db.newsletter_segments
			.where({ id: segmentId, organizationId: orgId })
			.update({ deleted_at: new Date().toISOString() });

		// Also remove all segment contacts
		if (db.newsletter_segment_contacts) {
			await db.newsletter_segment_contacts.delete({ segmentId });
		}

		return { success: true };
	} catch (error: any) {
		console.error('[Newsletter] Error deleting segment:', error);
		return { success: false, error: error.message };
	}
}

// ============================================================================
// CONTACTS
// ============================================================================

/**
 * List contacts in a segment
 */
export async function listSegmentContacts(
	event: RequestEvent,
	segmentId: string,
	limit: number = 50
): Promise<{ contacts: NewsletterContact[]; hasMore: boolean }> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_contacts || !db?.newsletter_segment_contacts) {
			return { contacts: [], hasMore: false };
		}

		// Get contact IDs from segment
		const segmentContactsResult = await db.newsletter_segment_contacts
			.where({ segmentId })
			.limit(limit + 1)
			.many();

		const segmentContacts = segmentContactsResult?.data || [];
		const hasMore = segmentContacts.length > limit;
		const contactIds = segmentContacts.slice(0, limit).map((sc: any) => sc.contactId);

		if (contactIds.length === 0) {
			return { contacts: [], hasMore: false };
		}

		// Get full contact details
		const contactsResult = await db.newsletter_contacts
			.where({ id: { in: contactIds }, deleted_at: { is: null } })
			.many();

		return {
			contacts: contactsResult?.data || [],
			hasMore
		};
	} catch (error) {
		console.error('[Newsletter] Error listing segment contacts:', error);
		return { contacts: [], hasMore: false };
	}
}

/**
 * Add a contact to a segment
 */
export async function addContactToSegment(
	event: RequestEvent,
	input: AddContactToSegmentInput
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_contacts || !db?.newsletter_segment_contacts) {
			return { success: false, error: 'Newsletter tables not found' };
		}

		let contactId = input.contactId;

		// If no contactId, find or create contact by email
		if (!contactId && input.email) {
			const existingResult = await db.newsletter_contacts
				.where({ organizationId: orgId, email: input.email, deleted_at: { is: null } })
				.first();

			if (existingResult?.data) {
				contactId = existingResult.data.id;
			} else {
				// Create new contact
				const contact: NewsletterContact = {
					id: crypto.randomUUID(),
					organizationId: orgId,
					email: input.email,
					firstName: input.firstName,
					lastName: input.lastName,
					unsubscribed: false,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				};
				await db.newsletter_contacts.insert(contact);
				contactId = contact.id;
			}
		}

		if (!contactId) {
			return { success: false, error: 'Contact ID or email required' };
		}

		// Check if already in segment
		const existingLink = await db.newsletter_segment_contacts
			.where({ segmentId: input.segmentId, contactId })
			.first();

		if (!existingLink?.data) {
			await db.newsletter_segment_contacts.insert({
				segmentId: input.segmentId,
				contactId,
				added_at: new Date().toISOString(),
			});
		}

		return { success: true, id: contactId };
	} catch (error: any) {
		console.error('[Newsletter] Error adding contact to segment:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Remove a contact from a segment
 */
export async function removeContactFromSegment(
	event: RequestEvent,
	segmentId: string,
	contactId?: string,
	email?: string
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_segment_contacts) {
			return { success: false, error: 'Newsletter tables not found' };
		}

		let finalContactId = contactId;

		// If email provided, find contact ID
		if (!finalContactId && email && db.newsletter_contacts) {
			const contactResult = await db.newsletter_contacts
				.where({ organizationId: orgId, email, deleted_at: { is: null } })
				.first();
			finalContactId = contactResult?.data?.id;
		}

		if (!finalContactId) {
			return { success: false, error: 'Contact not found' };
		}

		await db.newsletter_segment_contacts.delete({ segmentId, contactId: finalContactId });

		return { success: true };
	} catch (error: any) {
		console.error('[Newsletter] Error removing contact from segment:', error);
		return { success: false, error: error.message };
	}
}

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * List all templates
 */
export async function listTemplates(event: RequestEvent): Promise<NewsletterTemplate[]> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_templates) return [];

		const result = await db.newsletter_templates
			.where({ organizationId: orgId, deleted_at: { is: null } })
			.orderBy({ created_at: 'desc' })
			.many();

		return result?.data || [];
	} catch (error) {
		console.error('[Newsletter] Error listing templates:', error);
		return [];
	}
}

/**
 * Get a template by ID
 */
export async function getTemplate(
	event: RequestEvent,
	templateId: string
): Promise<NewsletterTemplate | null> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_templates) return null;

		const result = await db.newsletter_templates
			.where({ id: templateId, organizationId: orgId, deleted_at: { is: null } })
			.first();

		return result?.data || null;
	} catch (error) {
		console.error('[Newsletter] Error getting template:', error);
		return null;
	}
}

/**
 * Create a new template
 */
export async function createTemplate(
	event: RequestEvent,
	input: CreateTemplateInput
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_templates) {
			return { success: false, error: 'Newsletter templates table not found' };
		}

		const template: NewsletterTemplate = {
			id: crypto.randomUUID(),
			organizationId: orgId,
			name: input.name,
			subject: input.subject,
			html: input.html,
			text: input.text,
			previewText: input.previewText,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		await db.newsletter_templates.insert(template);

		return { success: true, id: template.id, data: template };
	} catch (error: any) {
		console.error('[Newsletter] Error creating template:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Delete a template
 */
export async function deleteTemplate(
	event: RequestEvent,
	templateId: string
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_templates) {
			return { success: false, error: 'Newsletter templates table not found' };
		}

		await db.newsletter_templates
			.where({ id: templateId, organizationId: orgId })
			.update({ deleted_at: new Date().toISOString() });

		return { success: true };
	} catch (error: any) {
		console.error('[Newsletter] Error deleting template:', error);
		return { success: false, error: error.message };
	}
}

// ============================================================================
// BROADCASTS
// ============================================================================

/**
 * List all broadcasts
 */
export async function listBroadcasts(event: RequestEvent): Promise<NewsletterBroadcast[]> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_broadcasts) return [];

		const result = await db.newsletter_broadcasts
			.where({ organizationId: orgId, deleted_at: { is: null } })
			.orderBy({ created_at: 'desc' })
			.limit(50)
			.many();

		return result?.data || [];
	} catch (error) {
		console.error('[Newsletter] Error listing broadcasts:', error);
		return [];
	}
}

/**
 * Create a new broadcast
 */
export async function createBroadcast(
	event: RequestEvent,
	input: CreateBroadcastInput
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_broadcasts) {
			return { success: false, error: 'Newsletter broadcasts table not found' };
		}

		const broadcast: NewsletterBroadcast = {
			id: crypto.randomUUID(),
			organizationId: orgId,
			segmentId: input.segmentId,
			name: input.name,
			subject: input.subject,
			html: input.html,
			text: input.text,
			previewText: input.previewText,
			status: input.scheduledAt ? 'scheduled' : 'draft',
			scheduledAt: input.scheduledAt,
			recipientCount: 0,
			successCount: 0,
			failureCount: 0,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		await db.newsletter_broadcasts.insert(broadcast);

		return { success: true, id: broadcast.id, data: broadcast };
	} catch (error: any) {
		console.error('[Newsletter] Error creating broadcast:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Send a broadcast (immediately or schedule it)
 */
export async function sendBroadcast(
	event: RequestEvent,
	broadcastId: string,
	scheduledAt?: string
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_broadcasts || !sesClient) {
			return { success: false, error: 'Newsletter not properly configured' };
		}

		// Get broadcast
		const broadcastResult = await db.newsletter_broadcasts
			.where({ id: broadcastId, organizationId: orgId })
			.first();

		const broadcast = broadcastResult?.data;
		if (!broadcast) {
			return { success: false, error: 'Broadcast not found' };
		}

		// Get contacts from segment
		const { contacts } = await listSegmentContacts(event, broadcast.segmentId, pluginOptions?.maxContactsPerLaunch || 1000);

		if (contacts.length === 0) {
			return { success: false, error: 'No contacts in segment' };
		}

		// Filter out unsubscribed contacts
		const activeContacts = contacts.filter(c => !c.unsubscribed);

		// Send emails
		let successCount = 0;
		let failureCount = 0;

		for (const contact of activeContacts) {
			try {
				const from = pluginOptions?.sesFromName && pluginOptions?.sesFrom
					? `${pluginOptions.sesFromName} <${pluginOptions.sesFrom}>`
					: pluginOptions?.sesFrom || 'noreply@example.com';

				const content: any = {
					Simple: {
						Subject: { Data: broadcast.subject, Charset: 'UTF-8' },
						Body: {}
					}
				};

				if (broadcast.html) {
					content.Simple.Body.Html = { Data: broadcast.html, Charset: 'UTF-8' };
				}
				if (broadcast.text) {
					content.Simple.Body.Text = { Data: broadcast.text, Charset: 'UTF-8' };
				}

				const params: any = {
					FromEmailAddress: from,
					Destination: { ToAddresses: [contact.email] },
					Content: content
				};

				if (pluginOptions?.sesConfigurationSetName) {
					params.ConfigurationSetName = pluginOptions.sesConfigurationSetName;
				}

				const command = new SendEmailCommand(params);
				const result = await sesClient.send(command);

				// Track sent email
				if (db.newsletter_sent_emails) {
					const sentEmail: NewsletterSentEmail = {
						id: crypto.randomUUID(),
						organizationId: orgId,
						contactId: contact.id,
						email: contact.email,
						type: 'broadcast',
						broadcastId: broadcast.id,
						subject: broadcast.subject,
						sesMessageId: result.MessageId,
						status: 'sent',
						sentAt: new Date().toISOString(),
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					};
					await db.newsletter_sent_emails.insert(sentEmail);
				}

				successCount++;
			} catch (error: any) {
				console.error(`[Newsletter] Failed to send to ${contact.email}:`, error);
				failureCount++;

				// Track failed email
				if (db.newsletter_sent_emails) {
					const sentEmail: NewsletterSentEmail = {
						id: crypto.randomUUID(),
						organizationId: orgId,
						contactId: contact.id,
						email: contact.email,
						type: 'broadcast',
						broadcastId: broadcast.id,
						subject: broadcast.subject,
						status: 'failed',
						error: error.message,
						failedAt: new Date().toISOString(),
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					};
					await db.newsletter_sent_emails.insert(sentEmail);
				}
			}
		}

		// Update broadcast status
		await db.newsletter_broadcasts
			.where({ id: broadcastId })
			.update({
				status: 'sent',
				sentAt: new Date().toISOString(),
				recipientCount: activeContacts.length,
				successCount,
				failureCount,
				updated_at: new Date().toISOString(),
			});

		return {
			success: true,
			data: {
				recipientCount: activeContacts.length,
				successCount,
				failureCount
			}
		};
	} catch (error: any) {
		console.error('[Newsletter] Error sending broadcast:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Delete a broadcast
 */
export async function deleteBroadcast(
	event: RequestEvent,
	broadcastId: string
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_broadcasts) {
			return { success: false, error: 'Newsletter broadcasts table not found' };
		}

		await db.newsletter_broadcasts
			.where({ id: broadcastId, organizationId: orgId })
			.update({ deleted_at: new Date().toISOString() });

		return { success: true };
	} catch (error: any) {
		console.error('[Newsletter] Error deleting broadcast:', error);
		return { success: false, error: error.message };
	}
}

// ============================================================================
// DRIP CAMPAIGNS
// ============================================================================

/**
 * List all drip campaigns
 */
export async function listCampaigns(event: RequestEvent): Promise<NewsletterCampaign[]> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_campaigns) return [];

		const result = await db.newsletter_campaigns
			.where({ organizationId: orgId, deleted_at: { is: null } })
			.orderBy({ created_at: 'desc' })
			.many();

		return result?.data || [];
	} catch (error) {
		console.error('[Newsletter] Error listing campaigns:', error);
		return [];
	}
}

/**
 * Get campaign with steps
 */
export async function getCampaign(
	event: RequestEvent,
	campaignId: string
): Promise<(NewsletterCampaign & { steps: NewsletterCampaignStep[] }) | null> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_campaigns || !db?.newsletter_campaign_steps) return null;

		const campaignResult = await db.newsletter_campaigns
			.where({ id: campaignId, organizationId: orgId, deleted_at: { is: null } })
			.first();

		const campaign = campaignResult?.data;
		if (!campaign) return null;

		const stepsResult = await db.newsletter_campaign_steps
			.where({ campaignId, deleted_at: { is: null } })
			.orderBy({ stepOrder: 'asc' })
			.many();

		return {
			...campaign,
			steps: stepsResult?.data || []
		};
	} catch (error) {
		console.error('[Newsletter] Error getting campaign:', error);
		return null;
	}
}

/**
 * Create or update a drip campaign
 */
export async function saveCampaign(
	event: RequestEvent,
	input: CreateCampaignInput & { id?: string }
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_campaigns || !db?.newsletter_campaign_steps) {
			return { success: false, error: 'Newsletter campaigns tables not found' };
		}

		const now = new Date().toISOString();
		let campaignId = input.id || crypto.randomUUID();

		// Check if campaign exists
		const existingResult = await db.newsletter_campaigns
			.where({ id: campaignId, organizationId: orgId })
			.first();

		if (existingResult?.data) {
			// Update existing campaign
			await db.newsletter_campaigns
				.where({ id: campaignId })
				.update({
					name: input.name,
					description: input.description,
					segmentId: input.segmentId,
					startAt: input.startAt,
					updated_at: now,
				});
		} else {
			// Create new campaign
			const campaign: NewsletterCampaign = {
				id: campaignId,
				organizationId: orgId,
				segmentId: input.segmentId,
				name: input.name,
				description: input.description,
				status: 'draft',
				startAt: input.startAt,
				contactsTargeted: 0,
				totalScheduled: 0,
				created_at: now,
				updated_at: now,
			};
			await db.newsletter_campaigns.insert(campaign);
		}

		// Delete existing steps
		await db.newsletter_campaign_steps.delete({ campaignId });

		// Insert new steps
		for (let i = 0; i < input.steps.length; i++) {
			const stepInput = input.steps[i];
			const step: NewsletterCampaignStep = {
				id: stepInput.id || crypto.randomUUID(),
				campaignId,
				organizationId: orgId,
				stepOrder: i,
				label: stepInput.label,
				subject: stepInput.subject,
				html: stepInput.html,
				text: stepInput.text,
				previewText: stepInput.previewText,
				scheduleMode: stepInput.scheduleMode,
				sendAt: stepInput.sendAt,
				delayMinutes: stepInput.delayMinutes,
				status: 'draft',
				monitorEvent: stepInput.monitorEvent,
				successStepId: stepInput.successStepId,
				fallbackStepId: stepInput.fallbackStepId,
				evaluateAfterMinutes: stepInput.evaluateAfterMinutes,
				created_at: now,
				updated_at: now,
			};
			await db.newsletter_campaign_steps.insert(step);
		}

		return { success: true, id: campaignId };
	} catch (error: any) {
		console.error('[Newsletter] Error saving campaign:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Delete a campaign
 */
export async function deleteCampaign(
	event: RequestEvent,
	campaignId: string
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_campaigns) {
			return { success: false, error: 'Newsletter campaigns table not found' };
		}

		await db.newsletter_campaigns
			.where({ id: campaignId, organizationId: orgId })
			.update({ deleted_at: new Date().toISOString() });

		// Also delete steps
		if (db.newsletter_campaign_steps) {
			await db.newsletter_campaign_steps
				.where({ campaignId })
				.update({ deleted_at: new Date().toISOString() });
		}

		return { success: true };
	} catch (error: any) {
		console.error('[Newsletter] Error deleting campaign:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Launch a drip campaign
 */
export async function launchCampaign(
	event: RequestEvent,
	campaignId: string,
	startAt?: string
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_campaigns || !db?.newsletter_campaign_steps || !sesClient) {
			return { success: false, error: 'Newsletter not properly configured' };
		}

		// Get campaign with steps
		const campaign = await getCampaign(event, campaignId);
		if (!campaign || campaign.steps.length === 0) {
			return { success: false, error: 'Campaign not found or has no steps' };
		}

		// Get contacts
		const { contacts } = await listSegmentContacts(
			event,
			campaign.segmentId,
			pluginOptions?.maxContactsPerLaunch || 1000
		);

		const activeContacts = contacts.filter(c => !c.unsubscribed);
		if (activeContacts.length === 0) {
			return { success: false, error: 'No active contacts in segment' };
		}

		const startTime = startAt ? new Date(startAt) : campaign.startAt ? new Date(campaign.startAt) : new Date();
		let totalScheduled = 0;

		// Schedule first step for each contact
		const firstStep = campaign.steps[0];
		for (const contact of activeContacts) {
			try {
				await scheduleStepForContact(event, campaign, firstStep, contact, startTime, db);
				totalScheduled++;
			} catch (error) {
				console.error(`[Newsletter] Failed to schedule for contact ${contact.email}:`, error);
			}
		}

		// Update campaign
		await db.newsletter_campaigns
			.where({ id: campaignId })
			.update({
				status: 'active',
				lastLaunchAt: new Date().toISOString(),
				contactsTargeted: activeContacts.length,
				totalScheduled: (campaign.totalScheduled || 0) + totalScheduled,
				updated_at: new Date().toISOString(),
			});

		// Update steps status
		await db.newsletter_campaign_steps
			.where({ campaignId })
			.update({ status: 'scheduled' });

		return {
			success: true,
			data: {
				contacts: activeContacts.length,
				scheduledEmails: totalScheduled
			}
		};
	} catch (error: any) {
		console.error('[Newsletter] Error launching campaign:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Schedule a campaign step for a contact (recursive for chaining steps)
 */
async function scheduleStepForContact(
	event: RequestEvent,
	campaign: NewsletterCampaign & { steps: NewsletterCampaignStep[] },
	step: NewsletterCampaignStep,
	contact: NewsletterContact,
	baseTime: Date,
	db: any
): Promise<void> {
	if (!sesClient) return;

	// Calculate scheduled time
	const scheduledAt = step.scheduleMode === 'absolute' && step.sendAt
		? new Date(step.sendAt)
		: new Date(baseTime.getTime() + step.delayMinutes * 60 * 1000);

	// Send email via SES
	const from = pluginOptions?.sesFromName && pluginOptions?.sesFrom
		? `${pluginOptions.sesFromName} <${pluginOptions.sesFrom}>`
		: pluginOptions?.sesFrom || 'noreply@example.com';

	const content: any = {
		Simple: {
			Subject: { Data: step.subject, Charset: 'UTF-8' },
			Body: {}
		}
	};

	if (step.html) {
		content.Simple.Body.Html = { Data: step.html, Charset: 'UTF-8' };
	}
	if (step.text) {
		content.Simple.Body.Text = { Data: step.text, Charset: 'UTF-8' };
	}

	const params: any = {
		FromEmailAddress: from,
		Destination: { ToAddresses: [contact.email] },
		Content: content,
		EmailTags: [
			{ Name: 'campaign_id', Value: campaign.id },
			{ Name: 'step_id', Value: step.id },
			{ Name: 'contact_id', Value: contact.id }
		]
	};

	if (pluginOptions?.sesConfigurationSetName) {
		params.ConfigurationSetName = pluginOptions.sesConfigurationSetName;
	}

	const command = new SendEmailCommand(params);
	const result = await sesClient.send(command);

	// Track sent email
	if (db.newsletter_sent_emails) {
		const sentEmail: NewsletterSentEmail = {
			id: crypto.randomUUID(),
			organizationId: campaign.organizationId,
			contactId: contact.id,
			email: contact.email,
			type: 'campaign',
			campaignId: campaign.id,
			campaignStepId: step.id,
			subject: step.subject,
			sesMessageId: result.MessageId,
			status: 'sent',
			scheduledAt: scheduledAt.toISOString(),
			sentAt: new Date().toISOString(),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};
		await db.newsletter_sent_emails.insert(sentEmail);

		// If step has branching, create branch check
		if (step.monitorEvent && (step.successStepId || step.fallbackStepId) && db.newsletter_branch_checks) {
			const branchCheck: NewsletterBranchCheck = {
				id: crypto.randomUUID(),
				organizationId: campaign.organizationId,
				campaignId: campaign.id,
				stepId: step.id,
				contactId: contact.id,
				sentEmailId: sentEmail.id,
				monitorEvent: step.monitorEvent,
				successStepId: step.successStepId,
				fallbackStepId: step.fallbackStepId,
				evaluateAt: new Date(scheduledAt.getTime() + (step.evaluateAfterMinutes || 1440) * 60 * 1000).toISOString(),
				baseTime: scheduledAt.toISOString(),
				processed: false,
				created_at: new Date().toISOString(),
			};
			await db.newsletter_branch_checks.insert(branchCheck);
			return; // Don't schedule next step yet, wait for branch evaluation
		}
	}

	// Schedule next step if no branching
	const nextStep = campaign.steps.find(s => s.stepOrder === step.stepOrder + 1);
	if (nextStep) {
		await scheduleStepForContact(event, campaign, nextStep, contact, scheduledAt, db);
	}
}

/**
 * Process branch checks (call this periodically via cron)
 */
export async function processCampaignBranches(
	event: RequestEvent,
	limit: number = 25
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_branch_checks || !db?.newsletter_sent_emails) {
			return { success: false, error: 'Newsletter tables not found' };
		}

		// Get ready-to-process branches
		const now = new Date().toISOString();
		const branchesResult = await db.newsletter_branch_checks
			.where({
				organizationId: orgId,
				processed: false,
				evaluateAt: { lte: now }
			})
			.limit(limit)
			.many();

		const branches = branchesResult?.data || [];
		if (branches.length === 0) {
			return { success: true, data: { processed: 0 } };
		}

		let processed = 0;

		for (const branch of branches) {
			try {
				// Get sent email status
				const sentEmailResult = await db.newsletter_sent_emails
					.where({ id: branch.sentEmailId })
					.first();

				const sentEmail = sentEmailResult?.data;
				if (!sentEmail) continue;

				// Determine if condition met based on status
				const success = branch.monitorEvent === 'clicked'
					? sentEmail.status === 'clicked'
					: sentEmail.status === 'opened' || sentEmail.status === 'clicked';

				const nextStepId = success ? branch.successStepId : branch.fallbackStepId;

				if (nextStepId) {
					// Get campaign and contact
					const campaign = await getCampaign(event, branch.campaignId);
					const contactResult = await db.newsletter_contacts
						.where({ id: branch.contactId })
						.first();

					if (campaign && contactResult?.data) {
						const nextStep = campaign.steps.find(s => s.id === nextStepId);
						if (nextStep) {
							await scheduleStepForContact(
								event,
								campaign,
								nextStep,
								contactResult.data,
								new Date(branch.evaluateAt),
								db
							);
						}
					}
				}

				// Mark as processed
				await db.newsletter_branch_checks
					.where({ id: branch.id })
					.update({
						processed: true,
						processedAt: new Date().toISOString()
					});

				processed++;
			} catch (error) {
				console.error('[Newsletter] Error processing branch:', error);
			}
		}

		return { success: true, data: { processed } };
	} catch (error: any) {
		console.error('[Newsletter] Error processing campaign branches:', error);
		return { success: false, error: error.message };
	}
}

// ============================================================================
// AUDIENCE MANAGEMENT
// ============================================================================

/**
 * List all contacts in the organization with segment information
 */
export async function listAudienceContacts(
	event: RequestEvent,
	limit: number = 50,
	offset: number = 0,
	search?: string
): Promise<{ contacts: any[]; total: number; hasMore: boolean }> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_contacts || !db?.newsletter_segments || !db?.newsletter_segment_contacts) {
			return { contacts: [], total: 0, hasMore: false };
		}

		// Build base where clause
		const baseWhere: any = { organizationId: orgId, deleted_at: { is: null } };
		if (search) {
			// Use LIKE for case-insensitive search
			baseWhere.email = { like: `%${search}%` };
		}

		// Get total count
		const countResult = await db.newsletter_contacts.count(baseWhere);
		const countData = countResult?.data?.[0]?.count ?? countResult?.data ?? 0;
		const total = typeof countData === 'number' ? countData : 0;

		// Build query for fetching
		let query = db.newsletter_contacts.where(baseWhere);

		// Get contacts with pagination
		const contactsResult = await query
			.limit(limit + 1)
			.offset(offset)
			.orderBy({ created_at: 'desc' })
			.many();

		const contacts = contactsResult?.data || [];
		const hasMore = contacts.length > limit;
		const paginatedContacts = contacts.slice(0, limit);

		// Get segment information for each contact
		for (const contact of paginatedContacts) {
			const segmentContactsResult = await db.newsletter_segment_contacts
				.where({ contactId: contact.id })
				.many();

			const segmentContacts = segmentContactsResult?.data || [];
			const segmentIds = segmentContacts.map((sc: any) => sc.segmentId);

			// Get segment names
			if (segmentIds.length > 0) {
				const segmentsResult = await db.newsletter_segments
					.where({ id: { in: segmentIds } })
					.many();
				const segments = segmentsResult?.data || [];
				contact.segments = segments.map((s: any) => s.name);
			} else {
				contact.segments = [];
			}

			contact.segmentCount = contact.segments.length;
		}

		return { contacts: paginatedContacts, total, hasMore };
	} catch (error) {
		console.error('[Newsletter] Error listing audience contacts:', error);
		return { contacts: [], total: 0, hasMore: false };
	}
}

/**
 * Add a new contact to the audience
 */
export async function addAudienceContact(
	event: RequestEvent,
	input: {
		email: string;
		firstName?: string;
		lastName?: string;
		segmentIds?: string[];
	}
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_contacts) {
			return { success: false, error: 'Newsletter contacts table not found' };
		}

		// Check if contact already exists
		const existingResult = await db.newsletter_contacts
			.where({ organizationId: orgId, email: input.email, deleted_at: { is: null } })
			.first();

		let contactId: string;
		if (existingResult?.data) {
			contactId = existingResult.data.id;
		} else {
			// Create new contact
			const contact: NewsletterContact = {
				id: crypto.randomUUID(),
				organizationId: orgId,
				email: input.email,
				firstName: input.firstName,
				lastName: input.lastName,
				unsubscribed: false,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};
			await db.newsletter_contacts.insert(contact);
			contactId = contact.id;
		}

		// Add to segments if provided
		if (input.segmentIds && input.segmentIds.length > 0 && db.newsletter_segment_contacts) {
			for (const segmentId of input.segmentIds) {
				// Check if already in segment
				const existingLink = await db.newsletter_segment_contacts
					.where({ segmentId, contactId })
					.first();

				if (!existingLink?.data) {
					await db.newsletter_segment_contacts.insert({
						segmentId,
						contactId,
						added_at: new Date().toISOString(),
					});
				}
			}
		}

		return { success: true, id: contactId };
	} catch (error: any) {
		console.error('[Newsletter] Error adding audience contact:', error);
		console.error('[Newsletter] Error stack:', error?.stack);
		return { success: false, error: error?.message || String(error) || 'Unknown error adding contact' };
	}
}

/**
 * Update an existing contact
 */
export async function updateAudienceContact(
	event: RequestEvent,
	input: {
		contactId: string;
		firstName?: string;
		lastName?: string;
		unsubscribed?: boolean;
	}
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_contacts) {
			return { success: false, error: 'Newsletter contacts table not found' };
		}

		const updateData: any = {
			updated_at: new Date().toISOString(),
		};

		if (input.firstName !== undefined) updateData.firstName = input.firstName;
		if (input.lastName !== undefined) updateData.lastName = input.lastName;
		if (input.unsubscribed !== undefined) {
			updateData.unsubscribed = input.unsubscribed;
			if (input.unsubscribed) {
				updateData.unsubscribedAt = new Date().toISOString();
			}
		}

		await db.newsletter_contacts
			.where({ id: input.contactId, organizationId: orgId })
			.update(updateData);

		return { success: true };
	} catch (error: any) {
		console.error('[Newsletter] Error updating audience contact:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Delete a contact (soft delete)
 */
export async function deleteAudienceContact(
	event: RequestEvent,
	contactId: string
): Promise<NewsletterResult> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_contacts) {
			return { success: false, error: 'Newsletter contacts table not found' };
		}

		await db.newsletter_contacts
			.where({ id: contactId, organizationId: orgId })
			.update({ deleted_at: new Date().toISOString() });

		// Remove from all segments
		if (db.newsletter_segment_contacts) {
			await db.newsletter_segment_contacts.delete({ contactId });
		}

		return { success: true };
	} catch (error: any) {
		console.error('[Newsletter] Error deleting audience contact:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Get audience statistics
 */
export async function getAudienceStats(
	event: RequestEvent
): Promise<any> {
	try {
		const orgId = getOrgId(event);
		const db = await getDb(event, orgId);
		if (!db?.newsletter_contacts || !db?.newsletter_segments) {
			return {
				totalContacts: 0,
				activeContacts: 0,
				unsubscribedContacts: 0,
				segmentsCount: 0,
				avgContactsPerSegment: 0,
				recentGrowth: {
					newThisWeek: 0,
					newThisMonth: 0
				}
			};
		}

		// Get total contacts
		const totalResult = await db.newsletter_contacts.count({ organizationId: orgId, deleted_at: { is: null } });
		const totalData = totalResult?.data?.[0]?.count ?? totalResult?.data ?? 0;
		const totalContacts = typeof totalData === 'number' ? totalData : 0;

		// Get active contacts
		const activeResult = await db.newsletter_contacts.count({ organizationId: orgId, deleted_at: { is: null }, unsubscribed: false });
		const activeData = activeResult?.data?.[0]?.count ?? activeResult?.data ?? 0;
		const activeContacts = typeof activeData === 'number' ? activeData : 0;

		// Get unsubscribed contacts
		const unsubscribedContacts = totalContacts - activeContacts;

		// Get segments count
		const segmentsResult = await db.newsletter_segments.count({ organizationId: orgId, deleted_at: { is: null } });
		const segmentsData = segmentsResult?.data?.[0]?.count ?? segmentsResult?.data ?? 0;
		const segmentsCount = typeof segmentsData === 'number' ? segmentsData : 0;

		// Calculate average contacts per segment
		const avgContactsPerSegment = segmentsCount > 0 ? Math.round(activeContacts / segmentsCount) : 0;

		// Get recent growth
		const oneWeekAgo = new Date();
		oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
		const oneMonthAgo = new Date();
		oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

		const newThisWeekResult = await db.newsletter_contacts.count({ 
			organizationId: orgId, 
			deleted_at: { is: null },
			created_at: { gte: oneWeekAgo.toISOString() }
		});
		const newThisWeekData = newThisWeekResult?.data?.[0]?.count ?? newThisWeekResult?.data ?? 0;
		const newThisWeek = typeof newThisWeekData === 'number' ? newThisWeekData : 0;

		const newThisMonthResult = await db.newsletter_contacts.count({ 
			organizationId: orgId, 
			deleted_at: { is: null },
			created_at: { gte: oneMonthAgo.toISOString() }
		});
		const newThisMonthData = newThisMonthResult?.data?.[0]?.count ?? newThisMonthResult?.data ?? 0;
		const newThisMonth = typeof newThisMonthData === 'number' ? newThisMonthData : 0;

		return {
			totalContacts,
			activeContacts,
			unsubscribedContacts,
			segmentsCount,
			avgContactsPerSegment,
			recentGrowth: {
				newThisWeek,
				newThisMonth
			}
		};
	} catch (error) {
		console.error('[Newsletter] Error getting audience stats:', error);
		return {
			totalContacts: 0,
			activeContacts: 0,
			unsubscribedContacts: 0,
			segmentsCount: 0,
			avgContactsPerSegment: 0,
			recentGrowth: {
				newThisWeek: 0,
				newThisMonth: 0
			}
		};
	}
}
