# Kuratchi SDK Architecture

Complete reference for the plugin-based architecture and namespace organization.

## Plugin System

### Core Concept
Kuratchi uses a **plugin-based architecture** where functionality is composed from independent, configurable plugins. Each plugin can hook into different lifecycle stages.

### Plugin Lifecycle Hooks

1. **`onRequest`** - First, runs on every request
   - Initialize plugin state
   - Set up helpers on `locals.kuratchi`
   - Example: adminPlugin sets up `getAdminDb()`

2. **`onSession`** - After session is loaded
   - Access session data
   - Determine user permissions
   - Example: adminPlugin checks if user is superadmin

3. **`onResponse`** - Before response is sent
   - Modify response headers
   - Log metrics
   - Example: Set CORS headers

## Built-in Plugins

### 1. **sessionPlugin()**
Handles session management with cookies.

**Provides:**
```typescript
locals.session = {
  user: { id, email, name },
  organizationId: string | null
}
```

**Options:**
```typescript
{
  cookieName?: string;
  sessionMaxAge?: number;
  storage?: 'cookie' | 'database';
}
```

---

### 2. **adminPlugin(options)**
Multi-tenant admin operations + superadmin capabilities.

**Provides:**
```typescript
// Admin operations
locals.kuratchi.auth.admin = {
  listOrganizations(),
  getOrganization(id),
  createOrganization(data),
  deleteOrganization(id),
  refreshDatabaseToken(orgId),
  attachDatabase({ databaseId, organizationId }),
  detachDatabase(databaseId),
  seedSuperadmin(params)
}

// Superadmin state
locals.kuratchi.superadmin = {
  isSuperadmin(),
  getActiveOrgId(),
  setOrganization(orgId, persist?),
  clearOrganization()
}

// Database helpers
locals.kuratchi.getAdminDb()
locals.kuratchi.getOrgDb(orgId)
```

**Options:**
```typescript
{
  adminSchema: any;           // Required
  organizationSchema?: any;
  getAdminDb?: (event) => Promise<any>;
  isSuperadmin?: (ctx, adminDb) => boolean;
  superadminCookieName?: string;
  seedKey?: string;
}
```

**Superadmin Detection:**
- Default: Checks `role === 'superadmin'` in admin DB users table
- Custom: Provide `isSuperadmin` function

---

### 3. **organizationPlugin(options)**
Organization-scoped database access.

**Provides:**
```typescript
locals.kuratchi.organization = {
  getCurrentOrganization(),
  switchOrganization(orgId)
}
```

**Options:**
```typescript
{
  organizationSchema: any;
  autoCreateDatabase?: boolean;
}
```

---

### 4. **activityPlugin()**
Dual-logging activity tracking (admin + org level).

**Provides:**
```typescript
locals.kuratchi.activity = {
  logActivity(options),      // Dual-log: admin + org
  log(options),              // Alias
  logAdminActivity(options), // Admin-only
  logOrgActivity(orgDb, options), // Org-only
  getAdminActivity(options),
  getOrgActivity(orgDb, options)
}
```

**Usage:**
```typescript
await locals.kuratchi.activity.logActivity({
  action: 'user.created',
  data: { userId: '123' },
  isAdminAction: true,
  isHidden: false,  // Show in org
  organizationId: 'org-abc'
});
```

---

### 5. **credentialsPlugin()**
Email/password authentication.

**Provides:**
```typescript
locals.kuratchi.auth.credentials = {
  login(email, password),
  register(email, password, name?),
  resetPassword(email),
  confirmReset(token, newPassword)
}
```

---

### 6. **oauthPlugin(options)**
OAuth provider integration (Google, GitHub, etc.).

**Options:**
```typescript
{
  providers: {
    google: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    }
  }
}
```

---

### 7. **rolesPlugin()**
Role-based access control.

**Provides:**
```typescript
locals.kuratchi.roles = {
  hasRole(role),
  hasAnyRole(roles),
  hasAllRoles(roles)
}
```

**Guards:**
```typescript
requireRole('admin')
requireRole(['admin', 'editor'])
```

---

## Route Guards

### Built-in Guards

```typescript
import { requireAuth, requireSuperadmin, requireRole } from 'kuratchi-sdk/auth';

// Require any authenticated user
export const load = requireAuth();

// Require superadmin
export const load = requireSuperadmin();

// Require specific role
export const load = requireRole('admin');
export const load = requireRole(['admin', 'editor']); // any of these
```

### Custom Guards

```typescript
function requireOwner(): RouteGuard {
  return ({ locals, params }) => {
    const user = locals.session?.user;
    const orgUser = await getOrgUser(user.id);
    
    if (orgUser.role !== 'owner') {
      return new Response('Forbidden', { status: 403 });
    }
  };
}
```

