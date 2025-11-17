import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ platform }) => {
	return {
		platform: platform?.env ? true : false
	};
};
