# Migrations

This guide shows how to create and apply database migrations with Kuratchi.

It covers a zero‑friction workflow where you only define a JSON schema and run the CLI:
- Generate initial and incremental bundles (org/admin) from JSON schema
- Apply migrations at runtime with `db.migrate('<dir>')` (Vite/SvelteKit)
- What the CLI generates under the hood (FYI only)
- Troubleshooting and reference

## What we generate (FYI)

You do not need to create folders or edit journals manually. The CLI will:
- Create the output directory if missing
- Create or update `meta/_journal.json`
- Write `<tag>.sql` files

Under the hood, the on‑disk layout looks like this (at repo root so Vite can glob it):

```
migrations-<dir>/
  meta/_journal.json     # { entries: [{ idx: number, tag: string }, ...] }
  <tag>.sql              # One file per journal entry
```

Notes:
- Vite loader glob patterns: `/migrations-*/*.sql` and `/migrations-*/meta/_journal.json`.
- Keep `<dir>` simple (e.g., `org`, `admin`).
- Each `tag` maps to `<tag>.sql`. The CLI keeps the journal in sync.

## Generate migrations from schema (no manual files)

Prerequisite: place your schema JSONs, e.g.:
- `src/lib/schema-json/organization.json`
- `src/lib/schema-json/admin.json`

The CLI will generate or update bundles for you and keep a journal.

Notes:
- Defaults: `kuratchi org generate-migrations` uses `organization.json` -> `./migrations-org`. `kuratchi admin generate-migrations` uses `admin.json` -> `./migrations-admin`.
- The CLI auto-creates directories and maintains both `meta/_journal.json` and `meta/_schema.json` (snapshot for diffs).
- Working from this repo? Run `npm run build` before using the CLI so dist files are available.

### Organization DB — initial bundle (org alias)

```sh
kuratchi org generate-migrations \
  --schema-json-file ./src/lib/schema-json/organization.json \
  --tag initial
```

### Organization DB — incremental diff (after editing the schema)

```sh
kuratchi org generate-migrations \
  --schema-json-file ./src/lib/schema-json/organization.json \
  --tag add-sessions
```

Snapshotting: the generator automatically stores the latest schema at `migrations-org/meta/_schema.json` and will diff from it next time. You can override the baseline with `--from-schema-json-file <path>` if needed.

## Apply at runtime (Vite/SvelteKit)

At runtime we load the generated bundles via Vite (`import.meta.glob`) and apply any unapplied tags.

```ts
import { Kuratchi } from 'kuratchi';

const kuratchi = new Kuratchi({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  workersSubdomain: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN!,
});

// Connect to your org DB
const db = kuratchi.d1.database({ databaseName: 'acme-org', apiToken: '<org_db_token>' });

// Apply local bundle migrations under ./migrations-org/
await db.migrate('org');
```

Under the hood this:
- Reads `migrations-org/meta/_journal.json` and SQL files via Vite glob
- Creates `migrations_history` if needed
- Applies entries not yet present in `migrations_history` by `tag`

## Add an incremental migration

Just edit your schema JSON and rerun the generator with a new `--tag`. The CLI snapshots the schema, updates the journal, and writes the SQL file for you. Example:

```sh
kuratchi org generate-migrations \
  --schema-json-file ./src/lib/schema-json/organization.json \
  --tag add-sessions
```

Re-run `await db.migrate('org')` at runtime; only the new tag runs.

## Admin DB via CLI

You can fully manage the Admin DB with the CLI:

### Generate from JSON schema (recommended)

```sh
# Generate or update the admin bundle from JSON schema
kuratchi admin generate-migrations \
  --schema-json-file ./src/lib/schema-json/admin.json \
  --out-dir ./migrations-admin \
  --tag initial

# Apply the bundle to the Admin DB (reads from filesystem)
kuratchi admin migrate \
  --name kuratchi-admin \
  --token "$KURATCHI_ADMIN_DB_TOKEN" \
  --workers-subdomain "$CLOUDFLARE_WORKERS_SUBDOMAIN"
```

For diffs, add `--from-schema-json-file <previous.json>`.

### Use an existing filesystem bundle (optional)

If you already maintain SQL files yourself, you can just apply them:

```sh
kuratchi admin migrate \
  --name kuratchi-admin \
  --token "$KURATCHI_ADMIN_DB_TOKEN" \
  --workers-subdomain "$CLOUDFLARE_WORKERS_SUBDOMAIN" \
  --migrations-path ./migrations-admin
```

## Troubleshooting

- Request failed with non-JSON 404 when migrating
  - The Worker may not be deployed or reachable yet. If you just created the DB (via `KuratchiD1.createDatabase`), give it a few seconds and retry.
  - Ensure the endpoint is `https://<databaseName>.<workersSubdomain>` and the `apiToken` is the DB token, not the Cloudflare API token.

- Invalid journal format
  - This should not occur when using the CLI. If hand‑edited, ensure `meta/_journal.json` has `{ entries: [{ idx: number, tag: string }, ...] }`.

- SQL file not found for tag
  - The CLI writes `<tag>.sql` for each entry. If missing, rerun the generator for that tag.

- Multiple statements in one file
  - Separate statements using `--> statement-breakpoint`. The runner will append `;` if missing.

## Reference

- History table: `migrations_history (id INTEGER PK, tag TEXT UNIQUE, created_at INTEGER)`
- Statement delimiter: `--> statement-breakpoint`
- Vite loader: `src/lib/orm/loader.ts` uses `import.meta.glob('...')`
- Runtime executor: `src/lib/d1/internal-http-client.ts#migrate()`
- CLI: `bin/kuratchi.mjs` (commands: `org generate-migrations`, `admin generate-migrations`, `admin migrate`)
- Snapshotting: `meta/_schema.json` is updated on each generation and used as the diff baseline when `--from-schema-json-file` is not provided.
