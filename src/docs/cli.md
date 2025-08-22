# Kuratchi CLI

Provision and manage the Kuratchi Admin D1 database, and generate/apply migrations.

- Binary: `kuratchi` (see `package.json` → `bin`)
- Output: always JSON to stdout
- Progress: spinner on TTY by default; pass `--no-spinner` to disable
- Zero‑config discovery: `kuratchi.config.json|.mjs|.js` or `package.json` → `{ "kuratchi": { accountId, apiToken, workersSubdomain } }`

## Install / Build

- From npm: install the package globally or use npx.
- From source (this repo): run `npm run build` to generate `dist/` before using the CLI. Some commands load runtime helpers from `dist`.

## Environment Variables

Use either form (first match wins):

- CF_ACCOUNT_ID | CLOUDFLARE_ACCOUNT_ID
- CF_API_TOKEN | CLOUDFLARE_API_TOKEN
- CF_WORKERS_SUBDOMAIN | CLOUDFLARE_WORKERS_SUBDOMAIN
- KURATCHI_ADMIN_DB_TOKEN (required by `admin migrate`)

Keep tokens secret. Do not expose them in client bundles or commit them.

## Config Discovery (optional)

- `kuratchi.config.json|.mjs|.js` at project root, or
- `package.json`:

```json
{
  "kuratchi": {
    "accountId": "...",
    "apiToken": "...",
    "workersSubdomain": "example.workers.dev"
  }
}
```

For ESM config, you can export default:

```js
// kuratchi.config.mjs
export default {
  accountId: "...",
  apiToken: "...",
  workersSubdomain: "example.workers.dev"
};
```

## Commands

### admin create
Create the admin D1 database under your Cloudflare account.

Usage:

```bash
kuratchi admin create \
  [--name <db>] [--no-spinner] \
  --account-id <id> --api-token <token> --workers-subdomain <sub>
```

Notes:
- If `--name` is omitted, defaults to `kuratchi-admin`.
- Credentials can come from env or config discovery.

Example:
```bash
CF_ACCOUNT_ID=... CF_API_TOKEN=... CF_WORKERS_SUBDOMAIN=example.workers.dev \
kuratchi admin create --name kuratchi-admin
```

Example output:
```json
{
  "ok": true,
  "databaseId": "<uuid>",
  "databaseName": "kuratchi-admin",
  "apiToken": "<admin_db_token>",
  "workersSubdomain": "example.workers.dev",
  "endpoint": "https://kuratchi-admin.example.workers.dev"
}
```

### admin migrate
Apply migrations to the admin database. Requires the admin DB token.

Usage:

```bash
kuratchi admin migrate \
  [--name <db>] [--token <admin_db_token>] [--workers-subdomain <sub>] \
  [--migrations-dir <name>] [--migrations-path <path>] \
  [--schema-json-file <path>] [--no-spinner]
```

Strategy (in order):
- Filesystem bundle loader (preferred): looks under `./migrations-<dir>` (default `./migrations-admin`) or `--migrations-path`.
- JSON schema fallback: generate a single initial bundle from `--schema-json-file` or `./schema-json/admin.json` or `./src/lib/schema-json/admin.json`.

Flags:
- `--name` default: `kuratchi-admin`
- `--token`: or set `KURATCHI_ADMIN_DB_TOKEN`
- `--migrations-dir` default: `admin` → expects `./migrations-admin/...`
- `--migrations-path`: explicit path override for migrations root
- `--schema-json-file`: JSON schema for initial bundle when no filesystem migrations are found

Example (filesystem migrations):
```bash
KURATCHI_ADMIN_DB_TOKEN=... CF_WORKERS_SUBDOMAIN=example.workers.dev \
kuratchi admin migrate --migrations-dir admin
```

Directory layout expected by the filesystem loader:
```
./migrations-admin/
  <tag>.sql
  meta/
    _journal.json   // { entries: [ { idx: 1, tag: "m_..." }, ... ] }
    _schema.json    // auto-snapshot of latest schema for diffing
```

### admin destroy
Delete the admin D1 database by UUID.

Usage:

```bash
kuratchi admin destroy --id <dbuuid> [--no-spinner] \
  --account-id <id> --api-token <token>
```

Example:
```bash
CF_ACCOUNT_ID=... CF_API_TOKEN=... \
kuratchi admin destroy --id 11111111-2222-3333-4444-555555555555
```

### admin generate-migrations
Generate SQL + journal entries from a JSON schema with automatic snapshotting.

Usage:

```bash
kuratchi admin generate-migrations \
  [--out-dir <path>] [--schema-json-file <path>] \
  [--from-schema-json-file <path>] [--tag <string>]
```

Defaults and behavior:
- `--out-dir` default: `./migrations-admin`
- Schema file: `--schema-json-file` else `./schema-json/admin.json` else `./src/lib/schema-json/admin.json`
- Snapshot: always updates `<out-dir>/meta/_schema.json`
- Journal: appends to `<out-dir>/meta/_journal.json`
- Tag: default `m_<timestamp>`
- No-op: returns `skipped: true` if no statements were generated

### org generate-migrations
Same as `admin generate-migrations`, but with organization defaults.

Defaults:
- `--out-dir` default: `./migrations-org`
- Schema file: `--schema-json-file` else `./schema-json/organization.json` else `./src/lib/schema-json/organization.json`

## Examples

- Create admin DB with env fallbacks:
```bash
CF_ACCOUNT_ID=... CF_API_TOKEN=... CF_WORKERS_SUBDOMAIN=example.workers.dev \
kuratchi admin create
```

- Migrate using local filesystem bundle:
```bash
KURATCHI_ADMIN_DB_TOKEN=... CF_WORKERS_SUBDOMAIN=example.workers.dev \
kuratchi admin migrate --migrations-dir admin
```

- Generate admin migration from JSON schema:
```bash
kuratchi admin generate-migrations --schema-json-file ./schema-json/admin.json
```

- Generate org migration bundle:
```bash
kuratchi org generate-migrations --schema-json-file ./schema-json/organization.json
```

## Exit codes
- `0` on success, non‑zero on error. Errors are printed to stderr with a helpful message.
