import { getRequestEvent, query, command } from '$app/server';import { getRequestEvent, query, command, form } from '$app/server';

import { error } from '@sveltejs/kit';import { error } from '@sveltejs/kit';

import * as v from 'valibot';import { env } from '$env/dynamic/private';

import * as newsletter from 'kuratchi-sdk/newsletter';import * as v from 'valibot';

import * as newsletter from 'kuratchi-sdk/newsletter';

// Helpers

const ensureSession = () => {// Helpers

	const event = getRequestEvent();const ensureSession = () => {

	const session = event.locals.session;  const event = getRequestEvent();

	if (!session?.user) {  const session = event.locals.session;

		error(401, 'Unauthorized');  if (!session?.user) {

	}    error(401, 'Unauthorized');

	return { event, session };  }

};  return { event, session };

};

const guardedQuery = <R>(fn: () => Promise<R>) => {

	return query(async () => {const guardedQuery = <R>(fn: () => Promise<R>) => {

		ensureSession();  return query(async () => {

		return fn();    ensureSession();

	});    return fn();

};  });

};

const guardedCommand = <Schema extends v.BaseSchema<any, any, any>>(

	schema: Schema,const guardedCommand = <Schema extends v.BaseSchema<any, any>>(

	fn: (data: v.InferOutput<Schema>) => Promise<any>  schema: Schema,

) => {  fn: (data: v.InferOutput<Schema>) => Promise<any>

	return command(schema, async (data: v.InferOutput<Schema>) => {) => {

		ensureSession();  return command(schema, async (data: v.InferOutput<Schema>) => {

		return fn(data);    ensureSession();

	});    return fn(data);

};  });

};

// Types for compatibility with existing UI

export type SegmentSummary = {const guardedForm = <Schema extends v.BaseSchema<any, any>>(

	id: string;  schema: Schema,

	name: string;  fn: (data: v.InferOutput<Schema>) => Promise<any>

	created_at: string;) => {

	subscriberCount?: number | null;  return form(schema, async (data: v.InferOutput<Schema>) => {

};    ensureSession();

    return fn(data);

export type SegmentContact = {  });

	id: string;};

	email: string;

	first_name?: string;// Types

	last_name?: string;export type SegmentSummary = {

	created_at: string;  id: string;

	unsubscribed: boolean;  name: string;

};  created_at: string;

  subscriberCount?: number | null;

export type EmailTemplate = {};

	id: string;

	name: string;export type SegmentContact = {

	subject?: string;  id: string;

	html?: string;  email: string;

	created_at?: string;  first_name?: string;

	updated_at?: string;  last_name?: string;

	[key: string]: any;  created_at: string;

};  unsubscribed: boolean;

};

export type DripStepBranching = {

	monitor?: 'opened' | 'clicked';export type EmailTemplate = {

	successStepId?: string;  id: string;

	fallbackStepId?: string;  name: string;

	evaluateAfterMinutes: number;  subject?: string;

};  html?: string;

  created_at?: string;

export type DripStepRecord = {  updated_at?: string;

	id: string;  [key: string]: any;

	label: string;};

	subject: string;

	previewText?: string | null;export type DripStepBranching = {

	html?: string | null;  monitor?: 'opened' | 'clicked';

	text?: string | null;  successStepId?: string;

	scheduleMode: 'relative' | 'absolute';  fallbackStepId?: string;

	sendAt?: string | null;  evaluateAfterMinutes: number;

	delayMinutes: number;};

	status: 'draft' | 'scheduled' | 'completed';

	resendEmailIds?: string[];export type DripStepRecord = {

	branching?: DripStepBranching | null;  id: string;

};  label: string;

  subject: string;

export type DripCampaignRecord = {  previewText?: string | null;

	id: string;  html?: string | null;

	name: string;  text?: string | null;

	description?: string | null;  scheduleMode: 'relative' | 'absolute';

	segmentId: string;  sendAt?: string | null;

	segmentName?: string | null;  delayMinutes: number;

	status: 'draft' | 'active' | 'paused' | 'completed';  status: 'draft' | 'scheduled' | 'completed';

	startAt?: string | null;  resendEmailIds?: string[];

	createdAt: string;  branching?: DripStepBranching | null;

	updatedAt: string;};

	lastLaunchAt?: string | null;

	metrics: {export type DripCampaignRecord = {

		contactsTargeted: number;  id: string;

		totalScheduled: number;  name: string;

		totalSteps: number;  description?: string | null;

	};  segmentId: string;

	steps: DripStepRecord[];  segmentName?: string | null;

};  status: 'draft' | 'active' | 'paused' | 'completed';

  startAt?: string | null;

const toMinutes = (value: number, unit: 'minutes' | 'hours' | 'days') => {  createdAt: string;

	switch (unit) {  updatedAt: string;

		case 'days':  lastLaunchAt?: string | null;

			return value * 24 * 60;  metrics: {

		case 'hours':    contactsTargeted: number;

			return value * 60;    totalScheduled: number;

		default:    totalSteps: number;

			return value;  };

	}  steps: DripStepRecord[];

};};



// ============================================================================const DRIP_KV_PREFIX = 'newsletter:drips:';

// SEGMENTSconst MAX_CONTACTS_PER_LAUNCH = 200;

// ============================================================================const DRIP_BRANCHES_PREFIX = 'newsletter:drips:branches:';



