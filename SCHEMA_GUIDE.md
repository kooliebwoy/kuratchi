# Schema Configuration Guide

## Overview

Kuratchi SDK v2 requires **explicit schema configuration**. Schemas are NO LONGER auto-imported or provided by default. This prevents confusion and makes the SDK's behavior predictable.

## Why This Change?

### Before (Confusing ❌)
- SDK had "default" schemas that were auto-loaded
- Users didn't know if they should use defaults or provide their own
- `src/lib/schema/` was treated as both reference AND defaults
- Led to unexpected behavior when schemas didn't match expectations

### After (Clear ✅)
- **You MUST provide schemas** in plugin configuration
- `src/lib/schema/*.example.ts` files are ONLY references
- Explicit configuration = predictable behavior
- Errors surface immediately if schema is missing

## Required Schemas

### 1. Admin Schema

Used by `adminPlugin()` to manage organizations and databases.

**Required Tables:**
- `organizations` - Organization registry
- `databases` - Database-to-org mapping
- `dbApiTokens` - Database access tokens
- `organizationUsers` - User-to-org mapping (for email lookup)

### 2. Organization Schema

Used by `organizationPlugin()` for per-org user management and auth flows.

**Required Tables:**
- `users` - User accounts
- `session` - Active sessions
- `passwordResetTokens` - Password reset flow
- `emailVerificationToken` - Email verification
- `magicLinkTokens` - Magic link authentication

## Setup Instructions

### Step 1: Create Your Schemas

```bash
# Create schema directory in your app
mkdir -p src/lib/schemas
```

### Step 2: Copy Reference Examples

Copy from `node_modules/kuratchi-sdk/src/lib/schema/*.example.ts`:

```typescript
// src/lib/schemas/admin.ts
import type { SchemaDsl } from 'kuratchi-sdk';

export const adminSchema: SchemaDsl = {
  name: 'admin',
  version: 1,
  mixins: {
    timestamps: {
      updated_at: 'text default now',
      created_at: 'text default now',
      deleted_at: 'text'
    }
  },
  tables: {
    organizations: {
      id: 'text primary key not null',
      organizationName: 'text not null',
      organizationSlug: 'text not null unique',
      email: 'text',
      status: 'enum(active,inactive,suspended)',
      '...timestamps': true
    },
    databases: {
      id: 'text primary key not null',
      organization_id: 'text not null -> organizations.id cascade',
      database_name: 'text not null unique',
      db_token: 'text not null',
      status: 'enum(active,inactive)',
      '...timestamps': true
    },
    dbApiTokens: {
      id: 'text primary key not null',
      database_id: 'text not null -> databases.id cascade',
      token: 'text not null unique',
      expires: 'timestamp_ms',
      revoked: 'boolean default false',
      '...timestamps': true
    },
    organizationUsers: {
      id: 'text primary key not null',
      organization_id: 'text not null -> organizations.id cascade',
      email: 'text not null',
      role: 'enum(owner,admin,member)',
      '...timestamps': true
    }
  }
};
```

```typescript
// src/lib/schemas/organization.ts
import type { SchemaDsl } from 'kuratchi-sdk';

export const organizationSchema: SchemaDsl = {
  name: 'organization',
  version: 1,
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
      name: 'text',
      email: 'text not null unique',
      emailVerified: 'timestamp_ms',
      password_hash: 'text',
      role: 'enum(owner,editor,member)',
      '...timestamps': true
    },
    session: {
      sessionToken: 'text primary key not null',
      userId: 'text not null -> users.id cascade',
      expires: 'timestamp_ms not null',
      '...timestamps': true
    },
    passwordResetTokens: {
      id: 'text primary key',
      token: 'text not null',
      email: 'text not null',
      expires: 'timestamp_ms not null',
      '...timestamps': true
    },
    emailVerificationToken: {
      id: 'text primary key',
      token: 'text not null',
      email: 'text not null',
      userId: 'text not null',
      expires: 'timestamp_ms not null',
      '...timestamps': true
    },
    magicLinkTokens: {
      id: 'text primary key',
      token: 'text not null unique',
      email: 'text not null',
      redirectTo: 'text',
      consumed_at: 'timestamp_ms',
      expires: 'timestamp_ms not null',
      '...timestamps': true
    }
  }
};
```

### Step 3: Configure Plugins

```typescript
// src/hooks.server.ts
import { kuratchi } from 'kuratchi-sdk';
import { sessionPlugin, adminPlugin, organizationPlugin } from 'kuratchi-sdk/auth';
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';

const app = kuratchi({
  auth: {
    plugins: [
      sessionPlugin(),
      adminPlugin({ adminSchema }),           // REQUIRED
      organizationPlugin({ organizationSchema }) // REQUIRED
    ]
  }
});

export const handle = app.handle;
```

## Customization

You can customize schemas to fit your needs:

### ✅ Allowed
- Add custom fields to any table
- Add custom tables
- Change field types (with caution - ensure compatibility)
- Add indexes, constraints, foreign keys
- Modify mixins

### ❌ Not Allowed
- Remove required tables
- Remove required fields used by auth flows
- Change required field names (breaks auth logic)

### Example: Adding Custom Fields

```typescript
tables: {
  users: {
    id: 'text primary key not null',
    email: 'text not null unique',
    password_hash: 'text',
    
    // ✅ Custom fields
    avatar_url: 'text',
    bio: 'text',
    preferences: 'json',
    subscription_tier: 'enum(free,pro,enterprise)',
    
    '...timestamps': true
  }
}
```

### Example: Adding Custom Tables

```typescript
tables: {
  // ... required tables ...
  
  // ✅ Custom tables
  posts: {
    id: 'text primary key not null',
    user_id: 'text not null -> users.id cascade',
    title: 'text not null',
    content: 'text',
    '...timestamps': true
  }
}
```

## Error Messages

If you forget to provide a schema:

```
[Admin Plugin] adminSchema is required. See src/lib/schema/admin.example.ts for reference structure.
```

```
[Organization Plugin] organizationSchema is required. See src/lib/schema/organization.example.ts for reference structure.
```

## Migration from v1

### v1 (Implicit Defaults)
```typescript
import { auth } from 'kuratchi-sdk';

// Schema auto-loaded from SDK
export const handle = auth.handle();
```

### v2 (Explicit Configuration)
```typescript
import { kuratchi } from 'kuratchi-sdk';
import { adminPlugin, organizationPlugin } from 'kuratchi-sdk/auth';
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';

export const handle = kuratchi({
  auth: {
    plugins: [
      adminPlugin({ adminSchema }),
      organizationPlugin({ organizationSchema })
    ]
  }
}).handle;
```

## Benefits

1. **Explicit = Predictable**: No magic, no surprises
2. **Type-Safe**: Your schemas, your types
3. **Flexible**: Customize freely without fighting defaults
4. **Clear Errors**: Missing schema? Immediate, helpful error
5. **DRY**: Schema is single source of truth for your app

## Reference

- **Admin Schema Example**: `node_modules/kuratchi-sdk/src/lib/schema/admin.example.ts`
- **Org Schema Example**: `node_modules/kuratchi-sdk/src/lib/schema/organization.example.ts`
- **Schema README**: `node_modules/kuratchi-sdk/src/lib/schema/README.md`
