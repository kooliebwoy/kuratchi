/**
 * Global Error Handler with Activity Logging
 * 
 * Automatically logs errors to activity log
 */

import { getRequestEvent } from '$app/server';

export interface LogErrorOptions {
  error: Error | unknown;
  context?: string;
  data?: Record<string, any>;
  userId?: string;
}

/**
 * Log an error to the activity log
 * Automatically creates a 'system.error' activity with isHidden=true
 */
export async function logError(options: LogErrorOptions) {
  try {
    const { locals } = getRequestEvent();
    
    const errorMessage = options.error instanceof Error 
      ? options.error.message 
      : String(options.error);
    
    const errorStack = options.error instanceof Error 
      ? options.error.stack 
      : undefined;
    
    await locals.kuratchi?.activity?.logActivity?.({
      action: 'system.error',
      data: {
        context: options.context,
        error: errorMessage,
        stack: errorStack,
        ...options.data
      },
      status: false,
      userId: options.userId
    });
    
    // Also log to console for development
    console.error(`[Error] ${options.context || 'Unknown'}:`, options.error);
  } catch (err) {
    // Fallback if activity logging fails
    console.error('[Error Handler] Failed to log error:', err);
    console.error('[Original Error]:', options.error);
  }
}

/**
 * Wrap an async function with automatic error logging
 */
export function withErrorLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      await logError({ error, context });
      throw error; // Re-throw after logging
    }
  }) as T;
}
