# Schema Reference Examples

This directory contains **reference examples** for Kuratchi database schemas. These are NOT imported or used by default in the SDK.

## Important

⚠️ **You MUST provide your own schemas** when configuring Kuratchi plugins.

These example files are for reference only to show:
- Required table structures for admin and organization databases
- Recommended field types and constraints
- Mixin patterns for common fields (timestamps, soft deletes)

## Usage

Copy and customize these schemas in your application code:

```typescript
// Your app: src/lib/schemas/admin.ts
import type { SchemaDsl } from 'kuratchi-sdk';

export const myAdminSchema: SchemaDsl = {
  name: 'admin',
  version: 1,
  tables: {
    organizations: {
      id: 'text primary key',
      organizationName: 'text not null',
      // ... customize as needed
    },
    databases: {
      id: 'text primary key',
      organization_id: 'text not null -> organizations.id cascade',
      // ... customize as needed
    }
    // Required tables: organizations, databases, dbApiTokens, organizationUsers
  }
};
```

Then pass it to the plugin:

```typescript
import { adminPlugin } from 'kuratchi-sdk/auth';
import { myAdminSchema } from '$lib/schemas/admin';

export const handle = kuratchi({
  auth: {
    plugins: [
      adminPlugin({ adminSchema: myAdminSchema })
    ]
  }
});
```

## Required Tables

### Admin Schema
Must include these tables:
- `organizations` - Organization registry
- `databases` - Database-to-org mapping
- `dbApiTokens` - Database access tokens
- `organizationUsers` - User-to-org mapping (for email lookup)

### Organization Schema
Must include these tables:
- `users` - User accounts
- `session` - Active sessions
- `passwordResetTokens` - Password reset flow
- `emailVerificationToken` - Email verification flow
- `magicLinkTokens` - Magic link authentication

## Customization

You can:
- ✅ Add custom fields to tables
- ✅ Add custom tables
- ✅ Change field types (carefully)
- ✅ Add indexes, constraints
- ❌ Remove required tables
- ❌ Remove required fields used by auth flows

See the `.example.ts` files for complete reference implementations.
