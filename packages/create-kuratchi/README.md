# create-kuratchi

Scaffold a new [KuratchiJS](https://github.com/kooliebwoy/kuratchi) project — Vite-first by default.

```bash
# npm
npm create kuratchi@latest my-app

# bun
bun create kuratchi my-app

# pnpm
pnpm create kuratchi my-app
```

## Flags

- `--yes` / `-y` — accept all defaults, skip prompts.
- `--do` — include a Durable Object example.
- `--legacy` — scaffold the legacy Wrangler-CLI template instead of the default Vite template.

## What you get

**Default (Vite):**

```
my-app/
  package.json            scripts: vite, vite build, wrangler deploy
  vite.config.ts          kuratchiVite() plugin
  wrangler.jsonc          assets + D1/DO bindings (opt-in)
  src/worker.ts           re-exports kuratchi:worker
  src/middleware.ts       defineMiddleware({ ... })
  src/routes/*.kuratchi   file-based routes
  src/assets/styles.css
```

**Legacy (`--legacy`):**

Legacy Wrangler-CLI scaffold — emits `.kuratchi/worker.ts` via `kuratchi build`. Useful only for existing projects or deployments that explicitly avoid Vite.
