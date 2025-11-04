import type { RequestEvent } from '@sveltejs/kit';

export const load = async ({ locals }: RequestEvent) => {
	const { site } = locals;

	// Site data is already resolved in hooks.server.ts
	return {
		site: site || null
	};
};
