import type { LayoutLoad } from './$types';
import { SDK_SECTIONS } from '$lib/sdk-docs';

export const load: LayoutLoad = ({ url }) => {
	const segments = url.pathname.split('/').filter(Boolean);

	let derivedSlug: (typeof SDK_SECTIONS)[number]['slug'] = 'overview';
	if (segments[0] === 'sdk') {
		const sub = segments[1];
		if (!sub) {
			derivedSlug = 'overview';
		} else if (sub === 'database') {
			derivedSlug = 'database';
		} else if (SDK_SECTIONS.some((section) => section.slug === sub)) {
			derivedSlug = sub as (typeof SDK_SECTIONS)[number]['slug'];
		}
	}

	return {
		sections: SDK_SECTIONS,
		activeSlug: derivedSlug
	};
};
