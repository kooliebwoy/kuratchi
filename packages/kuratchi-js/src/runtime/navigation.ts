/**
 * Navigation helpers for kuratchi routes.
 * Import via: import { redirect } from 'kuratchi:navigation';
 * 
 * redirect() is server-side only — works in route scripts, server modules, and form actions.
 * It throws a RedirectError that the framework catches and converts to a 303 redirect response.
 */

export { redirect } from './context.js';
