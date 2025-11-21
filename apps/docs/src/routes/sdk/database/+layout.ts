import type { LayoutLoad } from './$types';
import { DATABASE_SECTIONS, type DatabaseDocSlug } from '$lib/database-docs';

export const load: LayoutLoad = ({ url }) => {
	const segments = url.pathname.split('/').filter(Boolean);

	let active: DatabaseDocSlug = 'overview';
	if (segments.length >= 3 && segments[0] === 'sdk' && segments[1] === 'database') {
		const slug = segments[2] as DatabaseDocSlug;
		if (DATABASE_SECTIONS.some((section) => section.slug === slug)) {
			active = slug;
		}
	}

	return {
		sections: DATABASE_SECTIONS,
		activeSlug: active
	};
};
