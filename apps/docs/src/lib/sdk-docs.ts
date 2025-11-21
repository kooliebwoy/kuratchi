import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';

import sdkReadme from '../../../../packages/kuratchi-sdk/README.md?raw';
import authDoc from '../../../../packages/kuratchi-sdk/src/docs/auth.md?raw';
import cliDoc from '../../../../packages/kuratchi-sdk/src/docs/cli.md?raw';
import ormDoc from '../../../../packages/kuratchi-sdk/src/docs/orm.md?raw';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('json', json);

const md = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true,
	highlight(code, lang) {
		if (lang && hljs.getLanguage(lang)) {
			try {
				const highlighted = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
				return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
			} catch {
				// fall through to auto-detection
			}
		}

		try {
			const auto = hljs.highlightAuto(code, ['typescript', 'javascript', 'bash', 'json']);
			const language = auto.language ?? 'plaintext';
			return `<pre><code class="hljs language-${language}">${auto.value}</code></pre>`;
		} catch {
			return `<pre><code>${code}</code></pre>`;
		}
	}
});

export const renderMarkdown = (content: string) => md.render(content);

export type SdkDocSlug = 'overview' | 'auth' | 'cli' | 'orm';

export type SdkSection = {
	slug: SdkDocSlug | 'database';
	title: string;
	href?: string;
};

interface SdkDocDefinition {
	slug: SdkDocSlug;
	title: string;
	body: string;
}

const DOCS: SdkDocDefinition[] = [
	{
		slug: 'overview',
		title: 'Kuratchi SDK Overview',
		body: sdkReadme
	},
	{
		slug: 'auth',
		title: 'Auth Guide',
		body: authDoc
	},
	{
		slug: 'cli',
		title: 'CLI Reference',
		body: cliDoc
	},
	{
		slug: 'orm',
		title: 'ORM Guide',
		body: ormDoc
	}
];

export const SDK_SECTIONS: SdkSection[] = [
	{ slug: 'overview', title: 'Kuratchi SDK Overview' },
	{ slug: 'auth', title: 'Auth Guide' },
	{ slug: 'database', title: 'Database Guide', href: '/sdk/database' },
	{ slug: 'cli', title: 'CLI Reference' },
	{ slug: 'orm', title: 'ORM Guide' }
];

export function getSdkDoc(slug: string) {
	const entry = DOCS.find((doc) => doc.slug === slug);
	if (!entry) return null;

	return {
		slug: entry.slug,
		title: entry.title,
		html: md.render(entry.body)
	};
}
