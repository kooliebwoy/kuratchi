# Kuratchi

Toolkit for multi-organization MVPs. Opinionated. Built to be simple.

- Stand up org DBs and auth quickly. Auth is scoped org.
- Lightweight included ORM to get you started.
- CLI for D1 provisioning (Admin DB to manage org DBs).
- Migrations included (JSON schema) with automatic schema snapshotting.

## Documentation

- ORM: ./src/docs/orm.md
- Docs index: ./src/docs/README.md

## Install

```sh
npm install kuratchi
```

## Quickstart

```ts
import { Kuratchi } from 'kuratchi';

const kuratchi = new Kuratchi({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  workersSubdomain: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN!,
});

// Create a new D1 database
const { database, apiToken } = await kuratchi.d1.createDatabase('acme-org');

// Connect to an existing D1 database
const db = kuratchi.d1.database({ databaseName: database.name, apiToken });

// Migrate the database
await db.migrate('org');

// Use the minimal runtime ORM - Optional
const org = db.client({ schema: 'organization' });

// Insert a user
await org.users.insert({ id: 'u1', email: 'a@acme.com' });

// Find the user
const res = await org.users.findFirst({ where: { email: { like: '%@acme.com' } } });
if (!res.success) throw new Error(res.error);
console.log(res.data); // { id: 'u1', email: 'a@acme.com' }
```

### Quickstart: ORM + Migrations

- Generate migration bundles from JSON schema via the CLI (no manual files). The CLI creates `migrations-<dir>/meta/_journal.json` and `<tag>.sql` for you.
- At runtime (Vite/SvelteKit), apply with `await kuratchi.d1.database({ databaseName, apiToken }).migrate('<dir>')`.
- For Admin DB, generate an initial bundle from JSON schema and migrate via CLI:

```sh
# Generate initial admin bundle
kuratchi admin generate-migrations \
  --schema-json-file ./src/lib/schema-json/admin.json \
  --tag initial

# Apply admin migrations (local CLI)
kuratchi admin migrate \
  --name kuratchi-admin \
  --token "$KURATCHI_ADMIN_DB_TOKEN" \
  --workers-subdomain "$CLOUDFLARE_WORKERS_SUBDOMAIN"
```

See `src/docs/orm.md` and `src/docs/migrations.md` for details.

Notes:
- Org alias: `kuratchi org generate-migrations` defaults to `organization.json` -> `./migrations-org`.
- Snapshotting: the generator maintains `meta/_schema.json` inside the migrations folder and uses it as the diff baseline next time (override with `--from-schema-json-file`).



> For full guides and examples (Auth, CLI, migrations, environment), see `src/docs/`.


## License

MIT

## Security considerations

- Do not expose `CLOUDFLARE_API_TOKEN` to browsers or client-side bundles.
- Restrict CORS in production (`src/lib/worker-template.ts`).
- Use least-privilege API tokens.
