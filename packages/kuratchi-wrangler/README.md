# @kuratchi/wrangler

Legacy CLI and Wrangler-native build pipeline for KuratchiJS apps.

> **New projects should use [`@kuratchi/vite`](../kuratchi-vite)**, which is the default KuratchiJS build system. This package exists for existing apps that use the original `kuratchi build` / `kuratchi watch` CLI flow and for projects that prefer a Wrangler-only toolchain without Vite.

## What's here

- The `kuratchi` CLI bin (`build`, `watch`, `dev`, `create`)
- The legacy generated-worker template used by the CLI to emit `.kuratchi/worker.ts`

Everything runtime-related — routing helpers, context, security, schema, compiler, navigation — lives in [`@kuratchi/js`](../kuratchi-js).

## Install

```bash
npm install -D @kuratchi/wrangler
```

Wire the CLI into your `package.json`:

```json
{
  "scripts": {
    "dev": "kuratchi dev",
    "build": "kuratchi build"
  }
}
```

Your `wrangler.jsonc` should keep pointing at `.kuratchi/worker.ts`, which the CLI generates.
