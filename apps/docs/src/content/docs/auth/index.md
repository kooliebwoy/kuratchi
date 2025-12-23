---
title: Authentication
description: Multi-tenant authentication with pluggable adapters for Cloudflare D1, RPC, and HTTP.
---

Kuratchi provides a batteries-included authentication system designed for multi-tenant SaaS applications on Cloudflare Workers.

## Quick Start

```typescript
import { kuratchi, adminPlugin, organizationPlugin, credentialsPlugin, sessionPlugin } from '@kuratchi/sdk/auth';
import { d1Adapter } from '@kuratchi/sdk/adapters';
import { adminSchema, organizationSchema } from './schemas';

export const handle = kuratchi({
  plugins: [
    adminPlugin({
      adminDatabase: 'ADMIN_DB',
      adminSchema,
      adapter: d1Adapter({ binding: 'ADMIN_DB' })
    }),
    organizationPlugin({
      organizationSchema
    }),
    sessionPlugin(),
    credentialsPlugin()
  ]
});
```

## Architecture

```
kuratchi() handle
  └── createDatabaseContext({ adapter, bindingName, env })
        ├── D1DatabaseContext (direct D1 bindings)
        ├── RpcDatabaseContext (service bindings, no tokens)
        └── HttpDatabaseContext (HTTP REST API + tokens)
              ↓
        ctx.dbContext (passed to all plugins)
```

## Core Plugins

### Admin Plugin

Manages the admin database containing organizations, databases, and cross-org user mappings.

```typescript
adminPlugin({
  adminDatabase: 'ADMIN_DB',        // Binding name
  adminSchema,                       // Admin database schema
  adapter: d1Adapter({ binding: 'ADMIN_DB' }),  // Optional explicit adapter
  skipMigrations: false              // Auto-sync schema (default: false)
})
```

**Provides:**
- `ctx.locals.kuratchi.getAdminDb()` - Get admin database ORM client
- `ctx.locals.kuratchi.auth.admin.createOrganization()` - Create new org with database
- `ctx.locals.kuratchi.auth.admin.listOrganizations()` - List all organizations
- `ctx.locals.kuratchi.auth.admin.deleteOrganization()` - Soft-delete organization

### Organization Plugin

Provides per-organization database access for multi-tenant isolation.

```typescript
organizationPlugin({
  organizationSchema,                // Org database schema (users, sessions, etc.)
  skipMigrations: false              // Auto-sync schema (default: false)
})
```

**Provides:**
- `ctx.locals.kuratchi.orgDatabaseClient(orgId)` - Get org database ORM client

### Session Plugin

Manages encrypted session cookies and session validation.

```typescript
sessionPlugin({
  cookieName: 'kuratchi_session',    // Cookie name (default)
  maxAge: 30 * 24 * 60 * 60          // 30 days (default)
})
```

**Provides:**
- `ctx.locals.kuratchi.auth.session.get()` - Get current session
- `ctx.locals.kuratchi.auth.session.setCookie()` - Set session cookie
- `ctx.locals.kuratchi.auth.session.clearCookie()` - Clear session cookie

### Credentials Plugin

Email/password authentication with rate limiting.

```typescript
credentialsPlugin({
  maxAttempts: 5,                    // Before lockout (default: 5)
  lockoutDuration: 900000            // 15 minutes (default)
})
```

**Provides:**
- `ctx.locals.kuratchi.auth.credentials.signIn(email, password)` - Sign in
- `ctx.locals.kuratchi.auth.credentials.signOut()` - Sign out

## Documentation

- [Adapters](/auth/adapters/) - D1, RPC, and HTTP adapter configuration
- [OAuth](/auth/oauth/) - Google, Microsoft, and custom OAuth providers
- [Email Verification](/auth/email-verification/) - Email verification flow
- [Roles & Permissions](/auth/roles/) - Role-based access control
