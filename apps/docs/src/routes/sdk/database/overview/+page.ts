import type { PageLoad } from './$types';
import { getDatabaseDoc } from '$lib/database-docs';

export const load: PageLoad = () => {
	const doc = getDatabaseDoc('overview');
	if (!doc) {
		throw new Error('Database overview doc not found');
	}

	return { doc };
};
