# Durable Objects (DO) SQLite

Kuratchi can provision a single internal Durable Object worker (`kuratchi-do-internal`) that hosts a DO class with access to Durable Object SQLite storage. Each logical database is addressed by name via `idFromName(name)` and accessed over HTTPS, providing near-instant DB availability compared to creating a new D1 instance.

## Quick start

```ts
import { Kuratchi } from 'kuratchi-sdk';

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
const first = await org.users.where({ email: { like: '%@acme.com' } }).first();
```

## API

- kuratchi.do.createDatabase({ databaseName, gatewayKey }) — provisions the logical DB (ensuring the worker with the master key) and returns a per-database token. Typically called in admin provisioning flow; persist the token.
- kuratchi.do.client({ databaseName, dbToken, gatewayKey }, { schema }) — returns a typed table client using the runtime ORM.
- kuratchi.do.database({ databaseName, dbToken, gatewayKey }) — returns low-level query surface plus `.client({ schema })`.

Notes:
- Each unique `databaseName` maps to a distinct DO instance via `idFromName`, providing isolation and durable SQLite storage.
- The runtime ORM behavior and typing match D1 clients (explicit schema only).
- Token issuance/rotation is handled by your app's admin/provisioning flow using Kuratchi; public docs do not expose the internal worker deployment.

## Create organization (DO engine)

You can create an organization backed by Durable Objects using the high-level auth API. This will:

- Create the admin records (organization, database, token) in your Admin DB.
- Ensure the DO internal worker is uploaded and subdomain is enabled (once per account).
- Provision a logical DO database name and issue a per-database token.
- Optionally run migrations for the organization schema (DO handles initial schema during provisioning when `migrate: true`).

```ts
import { Kuratchi } from 'kuratchi-sdk';

const kuratchi = new Kuratchi({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  workersSubdomain: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN!,
  auth: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    emailFrom: process.env.EMAIL_FROM || '',
    origin: process.env.ORIGIN || 'https://app.example.com',
    authSecret: process.env.KURATCHI_AUTH_SECRET!,
    // Admin DB client (Kuratchi HTTP client)
    adminDb: new (await import('../lib/d1/internal-http-client.js')).KuratchiHttpClient({
      databaseName: process.env.KURATCHI_ADMIN_DB_NAME!,
      workersSubdomain: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN!,
      apiToken: process.env.KURATCHI_ADMIN_DB_TOKEN!
    })
  }
});

// Create a DO-backed organization
const result = await kuratchi.auth.createOrganization(
  { organizationName: 'Acme Inc' },
  {
    do: true,                   // use Durable Objects engine
    gatewayKey: process.env.GATEWAY_KEY!, // master DO gateway key (server-side secret)
    migrate: true,              // let DO provisioning apply initial schema
    migrationsDir: 'org'        // kept for parity; DO applies initial schema during create
  }
);

// result contains the admin and org DB metadata
// result.organization, result.database, result.token, result.migration, result.sessionCookie (if user data was provided)
```

Notes:

- For DO, initial schema creation is handled during `createDatabase({ migrate: true, schema })` inside the provisioning step. The runtime `.migrate()` call is only executed for D1.
- Provide `gatewayKey` when using DO; it is required to authorize per-database token issuance.
- You can also set `provisionKV` / `provisionR2` / `provisionQueues` in the options to create and persist Cloudflare resources tied to the organization.
