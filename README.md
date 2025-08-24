# Kuratchi

Toolkit for multi-organization MVPs. Opinionated. Built to be simple.

- Stand up org DBs and auth quickly. Auth is scoped to the org.
- Lightweight ORM included to get you started.
- CLI for D1 provisioning (Admin DB to manage org DBs).
- Migrations included (JSON schema) with automatic schema snapshotting (Think drizzle-kit, inspired by them).

## Documentation

- ORM: ./src/docs/orm.md
- CLI: ./src/docs/cli.md
- Auth: ./src/docs/auth.md
- KV: ./src/docs/kv.md
- R2: ./src/docs/r2.md
- Queues: ./src/docs/queues.md
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
await db.migrate('org'); // path: ./migrations-org

// Use the minimal runtime ORM - Optional
const org = db.client({ schema }); // your schema

// Insert a user
await org.users.insert({ id: 'u1', email: 'a@acme.com' });

// Find the user
const res = await org.users.where({ email: '@acme.com' } as any).findFirst();
if (!res.success) throw new Error(res.error);
console.log(res.data); // { id: 'u1', email: 'a@acme.com' }
```

### CLI Quickstart (minimal)

```sh
# Create Admin DB (defaults to name: kuratchi-admin)
kuratchi admin create

# Migrate Admin DB (uses local migrations if present, else JSON schema fallback)
kuratchi admin migrate
```

See `src/docs/cli.md` for full CLI reference.

Set env (server):
- KURATCHI_AUTH_SECRET
- CLOUDFLARE_WORKERS_SUBDOMAIN
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_API_TOKEN
- KURATCHI_ADMIN_DB_NAME
- KURATCHI_ADMIN_DB_TOKEN
- ORIGIN (e.g. https://app.example.com)
- Optional for magic link: RESEND_API_KEY, EMAIL_FROM
- Optional for Google OAuth: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

See `src/docs/auth.md` for details.
See `src/docs/orm.md` for details.
See `src/docs/migrations.md` for details.
See `src/docs/cli.md` for details.

> For full guides and examples (Auth, CLI, migrations, environment), see `src/docs/`.

## License

MIT

## Security considerations

- Do not expose `CLOUDFLARE_API_TOKEN` to browsers or client-side bundles.
- Restrict CORS in production (`src/lib/worker-template.ts`).
- Use least-privilege API tokens.
