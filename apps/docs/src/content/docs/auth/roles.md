---
title: Roles & Permissions
description: Role-based access control for multi-tenant applications.
---

Kuratchi provides a flexible role system for managing user permissions within organizations.

## Built-in Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `owner` | Organization owner | Full access, can transfer ownership |
| `admin` | Administrator | Manage users, settings, billing |
| `editor` | Content editor | Create/edit content |
| `member` | Standard member | Read access, limited write |
| `viewer` | Read-only | View only |
| `moderator` | Content moderator | Moderate content, manage comments |
| `developer` | Developer access | API access, integrations |
| `billing` | Billing manager | Manage subscriptions, invoices |
| `superadmin` | System admin | Cross-org access (admin DB only) |

## User Roles

Roles are stored in the `role` column of the users table:

```typescript
// Organization users table
{
  id: 'uuid',
  email: 'user@example.com',
  role: 'editor',  // User's role in this organization
  status: true     // Active
}
```

## Checking Roles

```typescript
// In your server code
const session = await ctx.locals.kuratchi.auth.session.get();

if (session?.user?.role === 'owner' || session?.user?.role === 'admin') {
  // Allow admin actions
}
```

## Role Hierarchy

```typescript
const roleHierarchy = {
  owner: 100,
  superadmin: 90,
  admin: 80,
  developer: 70,
  billing: 60,
  moderator: 50,
  editor: 40,
  member: 30,
  viewer: 20
};

function hasPermission(userRole: string, requiredRole: string): boolean {
  return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
}
```

## Invite Roles

When inviting users, specify their role:

```typescript
await ctx.locals.kuratchi.auth.admin.inviteUser({
  email: 'new@example.com',
  name: 'New User',
  role: 'editor'  // Cannot assign 'owner' via invite
});
```

**Note:** The `owner` role cannot be assigned via invite. Ownership must be transferred explicitly.

## Role Guards

Create middleware to protect routes:

```typescript
// lib/guards.ts
export function requireRole(...roles: string[]) {
  return async ({ locals }) => {
    const session = await locals.kuratchi.auth.session.get();
    
    if (!session?.user) {
      throw redirect(302, '/auth/signin');
    }
    
    if (!roles.includes(session.user.role)) {
      throw error(403, 'Insufficient permissions');
    }
  };
}

// In +page.server.ts
export const load = async (event) => {
  await requireRole('admin', 'owner')(event);
  // ... admin-only content
};
```

## First User

The first user in an organization is automatically assigned the `owner` role:

```typescript
// In createOrganization
{
  role: 'owner',  // First user is always owner
  status: true
}
```

## Ownership Transfer

```typescript
await ctx.locals.kuratchi.auth.admin.transferOwnership({
  organizationId: 'org-123',
  newOwnerId: 'user-456'
});
```

This will:
1. Set current owner's role to `admin`
2. Set new owner's role to `owner`
