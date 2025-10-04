# Kuratchi Plugin API Reference

This document describes the batteries-included namespaced API provided by Kuratchi plugins.

## Overview

Kuratchi v2 uses a plugin architecture that provides high-level, batteries-included methods through namespaced APIs on `locals.kuratchi`. This combines the flexibility of plugins with the convenience of the v1 API.

## Namespace Structure

```typescript
locals.kuratchi = {
  // Low-level helpers (infrastructure)
  getAdminDb: () => Promise<OrmClient>,
  orgDatabaseClient: (orgId?, options?) => Promise<OrmClient>,
  setSessionCookie: (data, options?) => void,
  clearSessionCookie: () => void,
  session: SessionData | null,
  user: UserData | null,
  
  // High-level operations (batteries-included)
  admin: {
    listOrganizations: () => Promise<Organization[]>,
    getOrganization: (id: string) => Promise<Organization>,
    deleteOrganization: (id: string) => Promise<{ success: boolean }>
  },
  
  org: {
    createUser: (userData, orgId?) => Promise<User>,
    getUser: (userId, orgId?) => Promise<User>,
    getUserByEmail: (email, orgId?) => Promise<User>,
    listUsers: (orgId?) => Promise<User[]>,
    updateUser: (userId, userData, orgId?) => Promise<User>,
    deleteUser: (userId, orgId?) => Promise<{ success: boolean }>,
    createRole: (roleData, orgId?) => Promise<Role>
  },
  
  // Storage (from storagePlugin)
  kv: Record<string, KVNamespace>,
  r2: Record<string, R2Bucket>,
  d1: Record<string, D1Database>
}
```

## Admin Operations (`adminPlugin`)

The admin plugin provides operations for managing organizations in the admin database.

### Configuration

```typescript
import { adminPlugin } from 'kuratchi-sdk/auth';
import { myAdminSchema } from '$lib/schemas/admin';
import { myOrgSchema } from '$lib/schemas/organization';

const app = kuratchi({
  auth: {
    plugins: [
      sessionPlugin(),
      adminPlugin({
        // REQUIRED: Your admin database schema
        adminSchema: myAdminSchema,
        // OPTIONAL: Organization schema for auto-provisioning org databases
        organizationSchema: myOrgSchema,
        // Optional: custom admin DB getter
        getAdminDb: async (event) => myCustomAdminDb
      })
    ]
  }
});
```

**Required Schema Tables:**
- `organizations` - Organization registry
- `databases` - Database-to-org mapping  
- `dbApiTokens` - Database access tokens
- `organizationUsers` - User-to-org mapping

See `src/lib/schema/admin.example.ts` for reference structure.

### API Methods

#### `listOrganizations()`

List all active organizations.

```typescript
// src/routes/admin/organizations/+page.server.ts
export async function load({ locals }) {
  const orgs = await locals.kuratchi.admin.listOrganizations();
  return { organizations: orgs };
}
```

**Returns:** `Promise<Organization[]>`

#### `getOrganization(id)`

Get a single organization by ID.

```typescript
export async function load({ locals, params }) {
  const org = await locals.kuratchi.admin.getOrganization(params.id);
  return { organization: org };
}
```

**Returns:** `Promise<Organization | undefined>`

#### `createOrganization(orgData)`

Create a new organization with a dedicated database (fully provisioned and migrated).

```typescript
// src/routes/api/organizations/+server.ts
export async function POST({ locals, request }) {
  const data = await request.json();
  
  const result = await locals.kuratchi.admin.createOrganization({
    organizationName: data.name,
    organizationSlug: data.slug,
    email: data.email,
    userId: locals.session?.user?.id,
    status: 'active'
  });
  
  return json(result);
}
```

**Parameters:**
- `organizationName` (string) - Organization display name
- `organizationSlug` (string) - URL-safe slug
- `email` (string) - Organization contact email
- `userId` (string, optional) - User ID to associate as owner
- `status` ('active' | 'inactive' | 'lead', optional) - Organization status

**Returns:** 
```typescript
Promise<{
  success: true,
  organization: {
    id: string,
    name: string,
    slug: string,
    email: string
  },
  database: {
    id: string,
    name: string,
    token: string
  }
}>
```

**What it does:**
1. Creates organization record in admin DB
2. Provisions new database for the organization (with migrations applied)
3. Stores database credentials in admin DB
4. Creates organization-user mapping (if userId provided)
5. Returns organization and database info

**Note:** Requires `organizationSchema` in plugin config to auto-provision and migrate the org database.

#### `deleteOrganization(id)`

Soft delete an organization and all related records.

```typescript
export const actions = {
  delete: async ({ locals, params }) => {
    await locals.kuratchi.admin.deleteOrganization(params.id);
    return { success: true };
  }
};
```

**Returns:** `Promise<{ success: boolean }>`

#### `refreshDatabaseToken(organizationId)`

Refresh the database token for an organization (useful when tokens are expiring or compromised).

```typescript
export const actions = {
  refreshToken: async ({ locals, request }) => {
    const data = await request.formData();
    const orgId = data.get('organizationId');
    
    const result = await locals.kuratchi.admin.refreshDatabaseToken(orgId);
    return { success: true, result };
  }
};
```

**Returns:** `Promise<{ success: boolean, databaseName: string, organizationId: string }>`

