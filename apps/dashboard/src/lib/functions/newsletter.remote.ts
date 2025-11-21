import { getRequestEvent, query, command } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import * as newsletter from 'kuratchi-sdk/newsletter';

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

const guardedCommand = <Schema extends v.BaseSchema<any, any, any>>(
schema: Schema,
fn: (data: v.InferOutput<Schema>) => Promise<any>
) => {
return command(schema, async (data: v.InferOutput<Schema>) => {
ensureSession();
return fn(data);
});
};

export type SegmentSummary = {
id: string;
name: string;
created_at: string;
subscriberCount?: number | null;
};

export const listSegments = guardedQuery(async (): Promise<SegmentSummary[]> => {
try {
const { event } = ensureSession();
const segments = await newsletter.listSegments(event);
return segments.map((s) => ({
id: s.id,
name: s.name,
created_at: s.created_at,
subscriberCount: s.subscriberCount || 0
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
const { event } = ensureSession();
const result = await newsletter.createSegment(event, { name });
if (!result.success) {
error(500, result.error || 'Failed to create segment');
}
await listSegments().refresh();
return { success: true, id: result.id };
}
);

export const deleteSegment = guardedCommand(
v.object({
segmentId: v.pipe(v.string(), v.nonEmpty())
}),
async ({ segmentId }) => {
const { event } = ensureSession();
const result = await newsletter.deleteSegment(event, segmentId);
if (!result.success) {
error(500, result.error || 'Failed to delete segment');
}
await listSegments().refresh();
return { success: true };
}
);

export type SegmentContact = {
id: string;
email: string;
first_name?: string;
last_name?: string;
created_at: string;
unsubscribed: boolean;
};

export const listSegmentContacts = guardedCommand(
v.object({
segmentId: v.pipe(v.string(), v.nonEmpty()),
limit: v.optional(v.number())
}),
async ({ segmentId, limit = 50 }) => {
const { event } = ensureSession();
const result = await newsletter.listSegmentContacts(event, segmentId, limit);
return {
contacts: result.contacts.map((contact) => ({
id: contact.id,
email: contact.email,
first_name: contact.firstName,
last_name: contact.lastName,
unsubscribed: contact.unsubscribed,
created_at: contact.created_at
})),
hasMore: result.hasMore
};
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
const { event } = ensureSession();
const result = await newsletter.addContactToSegment(event, {
segmentId,
email,
firstName,
lastName
});
if (!result.success) {
error(500, result.error || 'Failed to add subscriber');
}
return { success: true, id: result.id };
}
);

export const removeSegmentContact = guardedCommand(
v.object({
segmentId: v.pipe(v.string(), v.nonEmpty()),
contactId: v.optional(v.string()),
email: v.optional(v.string())
}),
async ({ segmentId, contactId, email }) => {
if (!contactId && !email) {
error(400, 'Contact identifier required');
}
const { event } = ensureSession();
const result = await newsletter.removeContactFromSegment(event, segmentId, contactId, email);
if (!result.success) {
error(500, result.error || 'Failed to remove subscriber');
}
return { success: true };
}
);

export type EmailTemplate = {
id: string;
name: string;
subject?: string;
html?: string;
created_at?: string;
updated_at?: string;
[key: string]: any;
};

export const listTemplates = guardedQuery(async (): Promise<EmailTemplate[]> => {
try {
const { event } = ensureSession();
const templates = await newsletter.listTemplates(event);
return templates;
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
const { event } = ensureSession();
const template = await newsletter.getTemplate(event, templateId);
return template;
}
);

export const createTemplate = guardedCommand(
v.object({
name: v.pipe(v.string(), v.nonEmpty()),
subject: v.pipe(v.string(), v.nonEmpty()),
html: v.pipe(v.string(), v.nonEmpty())
}),
async ({ name, subject, html }) => {
const { event } = ensureSession();
const result = await newsletter.createTemplate(event, { name, subject, html });
if (!result.success) {
error(500, result.error || 'Failed to create template');
}
await listTemplates().refresh();
return { success: true, id: result.id };
}
);

export const deleteTemplate = guardedCommand(
v.object({
templateId: v.pipe(v.string(), v.nonEmpty())
}),
async ({ templateId }) => {
const { event } = ensureSession();
const result = await newsletter.deleteTemplate(event, templateId);
if (!result.success) {
error(500, result.error || 'Failed to delete template');
}
await listTemplates().refresh();
return { success: true };
}
);

export const listBroadcasts = guardedQuery(async () => {
try {
const { event } = ensureSession();
const broadcasts = await newsletter.listBroadcasts(event);
return broadcasts;
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
const { event } = ensureSession();
const result = await newsletter.createBroadcast(event, {
segmentId: audienceId,
name: name || subject,
subject,
html,
text,
previewText,
scheduledAt: sendAt
});
if (!result.success) {
error(500, result.error || 'Failed to create broadcast');
}
await listBroadcasts().refresh();
return { success: true, id: result.id };
}
);

export const sendBroadcast = guardedCommand(
v.object({
broadcastId: v.pipe(v.string(), v.nonEmpty()),
scheduledAt: v.optional(v.string())
}),
async ({ broadcastId, scheduledAt }) => {
const { event } = ensureSession();
const result = await newsletter.sendBroadcast(event, broadcastId, scheduledAt);
if (!result.success) {
error(500, result.error || 'Failed to send broadcast');
}
await listBroadcasts().refresh();
return { success: true };
}
);

export const deleteBroadcast = guardedCommand(
v.object({
broadcastId: v.pipe(v.string(), v.nonEmpty())
}),
async ({ broadcastId }) => {
const { event } = ensureSession();
const result = await newsletter.deleteBroadcast(event, broadcastId);
if (!result.success) {
error(500, result.error || 'Failed to delete broadcast');
}
await listBroadcasts().refresh();
return { success: true };
}
);

const toMinutes = (value: number, unit: 'minutes' | 'hours' | 'days') => {
switch (unit) {
case 'days': return value * 24 * 60;
case 'hours': return value * 60;
default: return value;
}
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

export const listDripCampaigns = guardedQuery(async (): Promise<DripCampaignRecord[]> => {
try {
const { event } = ensureSession();
const campaigns = await newsletter.listCampaigns(event);
const result: DripCampaignRecord[] = [];
for (const campaign of campaigns) {
const fullCampaign = await newsletter.getCampaign(event, campaign.id);
if (fullCampaign) {
result.push({
id: fullCampaign.id,
name: fullCampaign.name,
description: fullCampaign.description,
segmentId: fullCampaign.segmentId,
segmentName: undefined,
status: fullCampaign.status,
startAt: fullCampaign.startAt,
createdAt: fullCampaign.created_at,
updatedAt: fullCampaign.updated_at,
lastLaunchAt: fullCampaign.lastLaunchAt,
metrics: {
contactsTargeted: fullCampaign.contactsTargeted,
totalScheduled: fullCampaign.totalScheduled,
totalSteps: fullCampaign.steps.length
},
steps: fullCampaign.steps.map((step) => ({
id: step.id,
label: step.label,
subject: step.subject,
previewText: step.previewText,
html: step.html,
text: step.text,
scheduleMode: step.scheduleMode,
sendAt: step.sendAt,
delayMinutes: step.delayMinutes,
status: step.status,
branching: step.monitorEvent ? {
monitor: step.monitorEvent,
successStepId: step.successStepId,
fallbackStepId: step.fallbackStepId,
evaluateAfterMinutes: step.evaluateAfterMinutes || 1440
} : null
}))
});
}
}
return result;
} catch (err) {
console.error('[newsletter.listDripCampaigns] error:', err);
return [];
}
});

export const saveDripCampaign = guardedCommand(DripCampaignInputSchema, async (payload) => {
const { event } = ensureSession();
const steps = payload.steps.map((step) => ({
id: step.id,
label: step.label,
subject: step.subject,
html: step.html,
text: step.text,
previewText: step.previewText,
scheduleMode: step.scheduleMode,
sendAt: step.scheduleMode === 'absolute' ? step.runAt : undefined,
delayMinutes: step.scheduleMode === 'relative' ? toMinutes(step.delayValue, step.delayUnit) : 0,
monitorEvent: step.branching?.monitor,
successStepId: step.branching?.successStepId,
fallbackStepId: step.branching?.fallbackStepId,
evaluateAfterMinutes: step.branching ? toMinutes(step.branching.evaluateValue || 1, step.branching.evaluateUnit || 'days') : undefined
}));
const result = await newsletter.saveCampaign(event, {
id: payload.id,
segmentId: payload.audienceId,
name: payload.name,
description: payload.description,
startAt: payload.startAt,
steps
});
if (!result.success) {
error(500, result.error || 'Failed to save campaign');
}
await listDripCampaigns().refresh();
return { success: true, id: result.id };
});

export const deleteDripCampaign = guardedCommand(
v.object({
id: v.pipe(v.string(), v.nonEmpty())
}),
async ({ id }) => {
const { event } = ensureSession();
const result = await newsletter.deleteCampaign(event, id);
if (!result.success) {
error(500, result.error || 'Failed to delete campaign');
}
await listDripCampaigns().refresh();
return { success: true };
}
);

export const launchDripCampaign = guardedCommand(
v.object({
id: v.pipe(v.string(), v.nonEmpty()),
startAt: v.optional(v.string())
}),
async ({ id, startAt }) => {
const { event } = ensureSession();
const result = await newsletter.launchCampaign(event, id, startAt);
if (!result.success) {
error(500, result.error || 'Failed to launch campaign');
}
await listDripCampaigns().refresh();
return {
success: true,
scheduledEmails: result.data?.scheduledEmails || 0,
contacts: result.data?.contacts || 0,
limited: false
};
}
);

export const processDripBranches = guardedCommand(
v.object({
limit: v.optional(v.number())
}),
async ({ limit = 25 }) => {
const { event } = ensureSession();
const result = await newsletter.processCampaignBranches(event, limit);
if (!result.success) {
error(500, result.error || 'Failed to process drip branches');
}
await listDripCampaigns().refresh();
return { processed: result.data?.processed || 0 };
}
);
