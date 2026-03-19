# @kuratchi/docs

Mintlify docs for Kuratchi now live in the monorepo at `apps/docs` instead of a standalone `docs` repository.

## Development

From the monorepo root:

```bash
bun run docs:dev
```

From `apps/docs` directly:

```bash
bun run dev
```

Update the local Mintlify CLI shim if preview behavior drifts:

```bash
bun run docs:update
```

The docs entrypoint is `apps/docs/docs.json`. Content pages, images, and API examples all live alongside it in this directory.
