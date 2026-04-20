# Vite Spike — Progress Anchor

**Branch:** `vite-spike`
**Goal:** Prove Kuratchi can sit on Vite + `@cloudflare/vite-plugin` with feature parity for the spike scope.
**Decision gate:** If all gates below pass, port `apps/web` to Vite and plan deprecation of the custom esbuild pipeline.

## Spike Gates

- [x] 1. `.kuratchi` route renders SSR via `@cloudflare/vite-plugin` + Miniflare (dev + `vite preview` prod)
- [x] 2a. **Template compilation** — `{expression}` interpolation, `if`/`for` control flow, HTML escaping, script-declared prelude vars — all via `@kuratchi/js/compiler` (shared with the legacy CLI)
- [x] 2b. **Leading `<script>` runs on server; `$server/*` imports resolve via Vite alias; top-level `await $server/fn()` pre-computes data variables.** `render()` is async so top-level await in the prelude works. Imports hoist to module scope, body runs inside `render` for per-request data.
- [x] 3a. **Server-action dispatch via `<form action={fn}>`** — parser emits `<input name="_action" value="<fn>">`, compiled module exports `actions = { fn }`, `kuratchi:dispatch` virtual module handles POST → action → 303 redirect (PRG). Verified end-to-end in dev AND prod.
- [x] 3b. **`$server/*` RPC from client-side code.** Client env `resolveId` rewrites `$server/<path>` → `virtual:kuratchi-rpc/<path>.ts`, which exports one `fetch('/__kuratchi/rpc/<path>/<fn>')` stub per exported identifier (scanned from the real server file via TS AST). Server-side, `kuratchi:rpc-map` statically imports every referenced `$server/*` module (no dynamic `import()` — Rollup-friendly) and the dispatcher looks them up by subpath. Verified dev + prod end-to-end: real `counter.ts` never ships to the browser, `fetch` calls round-trip correctly.
- [x] 4. **`$lib/*` AND bare npm import in template `<script>` both bundle** (dev). The DX bug that kicked this whole investigation off is gone: any import style works, no `$lib/` prefix required for npm.
- [x] 5. **`kuratchi:*` virtual modules resolve in SSR.** `kuratchi:request`, `kuratchi:navigation`, `kuratchi:environment`, `kuratchi:workflow` all rewrite via the plugin's `resolveId` to concrete paths under `@kuratchi/js/runtime/<name>.js`. The plugin resolves against its OWN `node_modules` (via `createRequire` on the plugin url) so host apps don't need `@kuratchi/js` as a direct dep.
- [ ] 6. HMR: template edit hot-swaps; `$lib/` edit hot-swaps; `$server/` edit triggers server reload
      Partial: route file edits trigger a `@cloudflare/vite-plugin` server restart + reload (works, but coarser than needed).
- [x] 7a. **Prod build, end-to-end.** `vite build` emits both SSR Worker (4.16 KB, 43 ms) and client fragments (11 KB hashed asset, 27 ms). Post-build hook patches the client manifest into the SSR bundle. `vite preview` → Miniflare serves SSR HTML with `/assets/<hash>.js` URLs that resolve correctly to the emitted client chunks.
- [ ] 7b. `wrangler deploy` end-to-end (ship-once verification)
- [x] 8. **Durable Object / Workflow / Sandbox / Container class binding reachable** via `kuratchi:worker` — the plugin auto-generates `export { ClassA, ClassB }` from the discovered `.workflow.ts`/`.do.ts`/`.sandbox.ts`/`.container.ts` files so Cloudflare binding resolution finds them. User's `src/worker.ts` is now a 2-line stub (`export { default } from 'kuratchi:worker'; export * from 'kuratchi:worker';`). Queue dispatch (`.queue.ts` consumers) wired into the default export's `queue()` handler via `batch.queue` switch.

## Strategic Shift (Phase A + B done)

Moved from "reimplement the Kuratchi compiler in the Vite plugin" to "expose the existing compiler's primitives from `@kuratchi/js/compiler` and have both the legacy CLI and the Vite plugin delegate into the same core."

