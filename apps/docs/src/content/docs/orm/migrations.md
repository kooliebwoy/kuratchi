---
title: Automatic Migrations
description: How the ORM automatically accepts and runs migrations when the migration flag is set.
---

## Overview

The Kuratchi ORM includes an automatic schema synchronization system that runs migrations without requiring manual acceptance. When you create an ORM client, the system automatically detects schema differences and applies necessary changes to the database.

### Real Schema Example

The production `organizationSchema` (defined in [`apps/dashboard/src/lib/schemas/organization.ts`](https://github.com/kooliebwoy/kuratchi/blob/main/apps/dashboard/src/lib/schemas/organization.ts)) is a representative example of what the ORM keeps in sync:

```typescript
import type { SchemaDsl } from 'kuratchi-sdk/database';

export const organizationSchema: SchemaDsl = {
  name: 'organization',
  version: 14,
  mixins: {
    timestamps: {
      updated_at: 'text default now',
      created_at: 'text default now',
      deleted_at: 'text'
    }
  },
  tables: {
    users: {
      id: 'text primary key not null',
      email: 'text not null unique',
      status: 'boolean',
      role: 'text',
      invite_token: 'text',
      invite_expires_at: 'timestamp_ms',
      invited_by: 'text',
      '...timestamps': true,
    },
    session: {
      sessionToken: 'text primary key not null',
      userId: 'text not null -> users.id cascade',
      expires: 'timestamp_ms not null',
      '...timestamps': true,
    },
    activity: {
      id: 'text primary key',
      data: 'json default (json_object())',
      isAdminAction: 'boolean default false',
      '...timestamps': true,
    },
    // ... dozens of additional tables (sites, emails, catalogs, forms, etc.)
  },
  indexes: {
    newsletter_contacts: {
      idx_newsletter_contacts_org_email: {
        columns: ['organizationId', 'email'],
        unique: true
      }
    },
    catalogVehicles: {
      idx_catalog_vehicles_status: { columns: ['status'] }
    }
  }
} as const;
```

Everything described below uses this real schema as the baseline for examples.

## How It Works

### Automatic Schema Synchronization

When you create an ORM client, the `synchronizeSchema` function is automatically invoked (unless disabled). This function:

1. **Compares** your schema definition against the current database state
2. **Detects** any differences (missing tables, new columns, removed columns, index changes)
3. **Generates** the necessary SQL statements to sync the database
4. **Executes** those statements automatically
5. **Records** the schema state to prevent re-running identical migrations

```typescript
import { createOrmClient } from '@kuratchi/sdk';

const db = await createOrmClient({
  httpClient,
  schema: mySchema,
  databaseName: 'my-database'
  // skipMigrations is false by default - migrations run automatically
});
```

### The `skipMigrations` Flag

Control automatic migrations with the `skipMigrations` option:

```typescript
// Migrations run automatically (default behavior)
const db = await createOrmClient({
  httpClient,
  schema: mySchema,
  databaseName: 'my-database'
});

// Skip automatic migrations
const db = await createOrmClient({
  httpClient,
  schema: mySchema,
  databaseName: 'my-database',
  skipMigrations: true
});
```

## What Gets Migrated

The automatic migration system handles:

### Table Creation
New tables defined in your schema are created automatically.

```typescript
// From organizationSchema
tables: {
  users: {
    id: 'text primary key not null',
    email: 'text not null unique',
    status: 'boolean',
    '...timestamps': true,
  },
  sites: {
    id: 'text primary key not null',
    subdomain: 'text',
    environment: 'enum(production,preview)',
    metadata: 'json',
    '...timestamps': true,
  },
  // ...
}
```

### Column Addition
New columns are added to existing tables.

```typescript
// Example: adding `isAdminAction` to activity table (already present now)
activity: {
  id: 'text primary key',
  data: 'json default (json_object())',
  status: 'boolean',
  isAdminAction: 'boolean default false', // newly introduced column
  '...timestamps': true,
}
```

### Column Removal
Columns removed from your schema are dropped from the database.

```typescript
// Removing `tenantId` from users would drop it the next time the schema sync runs
users: {
  id: 'text primary key not null',
  email: 'text not null unique',
  // tenantId removed here -> ORM issues `ALTER TABLE users DROP COLUMN tenantId;`
  '...timestamps': true,
}
```

### Table Recreation
When adding columns with non-constant defaults (like `CURRENT_TIMESTAMP` or `JSON_ARRAY()`), the table is automatically recreated:

1. Create a temporary table with the new schema
2. Copy data from the old table (preserving existing columns)
3. Drop the old table
4. Rename the temporary table to the original name
5. Recreate all indexes

```typescript
// organizationSchema tables with JSON defaults trigger recreation when added later
forms: {
  id: 'text primary key not null',
  fields: 'json default (json_array())',   // non-constant default
  settings: 'json default (json_object())',// non-constant default
  status: 'boolean default true',
  '...timestamps': true,
}
```

### Index Management
Indexes are created, updated, or dropped to match your schema definition.

```typescript
indexes: {
  newsletter_contacts: {
    idx_newsletter_contacts_org_email: {
      columns: ['organizationId', 'email'],
      unique: true
    },
  },
  catalogVehicles: {
    idx_catalog_vehicles_category: { columns: ['category'] },
    idx_catalog_vehicles_status: { columns: ['status'] },
  },
}
```

## Schema State Tracking

The ORM tracks schema state in a `kuratchi_schema_state` table:

```sql
CREATE TABLE kuratchi_schema_state (
  schema_name TEXT PRIMARY KEY,
  schema_hash TEXT NOT NULL,
  version INTEGER,
  updated_at INTEGER NOT NULL
);
```

This table stores:
- **schema_name**: Name of your schema (e.g., 'myapp')
- **schema_hash**: Hash of the current schema definition
- **version**: Optional version number from your schema
- **updated_at**: Timestamp of the last sync

The hash prevents re-running identical migrations. If your schema definition hasn't changed, migrations are skipped.

## Caching

The ORM uses two levels of caching to optimize performance:

### Runtime Cache
In-memory cache of schema hashes prevents redundant database queries within the same process.

### Database State Cache
The `kuratchi_schema_state` table persists the last known schema hash, allowing the system to skip work across application restarts.

## Logging

Automatic migrations produce detailed console logs:

```
[Kuratchi] Synchronizing schema for myapp v1 (via http)...
[schemaSync] Synchronizing schema "myapp" with 3 statement(s).
[schemaSync] Table users recreated to add column(s) with non-constant defaults: updated_at
[Kuratchi] ✓ Schema synchronized for myapp - applied 3 statement(s)
```

Or when no changes are needed:

```
[Kuratchi] ✓ Schema already up-to-date for myapp v1 (hash: a1b2c3d4)
```

## Error Handling

If schema synchronization fails, an error is thrown:

```typescript
try {
  const db = await createOrmClient({
    httpClient,
    schema: mySchema,
    databaseName: 'my-database'
  });
} catch (error) {
  console.error('Schema sync failed:', error.message);
  // Handle error appropriately
}
```

Common errors include:
- **Type mismatches**: Column type changed incompatibly
- **Constraint violations**: Cannot add NOT NULL column without default
- **Primary key conflicts**: Cannot auto-add columns with primary key constraints

## Best Practices

### 1. Always Define Defaults for NOT NULL Columns
When adding a NOT NULL column to an existing table, provide a default value. In `organizationSchema`, every `boolean not null` column has an explicit default:

```typescript
forms: {
  id: 'text primary key not null',
  status: 'boolean default true',      // ← keeps migrations safe
  '...timestamps': true,
},
newsletter_broadcasts: {
  id: 'text primary key not null',
  status: 'enum(draft,sending,sent,failed) default draft',
  // ...
}
```

### 2. Use Constant Defaults for Simple Additions
For simple column additions, use constant defaults to avoid table recreation:

```typescript
// Good - uses ALTER TABLE ADD COLUMN
activity: {
  isAdminAction: 'boolean default false', // constant default → simple ALTER
}

// Avoid - triggers table recreation
forms: {
  fields: 'json default (json_array())',    // non-constant default
}
```

### 3. Plan for Data Loss on Removal
When removing columns from your schema, they are dropped from the database. Ensure you've backed up important data first.

### 4. Version Your Schema
Include a version number in your schema for tracking:

```typescript
export const organizationSchema: SchemaDsl = {
  name: 'organization',
  version: 14,
  // ...
};
```

### 5. Disable Migrations in CI/CD if Needed
For production deployments, you may want to disable automatic migrations and run them manually:

```typescript
const skipMigrations = process.env.SKIP_MIGRATIONS === 'true';
const db = await createOrmClient({
  httpClient,
  schema: mySchema,
  databaseName: 'my-database',
  skipMigrations
});
```

## Disabling Automatic Migrations

Set `skipMigrations: true` to prevent automatic schema synchronization:

```typescript
const db = await createOrmClient({
  httpClient,
  schema: mySchema,
  databaseName: 'my-database',
  skipMigrations: true
});
```

This is useful when:
- Running in read-only mode
- Managing migrations manually
- Testing without schema changes
- Deploying to production with separate migration steps
