---
layout: docs
---

# Multi-tenant Example

Full SaaS setup with organization management and per-org databases.

## What You Get

- ✅ Everything from Auth + Storage
- ✅ Organization management
- ✅ Per-org databases
- ✅ Admin controls
- ✅ Tenant isolation

## Setup

### 1. Create Admin Database

```bash
npx kuratchi-sdk admin create
```

Save the output tokens to your `.env` file.

### 2. Configure Auth

```typescript
// src/hooks.server.ts
import { 
  createAuthHandle, 
  sessionPlugin, 
  adminPlugin,
  storagePlugin,
  emailAuthPlugin 
} from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    adminPlugin({
      adminDbName: process.env.KURATCHI_ADMIN_DB_NAME,
      adminDbToken: process.env.KURATCHI_ADMIN_DB_TOKEN,
      gatewayKey: process.env.KURATCHI_GATEWAY_KEY
    }),
    storagePlugin(),
    emailAuthPlugin({
      provider: 'resend',
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM
    })
  ]
});
```

### 3. Environment Variables

```bash
# .env
KURATCHI_AUTH_SECRET=your-secret-key
EMAIL_FROM=noreply@example.com
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Multi-tenant
KURATCHI_ADMIN_DB_NAME=kuratchi-admin
KURATCHI_ADMIN_DB_TOKEN=token-from-cli
KURATCHI_GATEWAY_KEY=gateway-key
CLOUDFLARE_WORKERS_SUBDOMAIN=your-subdomain
CLOUDFLARE_ACCOUNT_ID=account-id
CLOUDFLARE_API_TOKEN=api-token
```

## Create Organization

```typescript
// src/routes/admin/create-org/+page.server.ts
import { auth } from 'kuratchi-sdk';

export const actions = {
  default: async ({ request, locals }) => {
    const data = await request.formData();
    const orgName = data.get('name');
    
    const org = await auth.admin(locals.adminDb).createOrganization({
      name: orgName,
      ownerId: locals.user.id
    });
    
    return { success: true, org };
  }
};
```

## Access Org Database

```typescript
// src/routes/dashboard/+page.server.ts
export async function load({ locals }) {
  const orgDb = await auth.forOrganization(
    locals.user.organizationId,
    schema
  );
  
  const projects = await orgDb.projects.all();
  
  return { projects };
}
```

## Organization Switching

```typescript
// src/routes/api/switch-org/+server.ts
export async function POST({ request, locals, cookies }) {
  const { organizationId } = await request.json();
  
  // Update session with new org
  const session = await auth.updateSession(locals.session.id, {
    organizationId
  });
  
  cookies.set('session', session.token, { path: '/' });
  
  return Response.json({ success: true });
}
```

[View environment setup →](/docs/auth/environment)
