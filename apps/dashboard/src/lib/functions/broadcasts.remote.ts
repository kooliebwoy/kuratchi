/**
 * Broadcast Emails - Send bulk emails to segments via SES
 */

import { getRequestEvent, query, command } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { sendEmail } from 'kuratchi-sdk/email';
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

export type BroadcastRecord = {
  id: string;
  name: string;
  subject: string;
  html: string;
  segmentId: string;
  segmentName?: string;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  scheduledAt?: string;
  sentAt?: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  created_at: string;
  updated_at: string;
};

/**
 * Get broadcasts table from org database
 */
async function getBroadcastsTable() {
  const { event, session } = ensureSession();
  const organizationId = session.organizationId;
  
  if (!organizationId) {
    throw new Error('No organization ID in session');
  }
  
  const orgDb = await event.locals.kuratchi?.orgDatabaseClient?.(organizationId);
  
  if (!orgDb?.broadcasts) {
    throw new Error('Broadcasts table not found');
  }
  
  return orgDb.broadcasts;
}

/**
 * List all broadcasts
 */
export const listBroadcasts = guardedQuery(async (): Promise<BroadcastRecord[]> => {
  try {
    const table = await getBroadcastsTable();
    const result = await table
      .where({ deleted_at: { isNullish: true } })
      .orderBy({ created_at: 'desc' })
      .many();
    
    return result?.data || [];
  } catch (err) {
    console.error('[broadcasts.listBroadcasts] error:', err);
    return [];
  }
});

/**
 * Create a new broadcast (draft)
 */
export const createBroadcast = guardedCommand(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty()),
    subject: v.pipe(v.string(), v.nonEmpty()),
    html: v.pipe(v.string(), v.nonEmpty()),
    segmentId: v.pipe(v.string(), v.nonEmpty()),
    scheduledAt: v.optional(v.string())
  }),
  async ({ name, subject, html, segmentId, scheduledAt }) => {
    const { event } = ensureSession();
    const table = await getBroadcastsTable();
    
    // Get segment details
    const segments = await newsletter.listSegments(event);
    const segment = segments.find(s => s.id === segmentId);
    
    const broadcast = {
      id: crypto.randomUUID(),
      name,
      subject,
      html,
      segmentId,
      segmentName: segment?.name || '',
      status: 'draft' as const,
      scheduledAt: scheduledAt || null,
      sentAt: null,
      totalRecipients: segment?.subscriberCount || 0,
      sentCount: 0,
      deliveredCount: 0,
      openedCount: 0,
      clickedCount: 0,
      bouncedCount: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    };
    
    const result = await table.insert(broadcast);
    
    if (!result.success) {
      error(500, 'Failed to create broadcast');
    }
    
    return { success: true, id: broadcast.id };
  }
);

/**
 * Send broadcast to all contacts in segment
 */
export const sendBroadcast = guardedCommand(
  v.object({
    broadcastId: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ broadcastId }) => {
    const { event, session } = ensureSession();
    const table = await getBroadcastsTable();
    
    // Get broadcast
    const broadcastResult = await table.where({ id: broadcastId }).first();
    const broadcast = broadcastResult?.data;
    
    if (!broadcast) {
      error(404, 'Broadcast not found');
    }
    
    if (broadcast.status === 'sent') {
      error(400, 'Broadcast already sent');
    }
    
    // Update status to sending
    await table.where({ id: broadcastId }).update({
      status: 'sending',
      updated_at: new Date().toISOString()
    });
    
    try {
      // Get segment contacts
      const contacts = await newsletter.listSegmentContacts(event, broadcast.segmentId, 1000);
      
      if (!contacts || contacts.contacts.length === 0) {
        throw new Error('No contacts found in segment');
      }
      
      let sentCount = 0;
      const errors: string[] = [];
      
      // Send to each contact
      for (const contact of contacts.contacts) {
        if (contact.unsubscribed) continue;
        
        try {
          const result = await sendEmail(event, {
            to: contact.email,
            subject: broadcast.subject,
            html: broadcast.html,
            emailType: 'broadcast',
            metadata: {
              broadcastId: broadcast.id,
              broadcastName: broadcast.name,
              segmentId: broadcast.segmentId
            }
          });
          
          if (result.success) {
            sentCount++;
          } else {
            errors.push(`${contact.email}: ${result.error}`);
          }
        } catch (err) {
          errors.push(`${contact.email}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
      
      // Update broadcast with results
      await table.where({ id: broadcastId }).update({
        status: sentCount > 0 ? 'sent' : 'failed',
        sentAt: new Date().toISOString(),
        sentCount,
        updated_at: new Date().toISOString()
      });
      
      return { 
        success: true, 
        sentCount, 
        totalRecipients: contacts.contacts.filter(c => !c.unsubscribed).length,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (err) {
      // Update status to failed
      await table.where({ id: broadcastId }).update({
        status: 'failed',
        updated_at: new Date().toISOString()
      });
      
      throw err;
    }
  }
);

/**
 * Delete a broadcast
 */
export const deleteBroadcast = guardedCommand(
  v.object({
    broadcastId: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ broadcastId }) => {
    const table = await getBroadcastsTable();
    
    await table.where({ id: broadcastId }).update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    return { success: true };
  }
);
