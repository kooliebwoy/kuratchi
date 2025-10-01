---
layout: docs
---


# Kuratchi CLI Guide

The Kuratchi CLI ships with the npm package so you can provision the admin database and manage SQL migrations without installing extra tooling. This guide walks through the available commands, required configuration, and practical workflows for day-to-day usage.

---

## Getting Started

- Use the CLI via `npx kuratchi-sdk`, `pnpm exec kuratchi-sdk`, or the convenience script defined in `package.json` (`npm run cli`).
- Commands auto-load `.env` and `.env.local` from both your current working directory and the package root unless the environment variable `KURATCHI_SKIP_DOTENV=true`.
- Before running generator commands, build the SDK once so the CLI can import compiled helpers: `npm run build`.

```sh
# One-off run without installing globally
yarn dlx kuratchi-sdk init-admin-db --debug

# Using the local script
npm run cli -- init-admin-db --debug
```

---

## Environment Resolution Cheatsheet

The CLI resolves configuration in this order:

- Explicit CLI flag (for example `--gatewayKey`)
- Environment variable in the current process (for example `process.env.KURATCHI_GATEWAY_KEY`)
- `.env` / `.env.local` entries loaded at runtime (unless skipped)

### Cloudflare credentials & admin database

| Option | Flags | Environment variables (any) |
| --- | --- | --- |
| Workers subdomain | `--workersSubdomain` | `KURATCHI_CLOUDFLARE_WORKERS_SUBDOMAIN`, `CLOUDFLARE_WORKERS_SUBDOMAIN`, `WORKERS_SUBDOMAIN` |
| Account ID | `--accountId` | `KURATCHI_CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ACCOUNT_ID`, `CF_ACCOUNT_ID` |
| API token | `--apiToken` | `KURATCHI_CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN` |
| Gateway key | `--gatewayKey` | `KURATCHI_GATEWAY_KEY`, `GATEWAY_KEY` |
| Admin DB name | `--name` | `KURATCHI_ADMIN_DB_NAME` (defaults to `kuratchi-admin`) |
| Durable Object script | `--scriptName` | none (defaults to `kuratchi-do-internal`) |

---

## Commands

### `kuratchi-sdk init-admin-db`

Provision the shared admin database, run migrations, and return a usable API token.

```sh
npx kuratchi-sdk init-admin-db --debug
```

Sample output (`--debug` shows masked inputs):

```json
{
  "debug": true,
  "resolved": {
    "name": "kuratchi-admin",
    "workersSubdomain": "your-subdomain",
    "accountId": "abc***123",
    "scriptName": "kuratchi-do-internal",
    "migrate": true,
    "gatewayKey": "kur***key",
    "apiToken": "n11***ken"
  }
}
```

```json
{
  "ok": true,
  "databaseName": "kuratchi-admin",
  "token": "<admin-db-token>"
}
```

Key behaviors:

- **Migration fallback**: runs with `--migrate true` by default. If migrations fail and you did not pass `--migrate false`, the CLI retries without migrations.
- **Schema source**: ships with the admin schema JSON DSL inside the package. No additional files required.
- **Idempotency**: re-running against an existing admin DB is safe; the Durable Object gateway will reuse the database and return the existing token.

#### Common flags

- `--name <database>`: override the admin database name
- `--gatewayKey <key>`: override or supply the DO gateway key
- `--workersSubdomain <subdomain>`
- `--accountId <id>`
- `--apiToken <token>`
- `--scriptName <name>`: customize the Durable Object worker binding
- `--migrate false`: skip running migrations entirely
- `--debug`: print resolved configuration with masked secrets

### `kuratchi-sdk generate-migrations`

Generate SQL migrations from a JSON or TypeScript schema file using Kuratchi's JSON-schema based ORM definitions. The CLI handles transpiling `.ts` files, diffing the schema, and snapshotting for incremental runs.

