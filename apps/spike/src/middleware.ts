/**
 * Minimal middleware to prove the runtime lifecycle fires per request.
 * Real apps populate `ctx.locals` with auth state, feature flags, etc.
 *
 * Convention: `src/server/middleware.ts` (preferred) or
 * `src/server/runtime.hook.ts` (legacy — still recognized). Default-exports
 * a RuntimeDefinition — a map of step names to phase handlers.
 */

// Types intentionally loose here — the spike app doesn't list
// `@kuratchi/js` as a direct dep. In a real app you'd annotate with
// `RuntimeDefinition` from `@kuratchi/js`.
const runtime = {
	observe: {
		async request(ctx: any, next: () => Promise<Response>) {
			const started = Date.now();
			ctx.locals.requestStart = started;
			const response = await next();
			const elapsed = Date.now() - started;
			response.headers.set('x-kuratchi-took-ms', String(elapsed));
			return response;
		},
	},
};

export default runtime;
