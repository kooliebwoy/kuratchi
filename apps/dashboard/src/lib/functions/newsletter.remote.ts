import { getRequestEvent, query, command, form } from '$app/server';
import { error } from '@sveltejs/kit';
import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import * as v from 'valibot';

// Resend client helper
let resendClient: Resend | null = null;
const getResendClient = () => {
  if (!env.RESEND_API_KEY) {
    error(500, 'Resend API key not configured');
  }
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
};

// Helpers
const ensureSession = () => {
  const event = getRequestEvent();
  const session = event.locals.session;
  if (!session?.user) {
    error(401, 'Unauthorized');
  }
  return { event, session };
};

const guardedQuery = <R>(fn: () => Promise<R>) => {
  return query(async () => {
    ensureSession();
    return fn();
  });
};

const guardedCommand = <Schema extends v.BaseSchema<any, any>>(
  schema: Schema,
  fn: (data: v.InferOutput<Schema>) => Promise<any>
) => {
  return command(schema, async (data: v.InferOutput<Schema>) => {
    ensureSession();
    return fn(data);
  });
};

const guardedForm = <Schema extends v.BaseSchema<any, any>>(
  schema: Schema,
  fn: (data: v.InferOutput<Schema>) => Promise<any>
) => {
  return form(schema, async (data: v.InferOutput<Schema>) => {
    ensureSession();
    return fn(data);
  });
};

// Types
export type SegmentSummary = {
  id: string;
  name: string;
  created_at: string;
  subscriberCount?: number | null;
};

export type SegmentContact = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  created_at: string;
  unsubscribed: boolean;
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject?: string;
  html?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
};

export type DripStepBranching = {
  monitor?: 'opened' | 'clicked';
  successStepId?: string;
  fallbackStepId?: string;
  evaluateAfterMinutes: number;
};

export type DripStepRecord = {
  id: string;
  label: string;
  subject: string;
  previewText?: string | null;
  html?: string | null;
  text?: string | null;
  scheduleMode: 'relative' | 'absolute';
  sendAt?: string | null;
  delayMinutes: number;
  status: 'draft' | 'scheduled' | 'completed';
  resendEmailIds?: string[];
  branching?: DripStepBranching | null;
};

export type DripCampaignRecord = {
  id: string;
  name: string;
  description?: string | null;
  segmentId: string;
  segmentName?: string | null;
  status: 'draft' | 'active' | 'paused' | 'completed';
  startAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLaunchAt?: string | null;
  metrics: {
    contactsTargeted: number;
    totalScheduled: number;
    totalSteps: number;
  };
  steps: DripStepRecord[];
};

const DRIP_KV_PREFIX = 'newsletter:drips:';
const MAX_CONTACTS_PER_LAUNCH = 200;
const DRIP_BRANCHES_PREFIX = 'newsletter:drips:branches:';

type KVNamespace = {
  get: (key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number }) => Promise<any>;
  put: (key: string, value: string | ArrayBuffer | ReadableStream, options?: { expiration?: number; expirationTtl?: number; metadata?: any }) => Promise<void>;
};

const getKvContext = async () => {
  const { event, session } = ensureSession();
  const orgId = session.user.organizationId;
  if (!orgId) {
    error(400, 'Organization context required');
  }
  const kv = (event.locals.kuratchi as any)?.getKV?.('KV') || (event.locals.kuratchi as any)?.getKV?.('default');
  if (!kv) {
    error(500, 'KV storage not configured');
  }
  return { kv: kv as KVNamespace, orgId };
};

const readDripCampaigns = async (): Promise<DripCampaignRecord[]> => {
  const { kv, orgId } = await getKvContext();
  const key = `${DRIP_KV_PREFIX}${orgId}`;
  const stored = await kv.get(key, { type: 'json' });
  if (Array.isArray(stored)) {
    return stored as DripCampaignRecord[];
  }
  return [];
};

