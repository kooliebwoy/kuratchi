---
layout: docs
---

# Kuratchi SDK Documentation

Welcome to the in-repo documentation for the Kuratchi SDK. Each guide focuses on a practical workflow so you can quickly decide which API surface to use and how to wire it into your project.

## Navigation

- [Auth](/docs/auth) — SvelteKit handle, organization management, and sign-in helpers.
- [Database](/docs/database) — Durable Object database provisioning and typed access clients.
- [ORM](/docs/orm) — JSON schema model, query primitives, includes, and migration guidance.
- [CLI](/docs/cli) — Command-line tooling for admin provisioning and schema migrations.

## Choosing the Right Tool

| Goal | Start With |
| --- | --- |
| Provision the admin database and obtain tokens | [`CLI`](./cli.md) → `init-admin-db`
| Generate SQL migrations from a JSON schema | [`CLI`](./cli.md) → `generate-migrations`
| Add auth/session handling to SvelteKit | [`Auth`](./auth.md) → `auth.handle()`
| Programmatically create organizations & org databases | [`Auth`](./auth.md) → `auth.admin()`
| Query an organization database with typed ORM helpers | [`Auth`](./auth.md) → `forOrganization()` or [`Database`](./database.md) → `database.client()`
| Apply JSON-schema ORM features (includes, counting, paging) | [`ORM`](./orm.md)

## Prerequisites

- Node.js 18+
- Cloudflare Workers account with D1 access and a deployed Kuratchi Durable Object worker
- Required environment variables in `.env` (see individual guides for exact keys)
- Build artifacts in `dist/` when using the CLI or running the SDK from a package install (`npm run build`)

## How to Use These Docs

1. Ensure your environment variables are set (auth & Cloudflare credentials).
2. Run through the [`CLI`](./cli.md) guide once to provision the admin database.
3. Wire the [`Auth`](./auth.md) and [`Database`](./database.md) modules into your application.
4. Reference [`ORM`](./orm.md) for defining schemas, writing queries, and generating migrations.

Each guide includes copy-paste snippets that align with the current SDK exports in `src/lib/` and favor explicit, typed clients (no dynamic schema usage).
