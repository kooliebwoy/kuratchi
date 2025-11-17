import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		alias: {
			$components: 'src/lib/components',
			$lib: 'src/lib'
		},
		adapter: adapter({
			config: 'wrangler.jsonc',
			platformProxy: {
				configPath: 'wrangler.jsonc',
				environment: undefined,
				persist: true
			},
			routes: {
				include: ['/*'],
				exclude: ['<all>']
			}
		})
	}
};

export default config;
