# Kuratchi

Drizzle-first toolkit for multi-organization Cloudflare D1. Opinionated. Built to prototype with AI and ship fast.

- We believe in Drizzle.
- Optimize for DX over knobs.
- Stand up org DBs and auth quickly, iterate later.

## Install

```sh
npm install kuratchi
```

## API surface (short)

- kuratchi.d1.createDatabase(name, opts?) → { database, apiToken }
- kuratchi.d1.deleteDatabase(databaseId)
- kuratchi.d1.database({ databaseName, apiToken, bookmark? }) → client
  - client.query(sql, params?)
  - client.drizzleProxy()
  - client.migrateAuto(dirName)  // Vite/SvelteKit only
  - kuratchi.d1.migrateWithLoader(db, dir, loader) // non‑Vite

- kuratchi.auth.createUser({ email, password, ... })
- kuratchi.auth.authenticateUser(email, password)
- kuratchi.auth.createSession(userId)
- kuratchi.auth.validateSessionToken(cookie)
- kuratchi.auth.deleteUser(userId)
- kuratchi.auth.requestPasswordReset(email)
- kuratchi.auth.resetPassword(token, newPassword)
- kuratchi.auth.sendEmailVerification(userId)
- kuratchi.auth.verifyEmailToken(token)

## How we expect you to use it (the flow)

- Provision a per‑org D1
- Use Drizzle via the sqlite‑proxy
- Keep per‑DB Worker tokens server‑side
- Use the Auth module on your org DB
- Prototype with AI, ship, refine later

## Minimal example

```ts
import { Kuratchi } from 'kuratchi';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from './schemas/org-schema';

const kuratchi = new Kuratchi({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  workersSubdomain: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN!,
  auth: { authSecret: process.env.KURATCHI_AUTH_SECRET! },
});

// 1) Provision org DB (once per org)
const { database, apiToken } = await kuratchi.d1.createDatabase('acme-org');

// 2) Connect + Drizzle
const db = kuratchi.d1.database({ databaseName: database.name, apiToken });
const proxy = db.drizzleProxy();
const orm = drizzle(proxy, { schema });

// 3) Migrate (Vite/SvelteKit projects)
await db.migrateAuto('org'); // expects migrations-org/ with meta/_journal.json

// 4) Auth on org DB
const auth = kuratchi.auth.service(orm);
const user = await auth.createUser({ email: 'a@b.co', password: 'secret' });
await auth.authenticateUser('a@b.co', 'secret');
const cookie = await auth.createSession(user.id);
await auth.validateSessionToken(cookie);
```

## Minimal env

- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_WORKERS_SUBDOMAIN
- KURATCHI_AUTH_SECRET

We keep this README intentionally short. Check the source for details.

## License

MIT

## Security considerations

- Do not expose `CLOUDFLARE_API_TOKEN` to browsers or client-side bundles.
- Restrict CORS in production (`src/lib/worker-template.ts`).
- Use least-privilege API tokens.
