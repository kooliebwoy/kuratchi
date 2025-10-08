# Plugin Consolidation Guide

## Summary

Consolidated `superadminPlugin` into `adminPlugin` and improved plugin naming consistency.

## Changes Made

### 1. **Superadmin → Admin Plugin Merge**

**Before:**
- Separate `superadminPlugin` for superadmin detection
- `adminPlugin` for multi-tenant management

**After:**
- Single `adminPlugin` handles both admin operations AND superadmin capabilities
- Superadmin detection based on `role === 'superadmin'` in admin DB users table

### 2. **Activity Plugin Improvements**

**Before:**
- `createActivityPlugin()` function name
- Methods: `log()`, `logAdmin()`, `getAdminActivities()`

**After:**
- `activityPlugin()` - consistent naming with other plugins
- Methods follow namespace pattern:
  - `logActivity()` - Main dual-logging method
  - `log()` - Alias for convenience
  - `logAdminActivity()` - Admin-only logging
  - `logOrgActivity()` - Org-only logging
  - `getAdminActivity()` - Fetch admin activities
  - `getOrgActivity()` - Fetch org activities

### 3. **Naming Consistency**

All plugins now follow the pattern: `{name}Plugin()`
- ✅ `sessionPlugin()`
- ✅ `adminPlugin()`
- ✅ `organizationPlugin()`
- ✅ `credentialsPlugin()`
- ✅ `activityPlugin()`
- ❌ ~~`createActivityPlugin()`~~
- ❌ ~~`superadminPlugin()`~~

## Migration Steps

### 1. Update `hooks.server.ts`

**Before:**
```typescript
import { 
  createAuthHandle,
  sessionPlugin,
  adminPlugin,
  organizationPlugin,
  superadminPlugin,
  credentialsPlugin
} from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    adminPlugin({ adminSchema, organizationSchema }),
    organizationPlugin({ organizationSchema }),
    superadminPlugin(),
    credentialsPlugin()
  ]
});
```

**After:**
```typescript
import { 
  createAuthHandle,
  sessionPlugin,
  adminPlugin,
  organizationPlugin,
  credentialsPlugin,
  activityPlugin
} from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    adminPlugin({ adminSchema, organizationSchema }), // Now includes superadmin
    organizationPlugin({ organizationSchema }),
    credentialsPlugin(),
    activityPlugin() // New: activity tracking
  ]
});
```

### 2. Update Superadmin References

**Before:**
```typescript
locals.kuratchi.superadmin.seedSuperadmin({ ... })
```

**After:**
```typescript
locals.kuratchi.auth.admin.seedSuperadmin({ ... })
```

**Superadmin helpers remain the same:**
```typescript
locals.kuratchi.superadmin.isSuperadmin()
locals.kuratchi.superadmin.getActiveOrgId()
locals.kuratchi.superadmin.setOrganization(orgId)
locals.kuratchi.superadmin.clearOrganization()
```

### 3. Update Route Guards

**No changes needed** - guards still work the same:
```typescript
import { requireSuperadmin } from 'kuratchi-sdk/auth';

export const load = requireSuperadmin();
```

## SDK Namespace Structure

```typescript
locals.kuratchi = {
  // Session info (from sessionPlugin)
  session: { user, email, ... },
  
  // Admin operations (from adminPlugin)
  auth: {
    admin: {
      listOrganizations(),
      getOrganization(id),
      createOrganization(data),
      deleteOrganization(id),
      refreshDatabaseToken(orgId),
      seedSuperadmin(params), // ← Moved here
      // ... more admin ops
    }
  },
  
  // Superadmin state (from adminPlugin)
  superadmin: {
    isSuperadmin(),
    getActiveOrgId(),
    setOrganization(orgId),
    clearOrganization()
  },
  
  // Activity tracking (from activityPlugin)
  activity: {
    logActivity(options),
    log(options), // alias
    logAdminActivity(options),
    logOrgActivity(orgDb, options),
    getAdminActivity(options),
    getOrgActivity(orgDb, options)
  },
  
  // Database helpers
  getAdminDb(),
  getOrgDb(orgId)
}
```

## Admin Plugin Options

```typescript
interface AdminPluginOptions {
  // Required
  adminSchema: any;
  
  // Optional
  organizationSchema?: any;
  getAdminDb?: (event: any) => Promise<any> | any;
  
  // Superadmin options (new)
  isSuperadmin?: (ctx: SessionContext, adminDb: any) => Promise<boolean> | boolean;
  superadminCookieName?: string; // default: 'kuratchi_super_org'
  seedKey?: string; // reads from KURATCHI_SUPERADMIN_KEY env by default
}
```

## Database Schema Requirements

### Admin DB Users Table
```typescript
users: {
  id: 'text primary key',
  email: 'text not null unique',
  name: 'text',
  password_hash: 'text',
  role: 'enum(admin,superadmin)', // ← superadmin role
  status: 'boolean',
  emailVerified: 'timestamp_ms',
  ...timestamps
}
```

### Organization DB Users Table
```typescript
users: {
  id: 'text primary key',
  email: 'text not null unique',
  name: 'text',
  password_hash: 'text',
  role: 'enum(owner,editor,member)', // ← org-level roles
  status: 'boolean',
  ...timestamps
}
```

## Benefits

1. **Simpler Architecture**
   - One plugin for all admin concerns
   - Less confusion about where features belong
   
2. **Consistent Naming**
   - All plugins follow same pattern
   - Easier to remember and discover
   
3. **Better Namespace Organization**
   - `locals.kuratchi.auth.admin.*` for admin operations
   - `locals.kuratchi.superadmin.*` for superadmin state
   - `locals.kuratchi.activity.*` for activity logging
   
4. **Role-Based Approach**
   - Superadmin is just a role in the admin DB
   - Easy to add more admin roles later (e.g., `support`, `billing`)
   - No special plugin needed

## Breaking Changes

- ❌ `superadminPlugin()` removed - use `adminPlugin()`
- ❌ `createActivityPlugin()` → `activityPlugin()`
- ❌ `locals.kuratchi.superadmin.seedSuperadmin()` → `locals.kuratchi.auth.admin.seedSuperadmin()`

## Backward Compatibility

The following still work:
- ✅ `requireSuperadmin()` guard
- ✅ `locals.kuratchi.superadmin.isSuperadmin()`
- ✅ Org switching helpers
- ✅ All admin operations
