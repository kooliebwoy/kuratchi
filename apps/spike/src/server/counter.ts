/**
 * Server-side data source — imported from routes via `$server/counter`.
 * In a real app this would talk to D1, a DO, an external API, etc.
 *
 * Uses `kuratchi:request` to read the current request URL for per-request
 * logging — the same virtual-module entry point the legacy compiler
 * exposes. Resolves to `@kuratchi/js/runtime/request.js` via the Vite
 * plugin's `resolveId` hook.
 */
// @ts-expect-error — kuratchi virtual module typed via app.d.ts in real apps
import { url } from 'kuratchi:request';

let counter = 0;

export function getCount(): number {
	// Touch `url` to prove the virtual module resolves correctly. In a
	// real app you'd use `url.pathname`, `url.searchParams`, etc.
	void url;
	return counter;
}

export function incrementCounter(): number {
	counter += 1;
	return counter;
}
