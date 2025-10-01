---
layout: docs
---

# Authentication Overview

The Kuratchi auth module provides flexible, plugin-based authentication for SvelteKit applications.

## Choose Your Setup

Select the authentication approach that fits your needs:

### 🎯 Simple Auth
Just session management - perfect for basic apps without multi-tenancy.
- Session cookies
- User authentication
- No storage dependencies

[View Simple Auth Example →](/docs/auth/examples/simple)

### 💾 Auth + Storage
Authentication with direct access to Cloudflare storage (KV, R2, D1).
- Everything from Simple Auth
- KV, R2, D1 bindings
- File uploads and caching

[View Storage Example →](/docs/auth/examples/storage)

### 🏢 Multi-tenant
Full organization management for SaaS applications.
- Everything from Auth + Storage
- Organization management
- Per-org databases
- Admin controls

[View Multi-tenant Example →](/docs/auth/examples/multi-tenant)

## Plugin Architecture

Kuratchi uses a v2 plugin system that lets you compose exactly what you need:

### Core Plugins
- **Session Plugin** - Session management and cookies
- **Admin Plugin** - Organization and database management
- **Storage Plugin** - KV, R2, D1 access
- **Guard Plugin** - Route protection

### Auth Provider Plugins
- **[Email Auth](/docs/auth/providers/email)** - Magic link authentication
- **[OAuth](/docs/auth/providers/oauth)** - Google, GitHub, Microsoft, custom
- **[Credentials](/docs/auth/providers/credentials)** - Email/password with rate limiting

## Quick Start

```typescript
// hooks.server.ts
import { createAuthHandle, sessionPlugin, emailAuthPlugin } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    emailAuthPlugin({
      provider: 'resend',
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM
    })
  ]
});
```

## Next Steps

1. **[Set up environment variables](/docs/auth/environment)** - Configure your auth settings
2. **[Choose auth providers](/docs/auth/providers/email)** - Email, OAuth, or credentials
3. **[Follow an example](/docs/auth/examples/simple)** - Complete implementation guide

## Features

- ✅ Multiple authentication methods
- ✅ Session management
- ✅ Organization/tenant support
- ✅ Rate limiting
- ✅ Route guards
- ✅ TypeScript support
- ✅ SvelteKit optimized
