import { getRequestEvent, query, form } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db-context';

// Helpers
const guardedQuery = <R>(fn: () => Promise<R>) => {
  return query(async () => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');
    return fn();
  });
};

const guardedForm = <R>(
  schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
  fn: (data: any) => Promise<R>
) => {
  return form(schema as any, async (data: any) => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');

    return fn(data);
  });
};

// Queries
export const getSessions = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const db = await getDatabase(locals);

    // Get all active sessions from database
    const sessionsResult = await db.session
      .where({ expires: { gt: new Date().toISOString() } })
      .orderBy({ created_at: 'desc' })
      .many();
    
    const sessions = sessionsResult?.data || [];

    // Get users for each session
    const userIds = [...new Set(sessions.map((s: any) => s.userId))];
    const usersResult = await db.users
      .where({ id: { in: userIds } })
      .many();
    
    const users = usersResult?.data || [];
    const userMap = new Map<string, any>(users.map((u: any) => [u.id, u] as [string, any]));

    // Enrich sessions with user data
    const enrichedSessions = sessions.map((session: any) => {
      const user = userMap.get(session.userId);
      const now = new Date();
      const expiresAt = session.expires ? new Date(session.expires) : null;
      const isExpired = expiresAt ? expiresAt < now : false;

      return {
        id: session.id,
        sessionToken: session.sessionToken,
        userId: session.userId,
        userName: user?.name || 'Unknown',
        userEmail: user?.email || 'Unknown',
        createdAt: session.created_at,
        expiresAt: session.expires,
        lastAccessedAt: session.lastAccessedAt || session.created_at,
        ipAddress: session.ipAddress || 'Unknown',
        userAgent: session.userAgent || 'Unknown',
        isExpired,
        isCurrent: false // Will be set based on current session
      };
    });

    return enrichedSessions;
  } catch (err) {
    console.error('[sessions.getSessions] error:', err);
    return [];
  }
});

export const getUserSessions = guardedQuery(async () => {
  try {
    const { locals, url } = getRequestEvent();
    const userId = url.searchParams.get('userId');
    if (!userId) error(400, 'User ID required');

    const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
    if (!adminDb) error(500, 'Admin database not configured');

    // Get sessions for specific user
    const sessionsResult = await adminDb.session
      .where({ userId })
      .orderBy({ created_at: 'desc' })
      .many();
    
    const sessions = sessionsResult?.data || [];

    // Get user details
    const userResult = await adminDb.users
      .where({ id: userId })
      .first();
    
    const user = userResult?.data;

    const enrichedSessions = sessions.map((session: any) => {
      const now = new Date();
      const expiresAt = session.expires ? new Date(session.expires) : null;
      const isExpired = expiresAt ? expiresAt < now : false;

      return {
        id: session.id,
        sessionToken: session.sessionToken,
        userId: session.userId,
        userName: user?.name || 'Unknown',
        userEmail: user?.email || 'Unknown',
        createdAt: session.created_at,
        expiresAt: session.expires,
        lastAccessedAt: session.lastAccessedAt || session.created_at,
        ipAddress: session.ipAddress || 'Unknown',
        userAgent: session.userAgent || 'Unknown',
        isExpired,
        isCurrent: false
      };
    });

    return enrichedSessions;
  } catch (err) {
    console.error('[sessions.getUserSessions] error:', err);
    error(500, 'Failed to get user sessions');
  }
});

export const getSessionStats = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
    if (!adminDb) error(500, 'Admin database not configured');

    const now = new Date().toISOString();

    // Get all sessions
    const allSessionsResult = await adminDb.session.many();
    const allSessions = allSessionsResult?.data || [];

    // Get active sessions (not expired)
    const activeSessions = allSessions.filter((s: any) => {
      if (!s.expires) return true;
      return new Date(s.expires) > new Date(now);
    });

    // Get unique active users
    const activeUserIds = new Set(activeSessions.map((s: any) => s.userId));

    // Get sessions created in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentSessions = allSessions.filter((s: any) => s.created_at > oneDayAgo);

    return {
      totalSessions: allSessions.length,
      activeSessions: activeSessions.length,
      activeUsers: activeUserIds.size,
      sessionsLast24h: recentSessions.length,
      expiredSessions: allSessions.length - activeSessions.length
    };
  } catch (err) {
    console.error('[sessions.getSessionStats] error:', err);
    return {
      totalSessions: 0,
      activeSessions: 0,
      activeUsers: 0,
      sessionsLast24h: 0,
      expiredSessions: 0
    };
  }
});

// Forms
export const revokeSession = guardedForm(
  v.object({ sessionToken: v.pipe(v.string(), v.nonEmpty()) }),
  async ({ sessionToken }) => {
    try {
      const { locals } = getRequestEvent();
      const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
      if (!adminDb) error(500, 'Admin database not configured');

      // Delete the session
      await adminDb.session
        .where({ sessionToken })
        .delete();

      await getSessions().refresh();
      return { success: true };
    } catch (err) {
      console.error('[sessions.revokeSession] error:', err);
      error(500, 'Failed to revoke session');
    }
  }
);

export const revokeAllUserSessions = guardedForm(
  v.object({ userId: v.pipe(v.string(), v.nonEmpty()) }),
  async ({ userId }) => {
    try {
      const { locals } = getRequestEvent();
      const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
      if (!adminDb) error(500, 'Admin database not configured');

      // Delete all sessions for the user
      await adminDb.session
        .where({ userId })
        .delete();

      await getSessions().refresh();
      return { success: true };
    } catch (err) {
      console.error('[sessions.revokeAllUserSessions] error:', err);
      error(500, 'Failed to revoke all sessions');
    }
  }
);

export const cleanupExpiredSessions = guardedForm(
  v.object({}),
  async () => {
    try {
      const { locals } = getRequestEvent();
      const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
      if (!adminDb) error(500, 'Admin database not configured');

      const now = new Date().toISOString();

      // Delete expired sessions
      const result = await adminDb.session
        .where({ expires: { lt: now } })
        .delete();

      await getSessions().refresh();
      await getSessionStats().refresh();
      
      return { success: true, deletedCount: result?.deletedCount || 0 };
    } catch (err) {
      console.error('[sessions.cleanupExpiredSessions] error:', err);
      error(500, 'Failed to cleanup expired sessions');
    }
  }
);