const writeDripCampaigns = async (campaigns: DripCampaignRecord[]) => {
  const { kv, orgId } = await getKvContext();
  const key = `${DRIP_KV_PREFIX}${orgId}`;
  await kv.put(key, JSON.stringify(campaigns));
};

const readBranchQueue = async (): Promise<DripBranchCheck[]> => {
  const { kv, orgId } = await getKvContext();
  const key = `${DRIP_BRANCHES_PREFIX}${orgId}`;
  const stored = await kv.get(key, { type: 'json' });
  return Array.isArray(stored) ? (stored as DripBranchCheck[]) : [];
};

const writeBranchQueue = async (entries: DripBranchCheck[]) => {
  const { kv, orgId } = await getKvContext();
  const key = `${DRIP_BRANCHES_PREFIX}${orgId}`;
  await kv.put(key, JSON.stringify(entries));
};

const enqueueBranchCheck = async (entry: DripBranchCheck) => {
  const queue = await readBranchQueue();
  queue.push(entry);
  await writeBranchQueue(queue);
};

const normalizeHtml = (value?: string | null, fallback?: string | null) => {
  const html = value?.trim();
  if (html && html.length > 0) return html;
  const text = fallback?.trim();
  return text ? `<p>${text}</p>` : '<p></p>';
};

const fetchSegmentContacts = async (segmentId: string, take: number = MAX_CONTACTS_PER_LAUNCH) => {
  const resend = getResendClient();
  const contacts: SegmentContact[] = [];
  let cursor: string | undefined;
  while (contacts.length < take) {
    const response = await resend.contacts.list({
      segmentId,
      limit: Math.min(200, take - contacts.length),
      after: cursor
    });
    if (response.error) {
      throw new Error(response.error.message);
    }
    const batch = response.data?.data ?? [];
    contacts.push(
      ...batch.map((contact) => ({
        id: contact.id,
        email: contact.email,
        first_name: contact.first_name,
        last_name: contact.last_name,
        created_at: contact.created_at,
        unsubscribed: contact.unsubscribed
      }))
    );
    if (!response.data?.has_more || batch.length === 0) {
      break;
    }
    cursor = batch[batch.length - 1]?.id;
  }
  return contacts;
};

const toMinutes = (value: number, unit: 'minutes' | 'hours' | 'days') => {
  switch (unit) {
    case 'days':
      return value * 24 * 60;
    case 'hours':
      return value * 60;
    default:
      return value;
  }
};

const defaultFromAddress = () => {
  if (env.RESEND_FROM_EMAIL) return env.RESEND_FROM_EMAIL;
  if (env.RESEND_FROM) return env.RESEND_FROM;
  return 'Kuratchi <no-reply@kuratchi.dev>';
};

const buildStepGraph = (campaign: DripCampaignRecord) => {
  const stepOrder = campaign.steps.map((step) => step.id);
  const stepMap = new Map(campaign.steps.map((step) => [step.id, step]));
  const defaultNext = new Map<string, string | null>();
  for (let i = 0; i < stepOrder.length; i += 1) {
    const current = stepOrder[i];
    const next = i + 1 < stepOrder.length ? stepOrder[i + 1] : null;
    defaultNext.set(current, next);
  }
  return { stepMap, defaultNext };
};

const resolveScheduleTime = (step: DripStepRecord, baseTime: Date) => {
  if (step.scheduleMode === 'absolute' && step.sendAt) {
    return new Date(step.sendAt);
  }
  const scheduled = new Date(baseTime);
  scheduled.setMinutes(scheduled.getMinutes() + step.delayMinutes);
  return scheduled;
};

