# Durable Objects (DO) SQLite

Kuratchi can provision a single internal Durable Object worker (`kuratchi-do-internal`) that hosts a DO class with access to Durable Object SQLite storage. Each logical database is addressed by name via `idFromName(name)` and accessed over HTTPS, providing near-instant DB availability compared to creating a new D1 instance.

## Quick start

```ts
import { Kuratchi } from 'kuratchi';

const kuratchi = new Kuratchi({ apiToken, accountId, workersSubdomain });

// (Admin provisioning) Create a logical database and obtain its token
// Requires a master gateway key available in your admin environment
const { token } = await kuratchi.do.createDatabase({ databaseName: 'org_acme', gatewayKey: GATEWAY_KEY });
// Store { databaseName, token } in your Admin DB for later use by your app.

// Create a typed client to a logical database backed by a DO instance
const dbName = 'org_acme';
const dbToken = token;        // retrieved from your Admin DB at runtime
const gatewayKey = GATEWAY_KEY; // server-side secret
const org = kuratchi.do.client({ databaseName: dbName, dbToken, gatewayKey }, { schema: 'organization' });

// Use the same chainable ORM as D1
await org.users.insert({ id: 'u1', email: 'a@acme.com' });
const first = await org.users.where({ email: { like: '%@acme.com' } }).findFirst();
```

## API

- kuratchi.do.createDatabase({ databaseName, gatewayKey }) — provisions the logical DB (ensuring the worker with the master key) and returns a per-database token. Typically called in admin provisioning flow; persist the token.
- kuratchi.do.client({ databaseName, dbToken, gatewayKey }, { schema }) — returns a typed table client using the runtime ORM.
- kuratchi.do.database({ databaseName, dbToken, gatewayKey }) — returns low-level query surface plus `.client({ schema })`.

Notes:
- Each unique `databaseName` maps to a distinct DO instance via `idFromName`, providing isolation and durable SQLite storage.
- The runtime ORM behavior and typing match D1 clients (explicit schema only).
- Token issuance/rotation is handled by your app's admin/provisioning flow using Kuratchi; public docs do not expose the internal worker deployment.
