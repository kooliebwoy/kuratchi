import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getSdkDoc } from '$lib/sdk-docs';

export const load: PageLoad = ({ params }) => {
	const slug = params.slug;
	const doc = getSdkDoc(slug);

	if (!doc) {
		throw error(404, 'Documentation page not found');
	}

	return { doc };
};