```sh
npx kuratchi-sdk generate-migrations \
  --schema src/lib/schema/organization.ts \
  --outDir migrations-org \
  --tag 001-init
```

#### Required arguments

- `--schema <path>`: points to a module that exports a JSON-schema DSL. Accepts `.ts`, `.js`, or `.mjs`. For TypeScript files, the CLI will attempt to reuse existing builds (`dist/`) before transpiling to a temporary `.mjs` file.

#### Optional arguments

- `--outDir <dir>`: where to write migrations. Defaults to `migrations-<schemaName>` using the schema name defined in the DSL.
- `--tag <name>`: human readable tag (default `m_<timestamp>`).
- `--fromSchema <path>`: diff against an explicit schema snapshot instead of the last recorded snapshot.

#### Output layout

```
<outDir>/
  <tag>.sql          # the generated SQL statements
  meta/
    _journal.json    # list of generated migrations with indices
    _schema.json     # snapshot of the latest schema
  schema/.tmp/       # transient transpiled modules (cleaned on new runs)
```

#### Snapshot-based diffing

- On the first run, a full SQL bundle is produced.
- Subsequent runs compare the current schema with `meta/_schema.json` and only emit diffs. If no changes are detected, the command exits early with `skipped: true`.
- Use `--fromSchema` to diff between two explicit DSL files (useful for automated migrations between environments).

#### TypeScript schema example

```ts
// src/lib/schema/organization.ts
import { defineSchema } from 'kuratchi-sdk/schema';

export const schema = defineSchema({
  name: 'organization',
  tables: {
    users: {
      primaryKey: 'id',
      columns: {
        id: { type: 'text', notNull: true },
        email: { type: 'text', notNull: true, unique: true },
        profile: { type: 'json' }
      }
    }
  }
});
```

---

## Practical Workflows

### Provision a new environment

1. Export Cloudflare credentials and your Durable Object gateway key (or add them to `.env`).
2. Run `npx kuratchi-sdk init-admin-db --debug`.
3. Store the returned `token` as `KURATCHI_ADMIN_DB_TOKEN` in your application secrets.
4. Deploy the SvelteKit app with the populated environment variables.

### Manage organization schema migrations

1. Update your JSON schema DSL.
2. Run `npx kuratchi-sdk generate-migrations --schema src/lib/schema/organization.ts --outDir migrations-org`.
3. Review the SQL in `migrations-org/<tag>.sql` and commit the migration & updated schema files.
4. Repeat when schema changes. The CLI will diff against `meta/_schema.json` automatically.

### Continuous integration usage

```sh
# install dependencies
npm ci

# build once so CLI helpers are available
npm run build

# provision admin DB or ensure it exists (optional)
KURATCHI_GATEWAY_KEY=... CLOUDFLARE_API_TOKEN=... \
  npx kuratchi-sdk init-admin-db --name staging-admin --debug

# generate migrations when schema changes
yarn kuratchi-sdk generate-migrations --schema dist/lib/schema/organization.js --outDir migrations-org
```

- Use `KURATCHI_SKIP_DOTENV=true` in CI to avoid loading local files.
- Check for empty migration output by inspecting the JSON response for `skipped: true`.

---

## Troubleshooting

- **"normalizeSchema not available"**: run `npm run build` so the CLI can import compiled helpers from `dist/`.
- **Missing schema export**: ensure your schema module exports `schema` (or another object with a `tables` field) and that default builds emit `.js` or `.mjs` files.
- **Credentials rejected**: confirm Cloudflare tokens include D1 write permissions and the gateway key matches the Workers script bound in your Durable Object deployment.
- **Local `.env` ignored**: remove `KURATCHI_SKIP_DOTENV=true` or pass credentials explicitly via flags.

---

## Related Resources

- `README.md` (root) – quickstart for SvelteKit integration and ORM usage
- `src/lib/database/kuratchi-database.ts` – programmatic database provisioning helpers
- `src/lib/orm/loader.ts` – JSON schema loader used by the CLI
