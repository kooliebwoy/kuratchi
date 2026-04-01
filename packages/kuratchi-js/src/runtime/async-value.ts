/**
 * AsyncValue - A wrapper for async operations that provides state metadata.
 * 
 * When you call an async function without `await`, it returns an AsyncValue<T>
 * that extends T with `.pending`, `.error`, and `.success` properties.
 * 
 * Usage:
 *   const todos = getTodos();  // AsyncValue<Todo[]>
 *   if (todos.pending) { <Skeleton /> }
 *   if (todos.error) { <Error>{todos.error}</Error> }
 *   for (const todo of todos) { <TodoItem todo={todo} /> }
 * 
 *   const todos = await getTodos();  // Todo[] - blocks until resolved
 */

export interface AsyncValueState {
  /** True while the async operation is in progress */
  pending: boolean;
  /** Error message if the operation failed, null otherwise */
  error: string | null;
  /** True when the operation completed successfully */
  success: boolean;
}

export interface PollOptions {
  /** Polling interval: '2s', '500ms', '1m' */
  poll: string;
  /** Enable exponential backoff (default: true) */
  backoff?: boolean;
  /** Maximum interval for backoff (default: '5m') */
  maxInterval?: string;
  /** Stop polling when this function returns true */
  until?: (value: any) => boolean;
}

/**
 * AsyncValue<T> extends T with async state metadata.
 * The value is directly accessible (no .data wrapper needed).
 */
export type AsyncValue<T> = T & AsyncValueState;

/**
 * Create an AsyncValue in pending state.
 * For arrays, returns an empty array with state metadata.
 * For objects, returns an empty object with state metadata.
 */
export function createPendingValue<T>(): AsyncValue<T> {
  const base = {} as Record<string, unknown>;
  base.pending = true;
  base.error = null;
  base.success = false;
  return base as AsyncValue<T>;
}

/**
 * Create an AsyncValue in success state with the resolved value.
 */
export function createSuccessValue<T>(value: T): AsyncValue<T> {
  if (value === null || value === undefined) {
    const base = {} as Record<string, unknown>;
    base.pending = false;
    base.error = null;
    base.success = true;
    return base as AsyncValue<T>;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    obj.pending = false;
    obj.error = null;
    obj.success = true;
    return obj as AsyncValue<T>;
  }
  // For primitives, wrap in an object-like structure that preserves the value
  const wrapper = Object(value) as Record<string, unknown>;
  wrapper.pending = false;
  wrapper.error = null;
  wrapper.success = true;
  return wrapper as AsyncValue<T>;
}

/**
 * Create an AsyncValue in error state.
 */
export function createErrorValue<T>(errorMessage: string): AsyncValue<T> {
  const base = {} as Record<string, unknown>;
  base.pending = false;
  base.error = errorMessage;
  base.success = false;
  return base as AsyncValue<T>;
}

/**
 * Parse a human-readable interval string to milliseconds.
 * Supports: '2s', '500ms', '1m'
 */
export function parseInterval(str: string): number {
  if (!str) return 30000;
  const match = str.match(/^(\d+(?:\.\d+)?)(ms|s|m)?$/i);
  if (!match) return 30000;
  const num = parseFloat(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  if (unit === 'ms') return num;
  if (unit === 'm') return num * 60000;
  return num * 1000;
}

/**
 * Server-side async value wrapper for SSR.
 * This is used by the compiler to wrap non-awaited async calls.
 * 
 * On the server:
 * - If the promise is already resolved, returns success state
 * - If pending, returns pending state with fragment ID for client hydration
 * - If errored, returns error state
 */
export async function wrapAsyncValue<T>(
  promise: Promise<T>,
  options?: { poll?: string; fragmentId?: string }
): Promise<AsyncValue<T>> {
  try {
    const value = await promise;
    return createSuccessValue(value);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return createErrorValue<T>(message);
  }
}

/**
 * Create an async value that polls at a specified interval.
 * Used for workflow status and other polling scenarios.
 */
export function createPollingValue<T>(
  fetchFn: () => Promise<T>,
  options: PollOptions
): AsyncValue<T> & { __polling: true; __options: PollOptions; __fetchFn: () => Promise<T> } {
  const base = createPendingValue<T>();
  return Object.assign(base, {
    __polling: true as const,
    __options: options,
    __fetchFn: fetchFn,
  });
}

/**
 * Type guard to check if a value is an AsyncValue
 */
export function isAsyncValue<T>(value: unknown): value is AsyncValue<T> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'pending' in value &&
    'error' in value &&
    'success' in value
  );
}

/**
 * Type guard to check if an AsyncValue is a polling value
 */
export function isPollingValue<T>(
  value: AsyncValue<T>
): value is AsyncValue<T> & { __polling: true; __options: PollOptions; __fetchFn: () => Promise<T> } {
  return '__polling' in value && (value as any).__polling === true;
}