const scheduleStepForContact = async ({
  campaign,
  stepId,
  contact,
  baseTime,
  resend,
  stepMap,
  defaultNext
}: {
  campaign: DripCampaignRecord;
  stepId: string;
  contact: SegmentContact;
  baseTime: Date;
  resend: Resend;
  stepMap: Map<string, DripStepRecord>;
  defaultNext: Map<string, string | null>;
}) => {
  const step = stepMap.get(stepId);
  if (!step) return;
  const scheduledAt = resolveScheduleTime(step, baseTime);
  const response = await resend.emails.send({
    from: defaultFromAddress(),
    to: contact.email,
    subject: step.subject,
    html: normalizeHtml(step.html, step.text),
    text: step.text?.trim() ? step.text : undefined,
    scheduled_at: scheduledAt.toISOString(),
    tags: [
      { name: 'drip_campaign', value: campaign.id },
      { name: 'drip_step', value: step.id }
    ]
  });

  if (step.branching && (step.branching.successStepId || step.branching.fallbackStepId) && response.data?.id) {
    await enqueueBranchCheck({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      stepId: step.id,
      contact: {
        id: contact.id,
        email: contact.email,
        first_name: contact.first_name,
        last_name: contact.last_name,
        unsubscribed: contact.unsubscribed
      },
      resendEmailId: response.data.id,
      monitor: step.branching.monitor ?? 'opened',
      successStepId: step.branching.successStepId,
      fallbackStepId: step.branching.fallbackStepId,
      evaluateAt: new Date(
        scheduledAt.getTime() + step.branching.evaluateAfterMinutes * 60 * 1000
      ).toISOString(),
      baseTime: scheduledAt.toISOString()
    });
    return;
  }

  const nextStepId = defaultNext.get(step.id);
  if (nextStepId) {
    await scheduleStepForContact({
      campaign,
      stepId: nextStepId,
      contact,
      baseTime: scheduledAt,
      resend,
      stepMap,
      defaultNext
    });
  }
};

// Segments -------------------------------------------------
export const listSegments = guardedQuery(async (): Promise<SegmentSummary[]> => {
  try {
    const resend = getResendClient();
    const response = await resend.segments.list({ limit: 100 });
    if (response.error) {
      throw new Error(response.error.message);
    }
    const segments = response.data?.data ?? [];
    return segments.map((segment: any) => ({
      id: segment.id,
      name: segment.name,
      created_at: segment.created_at,
      subscriberCount: segment.contacts_count ?? segment.subscriberCount ?? 0
    }));
  } catch (err) {
    console.error('[newsletter.listSegments] error:', err);
    return [];
  }
});

export const createSegment = guardedCommand(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty('Name is required'))
  }),
  async ({ name }) => {
    try {
      const resend = getResendClient();
      const response = await resend.segments.create({ name });
      if (response.error) throw new Error(response.error.message);
      
      // Refresh the segments list to include the new segment
      const listResource = listSegments();
      await listResource.refresh();
      
      return { 
        success: true, 
        id: response.data?.id,
        segment: {
          id: response.data?.id,
          name: name,
          created_at: new Date().toISOString(),
          subscriberCount: 0
        }
      };
    } catch (err) {
      console.error('[newsletter.createSegment] error:', err);
      const message = err instanceof Error ? err.message : 'Failed to create segment';
      error(500, message);
    }
  }
);

export const deleteSegment = guardedCommand(
  v.object({
    segmentId: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ segmentId }) => {
    try {
      const resend = getResendClient();
      const response = await resend.segments.remove(segmentId);
      if (response.error) throw new Error(response.error.message);
      await listSegments().refresh();
      return { success: true };
    } catch (err) {
      console.error('[newsletter.deleteSegment] error:', err);
      error(500, 'Failed to delete segment');
    }
  }
);

