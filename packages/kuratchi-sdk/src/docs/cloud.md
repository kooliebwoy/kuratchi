# Kuratchi Cloud

Kuratchi Cloud lets you manage databases and roles—and interact with a specific database—using a single `KURATCHI_API_KEY`. No Cloudflare credentials are required when you use these helpers.

## Platform client

Use the platform client for management operations that do not need a database context.

```ts
import { cloud } from 'kuratchi-sdk';

const platform = cloud.createPlatform({ apiKey: process.env.KURATCHI_API_KEY! });

const databases = await platform.databases.list();
await platform.databases.create({ name: 'app-db', schema: organizationSchema });
await platform.roles.create({ name: 'editor', permissions: ['posts.create', 'posts.edit'] });
```

## Database client

When you need to query or mutate a specific database, create a database client. Provide the database ID and your JSON schema.

```ts
import { cloud } from 'kuratchi-sdk';
import { organizationSchema } from '$lib/schema/organization';

const db = cloud.createDatabase({
  apiKey: process.env.KURATCHI_API_KEY!,
  databaseId: process.env.DATABASE_ID!,
  schema: organizationSchema
});

const users = await db.orm.users.many();
await db.query('SELECT 1');
```

The unified client referenced in `src/lib/cloud/index.ts` is not yet implemented; use the platform and database clients directly for now.