---

## Complete Namespace Reference

```typescript
locals = {
  // Session (from sessionPlugin)
  session?: {
    user: { id, email, name, ... },
    organizationId: string | null
  },
  
  // Kuratchi SDK
  kuratchi: {
    // Auth operations
    auth: {
      admin: {
        listOrganizations(),
        createOrganization(data),
        deleteOrganization(id),
        seedSuperadmin(params),
        // ... more
      },
      credentials: {
        login(email, password),
        register(email, password),
        // ... more
      }
    },
    
    // Superadmin state
    superadmin: {
      isSuperadmin(),
      getActiveOrgId(),
      setOrganization(orgId),
      clearOrganization()
    },
    
    // Organization helpers
    organization: {
      getCurrentOrganization(),
      switchOrganization(orgId)
    },
    
    // Activity logging
    activity: {
      logActivity(options),
      getAdminActivity(options),
      getOrgActivity(orgDb, options)
    },
    
    // Roles
    roles: {
      hasRole(role),
      hasAnyRole(roles),
      hasAllRoles(roles)
    },
    
    // Database access
    getAdminDb(),
    getOrgDb(orgId)
  }
}
```

---

## Usage Examples

### Creating an Organization

```typescript
import { getRequestEvent } from '$app/server';

export const createOrg = async (data) => {
  const { locals } = getRequestEvent();
  
  const result = await locals.kuratchi.auth.admin.createOrganization({
    organizationName: data.name,
    email: data.ownerEmail,
    userName: data.ownerName,
    password: data.password
  });
  
  return result;
};
```

### Logging Activity

```typescript
import { getRequestEvent } from '$app/server';

export const deleteUser = async (userId) => {
  const { locals } = getRequestEvent();
  
  // Delete user...
  
  // Log activity
  await locals.kuratchi.activity.logActivity({
    action: 'user.deleted',
    data: { userId },
    isAdminAction: true,
    organizationId: locals.session.organizationId
  });
};
```

### Checking Superadmin

```typescript
import { getRequestEvent } from '$app/server';

export const load = async () => {
  const { locals } = getRequestEvent();
  
  const isSuper = locals.kuratchi.superadmin.isSuperadmin();
  
  if (isSuper) {
    // Show admin panel
    const orgs = await locals.kuratchi.auth.admin.listOrganizations();
    return { organizations: orgs };
  }
  
  return {};
};
```

### Organization Switching (Superadmin)

```typescript
export const switchOrg = async (orgId: string) => {
  const { locals } = getRequestEvent();
  
  if (!locals.kuratchi.superadmin.isSuperadmin()) {
    error(403, 'Only superadmins can switch organizations');
  }
  
  locals.kuratchi.superadmin.setOrganization(orgId);
  
  return { success: true };
};
```

---

## Plugin Configuration Example

```typescript
// hooks.server.ts
import { createAuthHandle } from 'kuratchi-sdk/auth';
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin({
      cookieName: 'my_session',
      sessionMaxAge: 30 * 24 * 60 * 60 // 30 days
    }),
    
    adminPlugin({
      adminSchema,
      organizationSchema,
      superadminCookieName: 'admin_org_override'
    }),
    
    organizationPlugin({
      organizationSchema
    }),
    
    credentialsPlugin(),
    
    activityPlugin(),
    
    rolesPlugin()
  ]
});
```

---

## Best Practices

1. **Plugin Order Matters**
   - `sessionPlugin` should be first
   - `adminPlugin` before `organizationPlugin`
   - Auth plugins before role/guard plugins

2. **Use Guards for Protection**
   ```typescript
   // ✅ Good
   export const load = requireSuperadmin();
   
   // ❌ Avoid
   export const load = async ({ locals }) => {
     if (!locals.kuratchi.superadmin.isSuperadmin()) {
       throw error(403);
     }
   };
   ```

3. **Namespace Consistently**
   - Admin operations: `locals.kuratchi.auth.admin.*`
   - Activity logging: `locals.kuratchi.activity.*`
   - State checks: `locals.kuratchi.superadmin.*`

4. **Log Important Actions**
   ```typescript
   // Always log admin actions
   await locals.kuratchi.activity.logActivity({
     action: 'organization.deleted',
     isAdminAction: true,
     isHidden: true, // Hide from org
     organizationId: orgId
   });
   ```

5. **Use Type Safety**
   ```typescript
   import type { ActivityLogOptions } from 'kuratchi-sdk/auth';
   
   const logOptions: ActivityLogOptions = {
     action: 'user.created',
     // TypeScript will enforce correct options
   };
   ```