export const listSegments = guardedQuery(async (): Promise<SegmentSummary[]> => {type KVNamespace = {

	try {  get: (key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number }) => Promise<any>;

		const { event } = ensureSession();  put: (key: string, value: string | ArrayBuffer | ReadableStream, options?: { expiration?: number; expirationTtl?: number; metadata?: any }) => Promise<void>;

		const segments = await newsletter.listSegments(event);};

		return segments.map((s) => ({

			id: s.id,const getKvContext = async () => {

			name: s.name,  const { event, session } = ensureSession();

			created_at: s.created_at,  const orgId = session.user.organizationId;

			subscriberCount: s.subscriberCount || 0,  if (!orgId) {

		}));    error(400, 'Organization context required');

	} catch (err) {  }

		console.error('[newsletter.listSegments] error:', err);  const kv = (event.locals.kuratchi as any)?.getKV?.('KV') || (event.locals.kuratchi as any)?.getKV?.('default');

		return [];  if (!kv) {

	}    error(500, 'KV storage not configured');

});  }

  return { kv: kv as KVNamespace, orgId };

export const createSegment = guardedCommand(};

	v.object({

		name: v.pipe(v.string(), v.nonEmpty('Name is required')),const readDripCampaigns = async (): Promise<DripCampaignRecord[]> => {

	}),  const { kv, orgId } = await getKvContext();

	async ({ name }) => {  const key = `${DRIP_KV_PREFIX}${orgId}`;

		try {  const stored = await kv.get(key, { type: 'json' });

			const { event } = ensureSession();  if (Array.isArray(stored)) {

			const result = await newsletter.createSegment(event, { name });    return stored as DripCampaignRecord[];

  }

			if (!result.success) {  return [];

				error(500, result.error || 'Failed to create segment');};

			}

const writeDripCampaigns = async (campaigns: DripCampaignRecord[]) => {

			// Refresh the segments list  const { kv, orgId } = await getKvContext();

			const listResource = listSegments();  const key = `${DRIP_KV_PREFIX}${orgId}`;

			await listResource.refresh();  await kv.put(key, JSON.stringify(campaigns));

};

			return {

				success: true,const readBranchQueue = async (): Promise<DripBranchCheck[]> => {

				id: result.id,  const { kv, orgId } = await getKvContext();

				segment: {  const key = `${DRIP_BRANCHES_PREFIX}${orgId}`;

					id: result.id,  const stored = await kv.get(key, { type: 'json' });

					name: name,  return Array.isArray(stored) ? (stored as DripBranchCheck[]) : [];

					created_at: new Date().toISOString(),};

					subscriberCount: 0,

				},const writeBranchQueue = async (entries: DripBranchCheck[]) => {

			};  const { kv, orgId } = await getKvContext();

		} catch (err) {  const key = `${DRIP_BRANCHES_PREFIX}${orgId}`;

			console.error('[newsletter.createSegment] error:', err);  await kv.put(key, JSON.stringify(entries));

			const message = err instanceof Error ? err.message : 'Failed to create segment';};

			error(500, message);

		}const enqueueBranchCheck = async (entry: DripBranchCheck) => {

	}  const queue = await readBranchQueue();

);  queue.push(entry);

  await writeBranchQueue(queue);

