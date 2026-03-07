import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';
import { getRequest } from '@kuratchi/js';

const db = kuratchiORM(() => (env as any).DB);

interface AuditEntry {
  action: string;
  userId?: string | null;
  organizationId?: string | null;
  data?: Record<string, any>;
  isAdminAction?: boolean;
}

/**
 * Log an action to the activity table. Fire-and-forget -- errors are swallowed
 * so audit logging never blocks the primary operation.
 */
export function logActivity(entry: AuditEntry): void {
  const now = new Date().toISOString();
  let ip: string | null = null;
  let userAgent: string | null = null;

  try {
    const request = getRequest();
    ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || null;
    userAgent = request.headers.get('user-agent') || null;
  } catch {
    // getRequest() may fail outside a request context
  }

  db.activity.insert({
    id: crypto.randomUUID(),
    action: entry.action,
    userId: entry.userId || null,
    organizationId: entry.organizationId || null,
    data: entry.data ? JSON.stringify(entry.data) : '{}',
    status: true,
    isAdminAction: entry.isAdminAction ?? false,
    isHidden: false,
    ip,
    userAgent,
    created_at: now,
    updated_at: now,
  }).catch((err) => {
    console.warn('[audit] Failed to log activity:', err);
  });
}
