import { getRequestEvent } from '$app/server';

export async function logActivity(
  action: string,
  options?: {
    data?: Record<string, any>;
    status?: boolean;
    isAdminAction?: boolean;
    isHidden?: boolean;
    organizationId?: string;
  }
) {
  const { locals } = getRequestEvent();
  const activity = locals.kuratchi?.activity;
  if (!activity?.logActivity) {
    throw new Error('Activity logger not available');
  }
  return activity.logActivity({
    action,
    ...options
  });
}
