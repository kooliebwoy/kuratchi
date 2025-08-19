# Kuratchi

Auth toolkit for multi-organization with Cloudflare D1. Opinionated. Built to be simple.

- Drizzle-first - This is all I know.
- Patched together all my favorite things.
- Stand up org DBs and auth quickly. Think MVP. For prototyping.

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

- kuratchi.auth.createOrganization({ organizationName })
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
- Provision an admin DB - This is where you'll store orgs and map everything (users, databases, api tokens, etc).
- Provision a per‑org D1 - This is where you'll store your org's data.
- Use Drizzle via the sqlite‑proxy to interact with your org DB like a normal drizzle client. You can use query() if you are hard core SQL person.
- Use the Auth module on your org DB to handle auth at the org level. This will handle users, sessions, etc.

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

// 2) Connect + Migrate
const db = kuratchi.d1.database({ databaseName: database.name, apiToken });
await db.migrateAuto('org'); // expects migrations-org/ with meta/_journal.json

// 3) Drizzle
const proxy = db.drizzleProxy();
const orm = drizzle(proxy, { schema }); // this is using the drizzle sqlite proxy

## Multi-org example

// Create an organization - automatically provisions a database
const organization = kuratchi.auth.createOrganization({ organizationName: 'org-name' });

// Create a user only in the org DB
const user = await organization.createUser({ email: 'a@b.co', password: 'secret' });

// Authenticate a user
const userAuthenticated = await organization.authenticateUser(user.id, 'secret');

// Create a session
const sessionToken = await organization.createSession(userAuthenticated.id);

// Validate a session
const sessionData = await organization.validateSessionToken(sessionToken);

// Delete a session
await organization.deleteSession(sessionToken);

// Delete a user
await organization.deleteUser(user.id);

// Delete an organization
await kuratchi.auth.deleteOrganization(organization.id);
```

## Environment variables

- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_WORKERS_SUBDOMAIN
- KURATCHI_AUTH_SECRET

## License

MIT

## Security considerations

- Do not expose `CLOUDFLARE_API_TOKEN` to browsers or client-side bundles.
- Restrict CORS in production (`src/lib/worker-template.ts`).
- Use least-privilege API tokens.