**Note:** Organization database tokens have a 1-year TTL by default. Admin database tokens have a 100-year TTL to avoid expiration deadlock. See `TOKEN_MANAGEMENT.md` for details.

---

## Organization Operations (`organizationPlugin`)

The organization plugin provides user and role management within an organization's database.

### Configuration

```typescript
import { organizationPlugin } from 'kuratchi-sdk/auth';
import { myOrgSchema } from '$lib/schemas/organization';
import { myAdminSchema } from '$lib/schemas/admin';

const app = kuratchi({
  auth: {
    plugins: [
      sessionPlugin(),
      adminPlugin({ adminSchema: myAdminSchema }),
      organizationPlugin({
        // REQUIRED: Your organization database schema
        organizationSchema: myOrgSchema
      })
    ]
  }
});
```

**Required Schema Tables:**
- `users` - User accounts
- `session` - Active sessions
- `passwordResetTokens` - Password reset flow
- `emailVerificationToken` - Email verification
- `magicLinkTokens` - Magic link authentication

See `src/lib/schema/organization.example.ts` for reference structure.

### API Methods

All methods accept an optional `orgId` parameter. If omitted, uses the organization from the current session.

#### `createUser(userData, orgId?)`

Create a new user in the organization database.

```typescript
export const actions = {
  create: async ({ locals, request }) => {
    const data = await request.formData();
    
    const user = await locals.kuratchi.org.createUser({
      email: data.get('email'),
      name: data.get('name'),
      role: 'member'
    });
    
    return { user };
  }
};
```

**Parameters:**
- `userData: { email: string, password?: string, [key: string]: any }`
- `orgId?: string` - Optional organization ID override

**Returns:** `Promise<User>`

#### `getUser(userId, orgId?)`

Get a user by ID.

```typescript
export async function load({ locals, params }) {
  const user = await locals.kuratchi.org.getUser(params.userId);
  return { user };
}
```

**Returns:** `Promise<User | undefined>`

#### `getUserByEmail(email, orgId?)`

Get a user by email address.

```typescript
const user = await locals.kuratchi.org.getUserByEmail('admin@example.com');
```

**Returns:** `Promise<User | undefined>`

#### `listUsers(orgId?)`

List all active users in the organization.

```typescript
export async function load({ locals }) {
  const users = await locals.kuratchi.org.listUsers();
  return { users };
}
```

**Returns:** `Promise<User[]>`

#### `updateUser(userId, userData, orgId?)`

Update a user's data.

```typescript
export const actions = {
  update: async ({ locals, request, params }) => {
    const data = await request.formData();
    
    const user = await locals.kuratchi.org.updateUser(params.userId, {
      name: data.get('name'),
      role: data.get('role')
    });
    
    return { user };
  }
};
```

**Returns:** `Promise<User>`

#### `deleteUser(userId, orgId?)`

Soft delete a user.

```typescript
export const actions = {
  delete: async ({ locals, params }) => {
    await locals.kuratchi.org.deleteUser(params.userId);
    return { success: true };
  }
};
```

**Returns:** `Promise<{ success: boolean }>`

#### `createRole(roleData, orgId?)`

Create a new role (requires `roles` table in org schema).

```typescript
const role = await locals.kuratchi.org.createRole({
  name: 'editor',
  permissions: ['read', 'write']
});
```

**Returns:** `Promise<Role>`

---

## Complete Example

Here's a complete example using all namespaced APIs:

```typescript
// src/routes/admin/dashboard/+page.server.ts
export async function load({ locals }) {
  // Admin operations
  const organizations = await locals.kuratchi.admin.listOrganizations();
  
  // Organization operations (uses current session org)
  const users = await locals.kuratchi.org.listUsers();
  
  // Low-level DB access (if needed)
  const orgDb = await locals.kuratchi.orgDatabaseClient();
  const customData = await orgDb.customTable.many();
  
  return {
    organizations,
    users,
    customData: customData?.data ?? []
  };
}

export const actions = {
  createUser: async ({ locals, request }) => {
    const data = await request.formData();
    
    const user = await locals.kuratchi.org.createUser({
      email: data.get('email'),
      name: data.get('name'),
      role: 'member'
    });
    
    return { success: true, user };
  },
  
  deleteOrg: async ({ locals, request }) => {
    const data = await request.formData();
    const orgId = data.get('orgId');
    
    await locals.kuratchi.admin.deleteOrganization(orgId);
    
    return { success: true };
  }
};
```

---

## Migration from V1

### Before (V1)

```typescript
import { auth } from 'kuratchi-sdk';

const admin = await auth.admin();
const orgs = await admin.listOrganizations();
const org = await admin.getOrganization(id);
```

### After (V2 - Batteries Included)

```typescript
// In a SvelteKit route
const orgs = await locals.kuratchi.admin.listOrganizations();
const org = await locals.kuratchi.admin.getOrganization(id);
```

**Benefits:**
- ✅ Works directly in routes (no need to create admin instance)
- ✅ Automatically configured from env/plugins
- ✅ Better TypeScript inference from locals
- ✅ Clearer namespacing (admin vs org operations)
- ✅ Plugin-based for flexibility

---

## Plugin Architecture Benefits

1. **Modular**: Only load what you need
2. **Batteries-included**: High-level methods for common tasks
3. **Flexible**: Access low-level APIs when needed
4. **Type-safe**: Full TypeScript support
5. **Testable**: Easy to mock in tests
6. **Consistent**: Same patterns across all features
