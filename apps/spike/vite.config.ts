import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { kuratchi } from '@kuratchi/vite';

// SSR inside the Cloudflare Worker — same environment naming convention that
// TanStack Start / React Router v7 use with `@cloudflare/vite-plugin`. The
// Worker serves the HTML directly; there is no separate Node SSR process.
export default defineConfig({
	plugins: [
		kuratchi(),
		cloudflare({ viteEnvironment: { name: 'ssr' } }),
	],
});