export const listSegmentContacts = guardedCommand(
  v.object({
    segmentId: v.pipe(v.string(), v.nonEmpty()),
    limit: v.optional(v.number())
  }),
  async ({ segmentId, limit = 50 }) => {
    try {
      const resend = getResendClient();
      const response = await resend.contacts.list({
        segmentId,
        limit
      });
      if (response.error) throw new Error(response.error.message);
      const data = response.data;
      return {
        contacts:
          data?.data?.map((contact) => ({
            id: contact.id,
            email: contact.email,
            first_name: contact.first_name,
            last_name: contact.last_name,
            unsubscribed: contact.unsubscribed,
            created_at: contact.created_at
          })) ?? [],
        hasMore: data?.has_more ?? false
      };
    } catch (err) {
      console.error('[newsletter.listSegmentContacts] error:', err);
      error(500, 'Failed to load contacts');
    }
  }
);

export const addSegmentContact = guardedCommand(
  v.object({
    segmentId: v.pipe(v.string(), v.nonEmpty()),
    email: v.pipe(v.string(), v.nonEmpty()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string())
  }),
  async ({ segmentId, email, firstName, lastName }) => {
    try {
      const resend = getResendClient();
      const response = await resend.contacts.create({
        segmentId,
        email,
        firstName,
        lastName
      });
      if (response.error) throw new Error(response.error.message);
      return { success: true, id: response.data?.id };
    } catch (err) {
      console.error('[newsletter.addSegmentContact] error:', err);
      error(500, 'Failed to add subscriber');
    }
  }
);

export const removeSegmentContact = guardedCommand(
  v.object({
    segmentId: v.pipe(v.string(), v.nonEmpty()),
    contactId: v.optional(v.string()),
    email: v.optional(v.string())
  }),
  async ({ segmentId, contactId, email }) => {
    try {
      if (!contactId && !email) {
        error(400, 'Contact identifier required');
      }
      const resend = getResendClient();
      const response = await resend.contacts.remove({
        segmentId,
        id: contactId ?? undefined,
        email: email ?? undefined
      });
      if (response.error) throw new Error(response.error.message);
      return { success: true };
    } catch (err) {
      console.error('[newsletter.removeSegmentContact] error:', err);
      error(500, 'Failed to remove subscriber');
    }
  }
);

// Templates -------------------------------------------------
export const listTemplates = guardedQuery(async (): Promise<EmailTemplate[]> => {
  try {
    const resend = getResendClient();
    const response = await resend.templates.list({ limit: 100 });
    if (response.error) throw new Error(response.error.message);
    return response.data?.data ?? [];
  } catch (err) {
    console.error('[newsletter.listTemplates] error:', err);
    return [];
  }
});

export const getTemplate = guardedCommand(
  v.object({
    templateId: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ templateId }): Promise<EmailTemplate | null> => {
    try {
      const resend = getResendClient();
      const response = await resend.templates.get(templateId);
      if (response.error) throw new Error(response.error.message);
      return response.data ?? null;
    } catch (err) {
      console.error('[newsletter.getTemplate] error:', err);
      return null;
    }
  }
);

export const createTemplate = guardedCommand(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty()),
    subject: v.pipe(v.string(), v.nonEmpty()),
    html: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ name, subject, html }) => {
    try {
      const resend = getResendClient();
      const response = await resend.templates.create({
        name,
        subject,
        html,
        from: defaultFromAddress()
      });
      if (response.error) throw new Error(response.error.message);
      await listTemplates().refresh();
      return { success: true, id: response.data?.id };
    } catch (err) {
      console.error('[newsletter.createTemplate] error:', err);
      error(500, 'Failed to create template');
    }
  }
);

export const deleteTemplate = guardedCommand(
  v.object({
    templateId: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ templateId }) => {
    try {
      const resend = getResendClient();
      const response = await resend.templates.delete(templateId);
      if (response.error) throw new Error(response.error.message);
      await listTemplates().refresh();
      return { success: true };
    } catch (err) {
      console.error('[newsletter.deleteTemplate] error:', err);
      error(500, 'Failed to delete template');
    }
  }
);

// Broadcasts -------------------------------------------------
export const listBroadcasts = guardedQuery(async () => {
  try {
    const resend = getResendClient();
    const response = await resend.broadcasts.list({ limit: 50 });
    if (response.error) throw new Error(response.error.message);
    return response.data?.data ?? [];
  } catch (err) {
    console.error('[newsletter.listBroadcasts] error:', err);
    return [];
  }
});

