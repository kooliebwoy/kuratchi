import { renderMarkdown } from '$lib/sdk-docs';
import overview from '../content/database/overview.md?raw';

export type DatabaseDocSlug = 'overview';

interface DatabaseDocDefinition {
	slug: DatabaseDocSlug;
	title: string;
	body: string;
}

const DOCS: DatabaseDocDefinition[] = [
	{
		slug: 'overview',
		title: 'Database Platform Overview',
		body: overview
	}
];

export const DATABASE_SECTIONS = DOCS.map(({ slug, title }) => ({ slug, title }));

export function getDatabaseDoc(slug: string) {
	const entry = DOCS.find((doc) => doc.slug === slug);
	if (!entry) return null;

	return {
		slug: entry.slug,
		title: entry.title,
		html: renderMarkdown(entry.body)
	};
}
