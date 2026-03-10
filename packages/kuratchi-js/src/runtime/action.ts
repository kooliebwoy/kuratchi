/**
 * ActionError — throw from a form action to surface a user-facing error.
 *
 * Throwing an ActionError makes the error message available in the template
 * as `actionName.error` (e.g. `signIn.error`). Throwing a plain Error in
 * production shows a generic "Action failed" message instead.
 */
export class ActionError extends Error {
  readonly isActionError = true;
  constructor(message: string) {
    super(message);
    this.name = 'ActionError';
  }
}