export const deleteSegment = guardedCommand(};

	v.object({

		segmentId: v.pipe(v.string(), v.nonEmpty()),const normalizeHtml = (value?: string | null, fallback?: string | null) => {

	}),  const html = value?.trim();

	async ({ segmentId }) => {  if (html && html.length > 0) return html;

		try {  const text = fallback?.trim();

			const { event } = ensureSession();  return text ? `<p>${text}</p>` : '<p></p>';

			const result = await newsletter.deleteSegment(event, segmentId);};



			if (!result.success) {const fetchSegmentContacts = async (segmentId: string, take: number = MAX_CONTACTS_PER_LAUNCH) => {

				error(500, result.error || 'Failed to delete segment');  const resend = getResendClient();

			}  const contacts: SegmentContact[] = [];

  let cursor: string | undefined;

			await listSegments().refresh();  while (contacts.length < take) {

			return { success: true };    const response = await resend.contacts.list({

		} catch (err) {      segmentId,

			console.error('[newsletter.deleteSegment] error:', err);      limit: Math.min(200, take - contacts.length),

			error(500, 'Failed to delete segment');      after: cursor

		}    });

	}    if (response.error) {

);      throw new Error(response.error.message);

    }

// ============================================================================    const batch = response.data?.data ?? [];

// CONTACTS    contacts.push(

// ============================================================================      ...batch.map((contact) => ({

        id: contact.id,

export const listSegmentContacts = guardedCommand(        email: contact.email,

	v.object({        first_name: contact.first_name,

		segmentId: v.pipe(v.string(), v.nonEmpty()),        last_name: contact.last_name,

		limit: v.optional(v.number()),        created_at: contact.created_at,

	}),        unsubscribed: contact.unsubscribed

	async ({ segmentId, limit = 50 }) => {      }))

		try {    );

			const { event } = ensureSession();    if (!response.data?.has_more || batch.length === 0) {

			const result = await newsletter.listSegmentContacts(event, segmentId, limit);      break;

    }

			return {    cursor = batch[batch.length - 1]?.id;

				contacts: result.contacts.map((contact) => ({  }

					id: contact.id,  return contacts;

					email: contact.email,};

					first_name: contact.firstName,

					last_name: contact.lastName,const toMinutes = (value: number, unit: 'minutes' | 'hours' | 'days') => {

					unsubscribed: contact.unsubscribed,  switch (unit) {

					created_at: contact.created_at,    case 'days':

				})),      return value * 24 * 60;

				hasMore: result.hasMore,    case 'hours':

			};      return value * 60;

		} catch (err) {    default:

			console.error('[newsletter.listSegmentContacts] error:', err);      return value;

			error(500, 'Failed to load contacts');  }

		}};

	}

);const defaultFromAddress = () => {

  if (env.RESEND_FROM_EMAIL) return env.RESEND_FROM_EMAIL;

export const addSegmentContact = guardedCommand(  if (env.RESEND_FROM) return env.RESEND_FROM;

	v.object({  return 'Kuratchi <no-reply@kuratchi.dev>';

		segmentId: v.pipe(v.string(), v.nonEmpty()),};

		email: v.pipe(v.string(), v.nonEmpty()),

		firstName: v.optional(v.string()),const buildStepGraph = (campaign: DripCampaignRecord) => {

		lastName: v.optional(v.string()),  const stepOrder = campaign.steps.map((step) => step.id);

	}),  const stepMap = new Map(campaign.steps.map((step) => [step.id, step]));

	async ({ segmentId, email, firstName, lastName }) => {  const defaultNext = new Map<string, string | null>();

		try {  for (let i = 0; i < stepOrder.length; i += 1) {

			const { event } = ensureSession();    const current = stepOrder[i];

			const result = await newsletter.addContactToSegment(event, {    const next = i + 1 < stepOrder.length ? stepOrder[i + 1] : null;

				segmentId,    defaultNext.set(current, next);

				email,  }

				firstName,  return { stepMap, defaultNext };

				lastName,};

			});

const resolveScheduleTime = (step: DripStepRecord, baseTime: Date) => {

			if (!result.success) {  if (step.scheduleMode === 'absolute' && step.sendAt) {

				error(500, result.error || 'Failed to add subscriber');    return new Date(step.sendAt);

			}  }

  const scheduled = new Date(baseTime);

			return { success: true, id: result.id };  scheduled.setMinutes(scheduled.getMinutes() + step.delayMinutes);

		} catch (err) {  return scheduled;

			console.error('[newsletter.addSegmentContact] error:', err);};

			error(500, 'Failed to add subscriber');

		}const scheduleStepForContact = async ({

	}  campaign,

);  stepId,

  contact,

export const removeSegmentContact = guardedCommand(  baseTime,

	v.object({  resend,

		segmentId: v.pipe(v.string(), v.nonEmpty()),  stepMap,

		contactId: v.optional(v.string()),  defaultNext

		email: v.optional(v.string()),}: {

	}),  campaign: DripCampaignRecord;

	async ({ segmentId, contactId, email }) => {  stepId: string;

		try {  contact: SegmentContact;

			if (!contactId && !email) {  baseTime: Date;

				error(400, 'Contact identifier required');  resend: Resend;

			}  stepMap: Map<string, DripStepRecord>;

  defaultNext: Map<string, string | null>;

			const { event } = ensureSession();}) => {

			const result = await newsletter.removeContactFromSegment(event, segmentId, contactId, email);  const step = stepMap.get(stepId);

  if (!step) return;

			if (!result.success) {  const scheduledAt = resolveScheduleTime(step, baseTime);

				error(500, result.error || 'Failed to remove subscriber');  const response = await resend.emails.send({

			}    from: defaultFromAddress(),

    to: contact.email,

			return { success: true };    subject: step.subject,

		} catch (err) {    html: normalizeHtml(step.html, step.text),

			console.error('[newsletter.removeSegmentContact] error:', err);    text: step.text?.trim() ? step.text : undefined,

			error(500, 'Failed to remove subscriber');    scheduled_at: scheduledAt.toISOString(),

		}    tags: [

	}      { name: 'drip_campaign', value: campaign.id },

);      { name: 'drip_step', value: step.id }

    ]

// ============================================================================  });

// TEMPLATES

// ============================================================================  if (step.branching && (step.branching.successStepId || step.branching.fallbackStepId) && response.data?.id) {

    await enqueueBranchCheck({

export const listTemplates = guardedQuery(async (): Promise<EmailTemplate[]> => {      id: crypto.randomUUID(),

	try {      campaignId: campaign.id,

		const { event } = ensureSession();      stepId: step.id,

		const templates = await newsletter.listTemplates(event);      contact: {

		return templates;        id: contact.id,

	} catch (err) {        email: contact.email,

		console.error('[newsletter.listTemplates] error:', err);        first_name: contact.first_name,

		return [];        last_name: contact.last_name,

	}        unsubscribed: contact.unsubscribed

});      },

      resendEmailId: response.data.id,

export const getTemplate = guardedCommand(      monitor: step.branching.monitor ?? 'opened',

	v.object({      successStepId: step.branching.successStepId,

		templateId: v.pipe(v.string(), v.nonEmpty()),      fallbackStepId: step.branching.fallbackStepId,

	}),      evaluateAt: new Date(

	async ({ templateId }): Promise<EmailTemplate | null> => {        scheduledAt.getTime() + step.branching.evaluateAfterMinutes * 60 * 1000

		try {      ).toISOString(),

			const { event } = ensureSession();      baseTime: scheduledAt.toISOString()

			const template = await newsletter.getTemplate(event, templateId);    });

			return template;    return;

		} catch (err) {  }

			console.error('[newsletter.getTemplate] error:', err);

			return null;  const nextStepId = defaultNext.get(step.id);

		}  if (nextStepId) {

	}    await scheduleStepForContact({

);      campaign,

      stepId: nextStepId,

export const createTemplate = guardedCommand(      contact,

	v.object({      baseTime: scheduledAt,

		name: v.pipe(v.string(), v.nonEmpty()),      resend,

		subject: v.pipe(v.string(), v.nonEmpty()),      stepMap,

		html: v.pipe(v.string(), v.nonEmpty()),      defaultNext

	}),    });

	async ({ name, subject, html }) => {  }

		try {};

			const { event } = ensureSession();

			const result = await newsletter.createTemplate(event, { name, subject, html });// Segments -------------------------------------------------

export const listSegments = guardedQuery(async (): Promise<SegmentSummary[]> => {

			if (!result.success) {  try {

				error(500, result.error || 'Failed to create template');    const resend = getResendClient();

			}    const response = await resend.segments.list({ limit: 100 });

    if (response.error) {

			await listTemplates().refresh();      throw new Error(response.error.message);

			return { success: true, id: result.id };    }

		} catch (err) {    const segments = response.data?.data ?? [];

			console.error('[newsletter.createTemplate] error:', err);    return segments.map((segment: any) => ({

			error(500, 'Failed to create template');      id: segment.id,

		}      name: segment.name,

	}      created_at: segment.created_at,

);      subscriberCount: segment.contacts_count ?? segment.subscriberCount ?? 0

    }));

export const deleteTemplate = guardedCommand(  } catch (err) {

	v.object({    console.error('[newsletter.listSegments] error:', err);

		templateId: v.pipe(v.string(), v.nonEmpty()),    return [];

	}),  }

	async ({ templateId }) => {});

		try {

			const { event } = ensureSession();export const createSegment = guardedCommand(

			const result = await newsletter.deleteTemplate(event, templateId);  v.object({

    name: v.pipe(v.string(), v.nonEmpty('Name is required'))

			if (!result.success) {  }),

				error(500, result.error || 'Failed to delete template');  async ({ name }) => {

			}    try {

      const resend = getResendClient();

			await listTemplates().refresh();      const response = await resend.segments.create({ name });

			return { success: true };      if (response.error) throw new Error(response.error.message);

		} catch (err) {      

			console.error('[newsletter.deleteTemplate] error:', err);      // Refresh the segments list to include the new segment

			error(500, 'Failed to delete template');      const listResource = listSegments();

		}      await listResource.refresh();

	}      

);      return { 

        success: true, 

// ============================================================================        id: response.data?.id,

// BROADCASTS        segment: {

// ============================================================================          id: response.data?.id,

          name: name,

export const listBroadcasts = guardedQuery(async () => {          created_at: new Date().toISOString(),

	try {          subscriberCount: 0

		const { event } = ensureSession();        }

		const broadcasts = await newsletter.listBroadcasts(event);      };

		return broadcasts;    } catch (err) {

	} catch (err) {      console.error('[newsletter.createSegment] error:', err);

		console.error('[newsletter.listBroadcasts] error:', err);      const message = err instanceof Error ? err.message : 'Failed to create segment';

		return [];      error(500, message);

	}    }

});  }

);

