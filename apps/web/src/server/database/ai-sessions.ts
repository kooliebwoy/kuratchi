import { db } from '../api/db';

export interface AiSessionRecord {
  id: string;
  organizationId: string;
  title: string | null;
  model: string;
  lastUserMessage: string | null;
  lastAssistantMessage: string | null;
  messageCount: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

interface UpsertAiSessionInput {
  id: string;
  organizationId: string;
  model: string;
  title?: string | null;
  lastUserMessage?: string | null;
  lastAssistantMessage?: string | null;
  messageCount?: number;
}

function normalizePreview(value: string | null | undefined, limit = 160): string | null {
  const text = value?.trim();
  if (!text) return null;
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

export function deriveSessionTitle(messages: { role: string; content: string }[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user')?.content?.trim();
  if (!firstUserMessage) return 'New session';
  if (firstUserMessage.length <= 72) return firstUserMessage;
  return `${firstUserMessage.slice(0, 71)}…`;
}

export async function getAiSession(id: string, organizationId: string): Promise<AiSessionRecord | null> {
  const result = await db.aiSessions.where({ id, organizationId, archived: false }).first();
  return (result.data as AiSessionRecord | null) ?? null;
}

export async function listAiSessions(organizationId: string): Promise<AiSessionRecord[]> {
  const result = await db.aiSessions.where({ organizationId, archived: false }).orderBy({ updated_at: 'desc' }).many();
  return (result.data as AiSessionRecord[] | null) ?? [];
}

export async function createAiSession(input: UpsertAiSessionInput): Promise<AiSessionRecord> {
  const now = new Date().toISOString();
  const record: AiSessionRecord = {
    id: input.id,
    organizationId: input.organizationId,
    title: normalizePreview(input.title, 80) ?? 'New session',
    model: input.model,
    lastUserMessage: normalizePreview(input.lastUserMessage),
    lastAssistantMessage: normalizePreview(input.lastAssistantMessage),
    messageCount: input.messageCount ?? 0,
    archived: false,
    created_at: now,
    updated_at: now,
  };

  await db.aiSessions.insert(record);
  return record;
}

export async function upsertAiSession(input: UpsertAiSessionInput): Promise<AiSessionRecord> {
  const existing = await getAiSession(input.id, input.organizationId);
  if (!existing) {
    return createAiSession(input);
  }

  const nextRecord: AiSessionRecord = {
    ...existing,
    model: input.model || existing.model,
    title: normalizePreview(input.title, 80) ?? existing.title ?? 'New session',
    lastUserMessage: normalizePreview(input.lastUserMessage) ?? existing.lastUserMessage,
    lastAssistantMessage: normalizePreview(input.lastAssistantMessage) ?? existing.lastAssistantMessage,
    messageCount: input.messageCount ?? existing.messageCount,
    updated_at: new Date().toISOString(),
  };

  await db.aiSessions.update({ id: existing.id }, {
    model: nextRecord.model,
    title: nextRecord.title,
    lastUserMessage: nextRecord.lastUserMessage,
    lastAssistantMessage: nextRecord.lastAssistantMessage,
    messageCount: nextRecord.messageCount,
    updated_at: nextRecord.updated_at,
  });

  return nextRecord;
}
