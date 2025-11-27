import type { RequestEvent } from '@sveltejs/kit';

export const load = async ({ locals }: RequestEvent) => {
	const { site, forms } = locals;

	// Site data and forms are already resolved in hooks.server.ts
	return {
		site: site || null,
		forms: forms || []
	};
};