export const createBroadcast = guardedCommand(

	v.object({export const deleteSegment = guardedCommand(

		audienceId: v.pipe(v.string(), v.nonEmpty()),  v.object({

		subject: v.pipe(v.string(), v.nonEmpty()),    segmentId: v.pipe(v.string(), v.nonEmpty())

		html: v.optional(v.string()),  }),

		text: v.optional(v.string()),  async ({ segmentId }) => {

		previewText: v.optional(v.string()),    try {

		sendAt: v.optional(v.string()),      const resend = getResendClient();

		name: v.optional(v.string()),      const response = await resend.segments.remove(segmentId);

	}),      if (response.error) throw new Error(response.error.message);

	async ({ audienceId, subject, html, text, previewText, sendAt, name }) => {      await listSegments().refresh();

		try {      return { success: true };

			const { event } = ensureSession();    } catch (err) {

			const result = await newsletter.createBroadcast(event, {      console.error('[newsletter.deleteSegment] error:', err);

				segmentId: audienceId,      error(500, 'Failed to delete segment');

				name: name || subject,    }

				subject,  }

				html,);

				text,

				previewText,export const listSegmentContacts = guardedCommand(

				scheduledAt: sendAt,  v.object({

			});    segmentId: v.pipe(v.string(), v.nonEmpty()),

    limit: v.optional(v.number())

			if (!result.success) {  }),

				error(500, result.error || 'Failed to create broadcast');  async ({ segmentId, limit = 50 }) => {

			}    try {

      const resend = getResendClient();

			await listBroadcasts().refresh();      const response = await resend.contacts.list({

			return { success: true, id: result.id };        segmentId,

		} catch (err) {        limit

			console.error('[newsletter.createBroadcast] error:', err);      });

			const message = err instanceof Error ? err.message : 'Failed to create broadcast';      if (response.error) throw new Error(response.error.message);

			error(500, message);      const data = response.data;

		}      return {

	}        contacts:

);          data?.data?.map((contact) => ({

            id: contact.id,

export const sendBroadcast = guardedCommand(            email: contact.email,

	v.object({            first_name: contact.first_name,

		broadcastId: v.pipe(v.string(), v.nonEmpty()),            last_name: contact.last_name,

		scheduledAt: v.optional(v.string()),            unsubscribed: contact.unsubscribed,

	}),            created_at: contact.created_at

	async ({ broadcastId, scheduledAt }) => {          })) ?? [],

		try {        hasMore: data?.has_more ?? false

			const { event } = ensureSession();      };

			const result = await newsletter.sendBroadcast(event, broadcastId, scheduledAt);    } catch (err) {

      console.error('[newsletter.listSegmentContacts] error:', err);

			if (!result.success) {      error(500, 'Failed to load contacts');

				error(500, result.error || 'Failed to send broadcast');    }

			}  }

);

			await listBroadcasts().refresh();

			return { success: true };export const addSegmentContact = guardedCommand(

		} catch (err) {  v.object({

			console.error('[newsletter.sendBroadcast] error:', err);    segmentId: v.pipe(v.string(), v.nonEmpty()),

			const message = err instanceof Error ? err.message : 'Failed to send broadcast';    email: v.pipe(v.string(), v.nonEmpty()),

			error(500, message);    firstName: v.optional(v.string()),

		}    lastName: v.optional(v.string())

	}  }),

);  async ({ segmentId, email, firstName, lastName }) => {

    try {

export const deleteBroadcast = guardedCommand(      const resend = getResendClient();

	v.object({      const response = await resend.contacts.create({

		broadcastId: v.pipe(v.string(), v.nonEmpty()),        segmentId,

	}),        email,

	async ({ broadcastId }) => {        firstName,

		try {        lastName

			const { event } = ensureSession();      });

			const result = await newsletter.deleteBroadcast(event, broadcastId);      if (response.error) throw new Error(response.error.message);

      return { success: true, id: response.data?.id };

			if (!result.success) {    } catch (err) {

				error(500, result.error || 'Failed to delete broadcast');      console.error('[newsletter.addSegmentContact] error:', err);

			}      error(500, 'Failed to add subscriber');

    }

			await listBroadcasts().refresh();  }

			return { success: true };);

		} catch (err) {

			console.error('[newsletter.deleteBroadcast] error:', err);export const removeSegmentContact = guardedCommand(

			const message = err instanceof Error ? err.message : 'Failed to delete broadcast';  v.object({

			error(500, message);    segmentId: v.pipe(v.string(), v.nonEmpty()),

		}    contactId: v.optional(v.string()),

	}    email: v.optional(v.string())

);  }),

  async ({ segmentId, contactId, email }) => {

// ============================================================================    try {

// DRIP CAMPAIGNS      if (!contactId && !email) {

// ============================================================================        error(400, 'Contact identifier required');

      }

const DripStepBranchInputSchema = v.object({      const resend = getResendClient();

	monitor: v.optional(v.picklist(['opened', 'clicked'] as const)),      const response = await resend.contacts.remove({

	successStepId: v.optional(v.string()),        segmentId,

	fallbackStepId: v.optional(v.string()),        id: contactId ?? undefined,

	evaluateValue: v.optional(v.number()),        email: email ?? undefined

	evaluateUnit: v.optional(v.picklist(['minutes', 'hours', 'days'] as const)),      });

});      if (response.error) throw new Error(response.error.message);

      return { success: true };

const DripStepInputSchema = v.object({    } catch (err) {

	id: v.optional(v.string()),      console.error('[newsletter.removeSegmentContact] error:', err);

	label: v.pipe(v.string(), v.nonEmpty()),      error(500, 'Failed to remove subscriber');

	subject: v.pipe(v.string(), v.nonEmpty()),    }

	previewText: v.optional(v.string()),  }

	html: v.optional(v.string()),);

	text: v.optional(v.string()),

	delayValue: v.number(),// Templates -------------------------------------------------

	delayUnit: v.picklist(['minutes', 'hours', 'days'] as const),export const listTemplates = guardedQuery(async (): Promise<EmailTemplate[]> => {

	scheduleMode: v.picklist(['relative', 'absolute'] as const),  try {

	runAt: v.optional(v.string()),    const resend = getResendClient();

	branching: v.optional(DripStepBranchInputSchema),    const response = await resend.templates.list({ limit: 100 });

});    if (response.error) throw new Error(response.error.message);

    return response.data?.data ?? [];

const DripCampaignInputSchema = v.object({  } catch (err) {

	id: v.optional(v.string()),    console.error('[newsletter.listTemplates] error:', err);

	name: v.pipe(v.string(), v.nonEmpty()),    return [];

	description: v.optional(v.string()),  }

	audienceId: v.pipe(v.string(), v.nonEmpty()),});

	audienceName: v.optional(v.string()),

	startAt: v.optional(v.string()),export const getTemplate = guardedCommand(

	steps: v.array(DripStepInputSchema),  v.object({

	status: v.optional(v.picklist(['draft', 'active', 'paused', 'completed'] as const)),    templateId: v.pipe(v.string(), v.nonEmpty())

});  }),

  async ({ templateId }): Promise<EmailTemplate | null> => {

export const listDripCampaigns = guardedQuery(async (): Promise<DripCampaignRecord[]> => {    try {

	try {      const resend = getResendClient();

		const { event } = ensureSession();      const response = await resend.templates.get(templateId);

		const campaigns = await newsletter.listCampaigns(event);      if (response.error) throw new Error(response.error.message);

      return response.data ?? null;

		// Get steps for each campaign and convert to UI format    } catch (err) {

		const result: DripCampaignRecord[] = [];      console.error('[newsletter.getTemplate] error:', err);

		for (const campaign of campaigns) {      return null;

			const fullCampaign = await newsletter.getCampaign(event, campaign.id);    }

			if (fullCampaign) {  }

				result.push({);

					id: fullCampaign.id,

					name: fullCampaign.name,export const createTemplate = guardedCommand(

					description: fullCampaign.description,  v.object({

					segmentId: fullCampaign.segmentId,    name: v.pipe(v.string(), v.nonEmpty()),

					segmentName: undefined,    subject: v.pipe(v.string(), v.nonEmpty()),

					status: fullCampaign.status,    html: v.pipe(v.string(), v.nonEmpty())

					startAt: fullCampaign.startAt,  }),

					createdAt: fullCampaign.created_at,  async ({ name, subject, html }) => {

					updatedAt: fullCampaign.updated_at,    try {

					lastLaunchAt: fullCampaign.lastLaunchAt,      const resend = getResendClient();

					metrics: {      const response = await resend.templates.create({

						contactsTargeted: fullCampaign.contactsTargeted,        name,

						totalScheduled: fullCampaign.totalScheduled,        subject,

						totalSteps: fullCampaign.steps.length,        html,

					},        from: defaultFromAddress()

					steps: fullCampaign.steps.map((step) => ({      });

						id: step.id,      if (response.error) throw new Error(response.error.message);

						label: step.label,      await listTemplates().refresh();

						subject: step.subject,      return { success: true, id: response.data?.id };

						previewText: step.previewText,    } catch (err) {

						html: step.html,      console.error('[newsletter.createTemplate] error:', err);

						text: step.text,      error(500, 'Failed to create template');

						scheduleMode: step.scheduleMode,    }

						sendAt: step.sendAt,  }

						delayMinutes: step.delayMinutes,);

						status: step.status,

						resendEmailIds: [],export const deleteTemplate = guardedCommand(

						branching: step.monitorEvent  v.object({

							? {    templateId: v.pipe(v.string(), v.nonEmpty())

									monitor: step.monitorEvent,  }),

									successStepId: step.successStepId,  async ({ templateId }) => {

									fallbackStepId: step.fallbackStepId,    try {

									evaluateAfterMinutes: step.evaluateAfterMinutes || 1440,      const resend = getResendClient();

							  }      const response = await resend.templates.delete(templateId);

							: null,      if (response.error) throw new Error(response.error.message);

					})),      await listTemplates().refresh();

				});      return { success: true };

			}    } catch (err) {

		}      console.error('[newsletter.deleteTemplate] error:', err);

      error(500, 'Failed to delete template');

		return result;    }

	} catch (err) {  }

		console.error('[newsletter.listDripCampaigns] error:', err););

		return [];

	}// Broadcasts -------------------------------------------------

});export const listBroadcasts = guardedQuery(async () => {

  try {

export const saveDripCampaign = guardedCommand(DripCampaignInputSchema, async (payload) => {    const resend = getResendClient();

	try {    const response = await resend.broadcasts.list({ limit: 50 });

		const { event } = ensureSession();    if (response.error) throw new Error(response.error.message);

    return response.data?.data ?? [];

		const steps = payload.steps.map((step) => ({  } catch (err) {

			id: step.id,    console.error('[newsletter.listBroadcasts] error:', err);

			label: step.label,    return [];

			subject: step.subject,  }

			html: step.html,});

			text: step.text,

			previewText: step.previewText,export const createBroadcast = guardedCommand(

			scheduleMode: step.scheduleMode,  v.object({

			sendAt: step.scheduleMode === 'absolute' ? step.runAt : undefined,    audienceId: v.pipe(v.string(), v.nonEmpty()),

			delayMinutes: step.scheduleMode === 'relative' ? toMinutes(step.delayValue, step.delayUnit) : 0,    subject: v.pipe(v.string(), v.nonEmpty()),

			monitorEvent: step.branching?.monitor,    html: v.optional(v.string()),

			successStepId: step.branching?.successStepId,    text: v.optional(v.string()),

			fallbackStepId: step.branching?.fallbackStepId,    previewText: v.optional(v.string()),

			evaluateAfterMinutes: step.branching    sendAt: v.optional(v.string()),

				? toMinutes(step.branching.evaluateValue || 1, step.branching.evaluateUnit || 'days')    name: v.optional(v.string())

				: undefined,  }),

		}));  async ({ audienceId, subject, html, text, previewText, sendAt, name }) => {

    try {

		const result = await newsletter.saveCampaign(event, {      const resend = getResendClient();

			id: payload.id,      const payload = {

			segmentId: payload.audienceId,        audienceId,

			name: payload.name,        subject,

			description: payload.description,        previewText: previewText || undefined,

			startAt: payload.startAt,        from: defaultFromAddress(),

			steps,        html: html?.trim() ? html : undefined,

		});        text: text?.trim() ? text : undefined,

        name: name || subject,

		if (!result.success) {        ...(sendAt ? { scheduledAt: sendAt } : {})

			error(500, result.error || 'Failed to save campaign');      };

		}      console.log('[newsletter.createBroadcast] payload:', payload);

      const response = await resend.broadcasts.create(payload as any);

		await listDripCampaigns().refresh();      console.log('[newsletter.createBroadcast] response:', response);

		return { success: true, id: result.id };      if (response.error) throw new Error(response.error.message);

	} catch (err) {      await listBroadcasts().refresh();

		console.error('[newsletter.saveDripCampaign] error:', err);      return { success: true, id: response.data?.id };

		error(500, 'Failed to save campaign');    } catch (err) {

	}      console.error('[newsletter.createBroadcast] error:', err);

});      const message = err instanceof Error ? err.message : 'Failed to create broadcast';

      error(500, message);

export const deleteDripCampaign = guardedCommand(    }

	v.object({  }

		id: v.pipe(v.string(), v.nonEmpty()),);

	}),

	async ({ id }) => {export const sendBroadcast = guardedCommand(

		try {  v.object({

			const { event } = ensureSession();    broadcastId: v.pipe(v.string(), v.nonEmpty()),

			const result = await newsletter.deleteCampaign(event, id);    scheduledAt: v.optional(v.string())

  }),

			if (!result.success) {  async ({ broadcastId, scheduledAt }) => {

				error(500, result.error || 'Failed to delete campaign');    try {

			}      const resend = getResendClient();

      const response = await resend.broadcasts.send(broadcastId, {

			await listDripCampaigns().refresh();        scheduledAt: scheduledAt || undefined

			return { success: true };      });

		} catch (err) {      if (response.error) throw new Error(response.error.message);

			console.error('[newsletter.deleteDripCampaign] error:', err);      await listBroadcasts().refresh();

			error(500, 'Failed to delete campaign');      return { success: true };

		}    } catch (err) {

	}      console.error('[newsletter.sendBroadcast] error:', err);

);      const message = err instanceof Error ? err.message : 'Failed to send broadcast';

      error(500, message);

export const launchDripCampaign = guardedCommand(    }

	v.object({  }

		id: v.pipe(v.string(), v.nonEmpty()),);

		startAt: v.optional(v.string()),

	}),export const deleteBroadcast = guardedCommand(

	async ({ id, startAt }) => {  v.object({

		try {    broadcastId: v.pipe(v.string(), v.nonEmpty())

			const { event } = ensureSession();  }),

			const result = await newsletter.launchCampaign(event, id, startAt);  async ({ broadcastId }) => {

    try {

			if (!result.success) {      const resend = getResendClient();

				error(500, result.error || 'Failed to launch campaign');      const response = await resend.broadcasts.remove(broadcastId);

			}      if (response.error) throw new Error(response.error.message);

      await listBroadcasts().refresh();

			await listDripCampaigns().refresh();      return { success: true };

			return {    } catch (err) {

				success: true,      console.error('[newsletter.deleteBroadcast] error:', err);

				scheduledEmails: result.data?.scheduledEmails || 0,      const message = err instanceof Error ? err.message : 'Failed to delete broadcast';

				contacts: result.data?.contacts || 0,      error(500, message);

				limited: false,    }

			};  }

		} catch (err) {);

			console.error('[newsletter.launchDripCampaign] error:', err);

			error(500, err instanceof Error ? err.message : 'Failed to launch campaign');// Drip campaigns --------------------------------------------

		}const DripStepBranchInputSchema = v.object({

	}  monitor: v.optional(v.picklist(['opened', 'clicked'] as const)),

);  successStepId: v.optional(v.string()),

  fallbackStepId: v.optional(v.string()),

export const processDripBranches = guardedCommand(  evaluateValue: v.optional(v.number()),

	v.object({  evaluateUnit: v.optional(v.picklist(['minutes', 'hours', 'days'] as const))

		limit: v.optional(v.number()),});

	}),

	async ({ limit = 25 }) => {const DripStepInputSchema = v.object({

		try {  id: v.optional(v.string()),

			const { event } = ensureSession();  label: v.pipe(v.string(), v.nonEmpty()),

			const result = await newsletter.processCampaignBranches(event, limit);  subject: v.pipe(v.string(), v.nonEmpty()),

  previewText: v.optional(v.string()),

			if (!result.success) {  html: v.optional(v.string()),

				error(500, result.error || 'Failed to process drip branches');  text: v.optional(v.string()),

			}  delayValue: v.number(),

  delayUnit: v.picklist(['minutes', 'hours', 'days'] as const),

			await listDripCampaigns().refresh();  scheduleMode: v.picklist(['relative', 'absolute'] as const),

			return { processed: result.data?.processed || 0 };  runAt: v.optional(v.string()),

		} catch (err) {  branching: v.optional(DripStepBranchInputSchema)

			console.error('[newsletter.processDripBranches] error:', err);});

			error(500, 'Failed to process drip branches');

		}const DripCampaignInputSchema = v.object({

	}  id: v.optional(v.string()),

);  name: v.pipe(v.string(), v.nonEmpty()),

  description: v.optional(v.string()),
  audienceId: v.pipe(v.string(), v.nonEmpty()),
  audienceName: v.optional(v.string()),
  startAt: v.optional(v.string()),
  steps: v.array(DripStepInputSchema),
  status: v.optional(v.picklist(['draft', 'active', 'paused', 'completed'] as const))
});

