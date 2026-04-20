# @kuratchi/js

## Unreleased

### Breaking Changes

- **Workflow status API unified under `kuratchi:workflow`.** The auto-generated
  `<camel>WorkflowStatus(id, opts)` globals (one per `*.workflow.ts` file) have
  been removed. Import `workflowStatus` from the new `kuratchi:workflow`
  virtual module instead and pass the workflow name as the first argument:

  ```ts
  // Before:
  const status = migrationWorkflowStatus(params.id, { poll: '2s' });

  // After:
  import { workflowStatus } from 'kuratchi:workflow';
  const status = await workflowStatus('migration', params.id, { poll: '2s' });
  ```

  The first argument is typed as a string-literal union (`WorkflowName`) of
  your discovered `*.workflow.ts` basenames, so unknown names fail type-check.

- **`{ poll }` polling now refreshes the whole route**, replacing the
  element-scoped `data-poll={fn()} data-interval="…"` fragment mechanism for
  live workflow status. The framework injects a small directive script when
  polling is active, re-fetches the URL on each tick, and swaps `<body>`
  with the freshly rendered HTML. Stops automatically when `until(status)`
  returns true. Default `until` treats `'complete'`, `'completed'`,
  `'errored'`, or `'terminated'` as terminal.

## 0.0.14

### Patch Changes

- Consolidate all framework virtual modules under `kuratchi:*` prefix:
  - `kuratchi:environment` — `{ dev }` for build mode detection
  - `kuratchi:request` — `{ url, pathname, params, locals, headers, method, slug }`
  - `kuratchi:navigation` — `{ redirect }`
- All `kuratchi:*` modules work in page routes, runtime hooks, DOs, and server modules
- Type declarations auto-generated in `app.d.ts`
- Legacy `@kuratchi/js/environment` still supported for backwards compatibility

## 0.0.13

### Patch Changes

- Move the runtime hook convention to `src/server/runtime.hook.ts` and fix async route compilation so imported action functions are not leaked into generated load return values.

## 0.0.12

### Patch Changes

- Add explicit MIT license metadata and package license files so both packages can be published and consumed as public open source packages.

## 0.0.10

### Patch Changes

- Publish latest framework and ORM for LLM docs compatibility

## 0.0.9

### Patch Changes

- Add `@kuratchi/js/environment` with a compile-time `dev` flag for server route scripts and reject it in client reactive scripts.

## 0.0.8

### Patch Changes

- Keep compiler code out of the root runtime entry so Worker bundles do not pull in Node-only build tooling.

## 0.0.7

### Patch Changes

- Remove the internal global Cloudflare env bridge and keep request env scoped to framework runtime context.

## 0.0.6

### Patch Changes

- Allow Cloudflare env access in route top-level server scripts while continuing to block env access in client and component scripts.