- `@kuratchi/js/compiler` now exports `parseFile`, `compileTemplate`, `generateRenderFunction` (fixed to actually return `__html`), `splitTemplateRenderSections`, `VIRTUAL_MODULE_MAP`, plus script-transform helpers.
- `@kuratchi/vite` depends on `@kuratchi/js` via workspace and calls into these primitives.
- Tests: `bun run --cwd packages/kuratchi-js test` improved from 169 pass / 20 fail → **189 pass / 5 fail** (the fix to `generateRenderFunction` recovered 15 previously-failing tests). The remaining 5 are pre-existing and unrelated to this work.
- `apps/web` still builds under the legacy CLI — no regression.

## Phased path to full parity (see commits for progress)

| Phase | Scope | Status |
|---|---|---|
| A | Expose compiler primitives from `@kuratchi/js/compiler` | ✓ done |
| B | Wire `parseFile` + `compileTemplate` into Vite plugin — real `{expr}`, `if`, `for` | ✓ done |
| C.1 | Template-body `<script>` extraction + Vite-managed virtual modules, `$lib`/`$server` Vite aliases | ✓ done |
| C.2 | Prod-mode client-env Rollup entries + manifest-driven URL rewrite | ✓ done |
| C.3 | Leading `<script>` server execution + `kuratchi:dispatch` + `<form action={fn}>` PRG | ✓ done |
| C.4 | Client-side `$server/*` RPC stubs + dispatcher + `kuratchi:rpc-map` | ✓ done |
| C.5 | Middleware lifecycle (`middleware.ts` / legacy `runtime.hook.ts`) — request/route/response/error phases wired through dispatch | ✓ done |
| C.6 | `src/worker.ts` auto-generated on first dev/build (never overwrites) | ✓ done |
| D | `kuratchi:*` virtual modules resolve to `@kuratchi/js/runtime/*.js` | ✓ done |
| E | Root layouts (`routes/layout.kuratchi`) with `<slot>` → `{@raw __content}` | ✓ done |
| F | Wrangler sync for conventions + auto class re-export + queue dispatch | ✓ done |
| G | Type generation (reuse `type-generator.ts`) | — |
| H | CSS: delegate to Vite + `@tailwindcss/vite` | — |
| I | Assets: delegate to Vite | — |
| J | DO/workflow/queue/sandbox/container runtime | no change needed |
| K | Port `apps/web` to Vite — final parity check | — |

## Package Layout

- `packages/kuratchi-vite/` — new sibling package exporting `kuratchi()` Vite plugin
- `apps/spike/` — new minimal app exercising the gates above (NOT a port of `apps/web`)
- `apps/web/` — untouched during spike; remains on current compiler
- `packages/kuratchi-js/` — untouched during spike; current compiler stays the baseline

## Decision Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-04-19 | Sibling package, not inside `kuratchi-js` | Clean isolation during spike; fold-back on success |
| 2026-04-19 | New minimal app, not port of `apps/web` | `apps/web` is validation baseline; don't conflate "Vite works" with "port correct" |
| 2026-04-19 | Skip Point 1 (template-script bundling DX) on current compiler | Vite inherits the fix for free; no reason to do it twice |
| 2026-04-19 | Route files use `.kuratchi` extension, not `.html` | The files aren't HTML — they contain JS control flow (`if`/`for`), `{expression}` interpolation, `$server/*` RPC imports. A dedicated extension lets Vite/Rollup/Prettier/editors/agents route through the right handler instead of fighting HTML-tooling assumptions. Matches Svelte/Vue/Astro precedent. |
| 2026-04-19 | Expose compiler primitives from `@kuratchi/js/compiler`; Vite plugin delegates, doesn't duplicate | Prevents two-compiler drift, preserves legacy CLI + `apps/web` as a live baseline, cuts expected Vite-plugin LoC by ~80%. |
| 2026-04-19 | Fixed `generateRenderFunction` to actually `return __html` + accept `dataVars` | Pre-existing dead-code-ish export; no callers internally, but it's the right shape for external consumers. Fix recovered 15 previously-failing tests as side effect. |

## Out of Scope

- Auth/ORM/UI package integration (runtime code — will work or not independent of bundler)
- `apps/web` port (follows successful spike)
- `kuratchi create` scaffolder updates
- Removing old compiler (stays until parity proven)

## How to Resume

1. `git checkout vite-spike`
2. Check next unchecked gate above
3. Spike code is in `packages/kuratchi-vite/` and `apps/spike/`
4. Reference architecture: `packages/kuratchi-js/src/compiler/` — the behavior we're replicating
