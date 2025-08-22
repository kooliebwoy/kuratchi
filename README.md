# Kuratchi

Auth toolkit for multi-organization with Cloudflare D1. Opinionated. Built to be simple.

- Stand up org DBs and auth quickly. Think MVP. For prototyping.

## Overview

Kuratchi is an auth + Cloudflare D1 toolkit for SvelteKit/Workers. Detailed guides live in `src/docs/`.

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

// Use the minimal runtime ORM (no Drizzle required)
const org = db.client({ schema: 'organization' });
await org.users.insert({ id: 'u1', email: 'a@acme.com' });
const res = await org.users.findFirst({ where: { email: { like: '%@acme.com' } } });
if (!res.success) throw new Error(res.error);
console.log(res.data); // { id: 'u1', email: 'a@acme.com' }
```



> For full guides and examples (Auth, CLI, migrations, environment), see `src/docs/`.


## License

MIT

## Security considerations

- Do not expose `CLOUDFLARE_API_TOKEN` to browsers or client-side bundles.
- Restrict CORS in production (`src/lib/worker-template.ts`).
- Use least-privilege API tokens.
