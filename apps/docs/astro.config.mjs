// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Kuratchi SDK',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/kooliebwoy/kuratchi' }],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Hooks Setup', slug: 'getting-started/hooks' },
					],
				},
				{
					label: 'Examples',
					items: [
						{ label: 'Credentials Auth', slug: 'examples/credentials-auth' },
					],
				},
				{
      label: 'ORM',
      // Autogenerate a group of links for the 'constellations' directory.
      autogenerate: { directory: 'orm' },
    },
			],
		}),
	],
});
