# @kuratchi/vite

Vite plugin for [KuratchiJS](https://kuratchi.dev) — the framework's
Vite-first development and build pipeline for Cloudflare Workers.

## Install

```bash
npm install @kuratchi/vite @kuratchi/js
npm install -D vite wrangler @cloudflare/workers-types @cloudflare/vite-plugin
```

## Use

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { kuratchiVite } from '@kuratchi/vite';

export default defineConfig({
  plugins: [kuratchiVite()],
});
```

That's it. The plugin discovers routes under `src/routes/**/*.kuratchi`,
generates a Workers-compatible worker entry, manages virtual modules
(`$server/*`, `$lib/*`, `kuratchi:request`, `kuratchi:layout`,
`kuratchi:manifest`, …), and keeps `wrangler.jsonc` in sync with
Durable Object / Queue / Workflow / Container conventions it finds in
`src/server/`.

## Documentation

All framework capabilities — routing, templates, server actions, client
interactivity, SSR data hydration, ORM, auth, and the full set of
Cloudflare primitive integrations — are documented at:

**[kuratchi.dev/docs](https://kuratchi.dev/docs)**

This package has no user-facing API beyond the plugin factory above.
Everything else is framework surface documented in the main docs
site.

## Requirements

- Vite 6+ or 7+
- Cloudflare Vite plugin 1.x (`@cloudflare/vite-plugin`)
- Node 20+ (or Bun)
- Wrangler 4.x (CLI only, not a runtime dep)

## License

MIT © the KuratchiJS contributors