export const listDripCampaigns = guardedQuery(async () => {
  try {
    return await readDripCampaigns();
  } catch (err) {
    console.error('[newsletter.listDripCampaigns] error:', err);
    return [];
  }
});

export const saveDripCampaign = guardedCommand(DripCampaignInputSchema, async (payload) => {
  try {
    const campaigns = await readDripCampaigns();
    const now = new Date().toISOString();
    let campaign = campaigns.find((c) => c.id === payload.id);
    if (!campaign) {
      campaign = {
        id: payload.id || crypto.randomUUID(),
        name: payload.name,
        description: payload.description,
        audienceId: payload.audienceId,
        audienceName: payload.audienceName,
        status: payload.status ?? 'draft',
        startAt: payload.startAt ?? null,
        createdAt: now,
        updatedAt: now,
        metrics: {
          contactsTargeted: 0,
          totalScheduled: 0,
          totalSteps: payload.steps.length
        },
        steps: []
      };
      campaigns.push(campaign);
    }

    campaign.name = payload.name;
    campaign.description = payload.description;
    campaign.audienceId = payload.audienceId;
    campaign.audienceName = payload.audienceName;
    campaign.status = payload.status ?? campaign.status ?? 'draft';
    campaign.startAt = payload.startAt ?? campaign.startAt ?? null;
    campaign.updatedAt = now;
    campaign.steps = payload.steps.map((step, index) => {
      const existing = campaign?.steps?.find((s) => s.id === step.id);
      const scheduleMode = step.scheduleMode;
      const sendAt = scheduleMode === 'absolute' ? (step.runAt ?? existing?.sendAt ?? null) : null;
      const delayMinutes = scheduleMode === 'relative' ? toMinutes(step.delayValue, step.delayUnit) : 0;
      let branching: DripStepBranching | null = null;
      if (step.branching && (step.branching.successStepId || step.branching.fallbackStepId)) {
        const evaluateMinutes = toMinutes(
          step.branching.evaluateValue ?? 1,
          step.branching.evaluateUnit ?? 'days'
        );
        branching = {
          monitor: step.branching.monitor ?? 'opened',
          successStepId: step.branching.successStepId || undefined,
          fallbackStepId: step.branching.fallbackStepId || undefined,
          evaluateAfterMinutes: evaluateMinutes
        };
      }
      return {
        id: step.id || existing?.id || crypto.randomUUID(),
        label: step.label,
        subject: step.subject,
        previewText: step.previewText,
        html: step.html,
        text: step.text,
        delayMinutes,
        scheduleMode,
        sendAt,
        status: existing?.status ?? 'draft',
        resendEmailIds: existing?.resendEmailIds ?? [],
        branching
      } satisfies DripStepRecord;
    });
    campaign.metrics.totalSteps = campaign.steps.length;

    await writeDripCampaigns(campaigns);
    await listDripCampaigns().refresh();
    return { success: true, id: campaign.id };
  } catch (err) {
    console.error('[newsletter.saveDripCampaign] error:', err);
    error(500, 'Failed to save campaign');
  }
});

