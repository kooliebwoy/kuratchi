import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';
import { headers } from 'kuratchi:request';

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
    ip = headers.get('cf-connecting-ip') || headers.get('x-forwarded-for') || null;
    userAgent = headers.get('user-agent') || null;
  } catch {
    // headers may be unavailable outside a request context
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