export const createBroadcast = guardedCommand(
  v.object({
    audienceId: v.pipe(v.string(), v.nonEmpty()),
    subject: v.pipe(v.string(), v.nonEmpty()),
    html: v.optional(v.string()),
    text: v.optional(v.string()),
    previewText: v.optional(v.string()),
    sendAt: v.optional(v.string()),
    name: v.optional(v.string())
  }),
  async ({ audienceId, subject, html, text, previewText, sendAt, name }) => {
    try {
      const resend = getResendClient();
      const payload = {
        audienceId,
        subject,
        previewText: previewText || undefined,
        from: defaultFromAddress(),
        html: html?.trim() ? html : undefined,
        text: text?.trim() ? text : undefined,
        name: name || subject,
        ...(sendAt ? { scheduledAt: sendAt } : {})
      };
      console.log('[newsletter.createBroadcast] payload:', payload);
      const response = await resend.broadcasts.create(payload as any);
      console.log('[newsletter.createBroadcast] response:', response);
      if (response.error) throw new Error(response.error.message);
      await listBroadcasts().refresh();
      return { success: true, id: response.data?.id };
    } catch (err) {
      console.error('[newsletter.createBroadcast] error:', err);
      const message = err instanceof Error ? err.message : 'Failed to create broadcast';
      error(500, message);
    }
  }
);

export const sendBroadcast = guardedCommand(
  v.object({
    broadcastId: v.pipe(v.string(), v.nonEmpty()),
    scheduledAt: v.optional(v.string())
  }),
  async ({ broadcastId, scheduledAt }) => {
    try {
      const resend = getResendClient();
      const response = await resend.broadcasts.send(broadcastId, {
        scheduledAt: scheduledAt || undefined
      });
      if (response.error) throw new Error(response.error.message);
      await listBroadcasts().refresh();
      return { success: true };
    } catch (err) {
      console.error('[newsletter.sendBroadcast] error:', err);
      const message = err instanceof Error ? err.message : 'Failed to send broadcast';
      error(500, message);
    }
  }
);

export const deleteBroadcast = guardedCommand(
  v.object({
    broadcastId: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ broadcastId }) => {
    try {
      const resend = getResendClient();
      const response = await resend.broadcasts.remove(broadcastId);
      if (response.error) throw new Error(response.error.message);
      await listBroadcasts().refresh();
      return { success: true };
    } catch (err) {
      console.error('[newsletter.deleteBroadcast] error:', err);
      const message = err instanceof Error ? err.message : 'Failed to delete broadcast';
      error(500, message);
    }
  }
);

// Drip campaigns --------------------------------------------
const DripStepBranchInputSchema = v.object({
  monitor: v.optional(v.picklist(['opened', 'clicked'] as const)),
  successStepId: v.optional(v.string()),
  fallbackStepId: v.optional(v.string()),
  evaluateValue: v.optional(v.number()),
  evaluateUnit: v.optional(v.picklist(['minutes', 'hours', 'days'] as const))
});

const DripStepInputSchema = v.object({
  id: v.optional(v.string()),
  label: v.pipe(v.string(), v.nonEmpty()),
  subject: v.pipe(v.string(), v.nonEmpty()),
  previewText: v.optional(v.string()),
  html: v.optional(v.string()),
  text: v.optional(v.string()),
  delayValue: v.number(),
  delayUnit: v.picklist(['minutes', 'hours', 'days'] as const),
  scheduleMode: v.picklist(['relative', 'absolute'] as const),
  runAt: v.optional(v.string()),
  branching: v.optional(DripStepBranchInputSchema)
});

const DripCampaignInputSchema = v.object({
  id: v.optional(v.string()),
  name: v.pipe(v.string(), v.nonEmpty()),
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