export const deleteDripCampaign = guardedCommand(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ id }) => {
    try {
      const campaigns = await readDripCampaigns();
      const filtered = campaigns.filter((c) => c.id !== id);
      await writeDripCampaigns(filtered);
      await listDripCampaigns().refresh();
      return { success: true };
    } catch (err) {
      console.error('[newsletter.deleteDripCampaign] error:', err);
      error(500, 'Failed to delete campaign');
    }
  }
);

export const launchDripCampaign = guardedCommand(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty()),
    startAt: v.optional(v.string())
  }),
  async ({ id, startAt }) => {
    try {
      const campaigns = await readDripCampaigns();
      const campaign = campaigns.find((c) => c.id === id);
      if (!campaign) {
        error(404, 'Campaign not found');
      }
      if (!campaign.steps?.length) {
        error(400, 'Add at least one step before launching');
      }
      const contacts = await fetchSegmentContacts(campaign.segmentId, MAX_CONTACTS_PER_LAUNCH);
      if (contacts.length === 0) {
        error(400, 'Audience has no subscribers to target');
      }
      const resend = getResendClient();
      const startDate = startAt ? new Date(startAt) : campaign.startAt ? new Date(campaign.startAt) : new Date();
      const { stepMap, defaultNext } = buildStepGraph(campaign);
      const firstStepId = campaign.steps[0]?.id;
      if (!firstStepId) {
        error(400, 'Campaign steps misconfigured');
      }
      for (const contact of contacts) {
        await scheduleStepForContact({
          campaign,
          stepId: firstStepId,
          contact,
          baseTime: new Date(startDate),
          resend,
          stepMap,
          defaultNext
        });
      }

      campaign.steps = campaign.steps.map((step) => ({ ...step, status: 'scheduled' }));
      campaign.status = 'active';
      campaign.lastLaunchAt = new Date().toISOString();
      campaign.metrics.contactsTargeted = contacts.length;
      campaign.metrics.totalScheduled += contacts.length * campaign.steps.length;
      campaign.updatedAt = new Date().toISOString();

      await writeDripCampaigns(campaigns);
      await listDripCampaigns().refresh();
      return {
        success: true,
        scheduledEmails: contacts.length * campaign.steps.length,
        contacts: contacts.length,
        limited: contacts.length === MAX_CONTACTS_PER_LAUNCH
      };
    } catch (err) {
      console.error('[newsletter.launchDripCampaign] error:', err);
      error(500, err instanceof Error ? err.message : 'Failed to launch campaign');
    }
  }
);

export const processDripBranches = guardedCommand(
  v.object({
    limit: v.optional(v.number())
  }),
  async ({ limit = 25 }) => {
    try {
      const queue = await readBranchQueue();
      if (!queue.length) {
        return { processed: 0 };
      }
      const now = Date.now();
      const readyEntries = queue
        .filter((entry) => new Date(entry.evaluateAt).getTime() <= now)
        .slice(0, limit);
      if (!readyEntries.length) {
        return { processed: 0 };
      }

      const remainingEntries = queue.filter((entry) => !readyEntries.includes(entry));
      const campaigns = await readDripCampaigns();
      const resend = getResendClient();
      const stepCache = new Map<
        string,
        { stepMap: Map<string, DripStepRecord>; defaultNext: Map<string, string | null>; campaign: DripCampaignRecord }
      >();

      for (const entry of readyEntries) {
        const cached = stepCache.get(entry.campaignId);
        let meta = cached;
        if (!meta) {
          const campaign = campaigns.find((c) => c.id === entry.campaignId);
          if (!campaign) continue;
          meta = { campaign, ...buildStepGraph(campaign) };
          stepCache.set(entry.campaignId, meta);
        }

        const email = await resend.emails.get(entry.resendEmailId);
        if (email.error) {
          console.error('[newsletter.processDripBranches] Failed to inspect email', email.error);
          continue;
        }
        const lastEvent = email.data?.last_event;
        const success =
          entry.monitor === 'clicked'
            ? lastEvent === 'clicked'
            : lastEvent === 'opened' || lastEvent === 'clicked';

        const nextStepId = success ? entry.successStepId : entry.fallbackStepId;
        if (nextStepId) {
          await scheduleStepForContact({
            campaign: meta.campaign,
            stepId: nextStepId,
            contact: entry.contact,
            baseTime: new Date(entry.evaluateAt),
            resend,
            stepMap: meta.stepMap,
            defaultNext: meta.defaultNext
          });
        }
      }

      await writeBranchQueue(remainingEntries);
      await writeDripCampaigns(campaigns);
      await listDripCampaigns().refresh();
      return { processed: readyEntries.length };
    } catch (err) {
      console.error('[newsletter.processDripBranches] error:', err);
      error(500, 'Failed to process drip branches');
    }
  }
);
type DripBranchCheck = {
  id: string;
  campaignId: string;
  stepId: string;
  contact: SegmentContact;
  resendEmailId: string;
  monitor: 'opened' | 'clicked';
  successStepId?: string;
  fallbackStepId?: string;
  evaluateAt: string;
  baseTime: string;
};
