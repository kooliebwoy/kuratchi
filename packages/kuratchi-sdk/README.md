# Kuratchi SDK for SvelteKit

End-to-end auth, multi-tenant databases, storage bindings, notifications, chat spaces, and billing helpers for Cloudflare Workers. Everything is wired through a single `kuratchi()` entry point with modular subpaths when you need them.

## Features at a glance

- 🔐 **Auth plugins** — session, admin/org management, email magic links, OAuth providers, roles/superadmin
- 🗄️ **Database + ORM** — Durable Object gateway with typed ORM clients and migrations
- 💾 **Storage** — KV, R2, and D1 bindings exposed via the auth handle and helper modules
- ✉️ **Notifications** — in-app and email delivery with monitoring alerts and queues
- 💬 **Spaces** — Durable Object–backed chat with token utilities and a deployable worker
- 💳 **Stripe** — customers, subscriptions, checkout, portal, and webhook handling
- ☁️ **Kuratchi Cloud** — managed platform access with a single API key (no Cloudflare creds)
- 🛠️ **CLI** — admin DB provisioning and schema migrations

Full documentation lives in [`src/docs`](./src/docs/README.md) and is rendered in the docs site.

## Quickstart (SvelteKit)

```ts
// src/hooks.server.ts
import { kuratchi } from 'kuratchi-sdk';
import { sessionPlugin, adminPlugin, organizationPlugin, emailAuthPlugin, oauthPlugin } from 'kuratchi-sdk/auth';
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';

const app = kuratchi({
  auth: {
    plugins: [
      sessionPlugin(),
      adminPlugin({ adminSchema }),
      organizationPlugin({ organizationSchema }),
      emailAuthPlugin({
        provider: 'resend',
        apiKey: process.env.RESEND_API_KEY!,
        from: process.env.EMAIL_FROM!
      }),
      oauthPlugin({ providers: [{ name: 'google', clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! }] })
    ]
  },
  database: {
    workersSubdomain: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN!,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    apiToken: process.env.CLOUDFLARE_API_TOKEN!,
    gatewayKey: process.env.KURATCHI_GATEWAY_KEY
  },
  storage: {
    kv: { default: 'APP_KV' },
    r2: { uploads: 'USER_UPLOADS' },
    d1: { analytics: 'ANALYTICS_DB' }
  },
  notifications: {
    resendApiKey: process.env.RESEND_API_KEY,
    resendFrom: process.env.EMAIL_FROM
  },
  stripe: {
    apiKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!
  }
});

export const handle = app.handle;
```

## Auth + database in routes

```ts
// src/routes/+layout.server.ts
export const load = async ({ locals }) => ({
  user: locals.user,
  session: locals.session
});

// src/routes/app/+page.server.ts
export const load = async ({ locals }) => {
  if (!locals.session) throw redirect(302, '/login');

  const db = await locals.kuratchi.orgDatabaseClient();
  const users = await db.users.many();
  return { users: users.data };
};
```

## Admin database provisioning

Run the CLI from the repo root to create the admin database and mint a long-lived token.

```sh
pnpm -C packages/kuratchi-sdk run build
node bin/kuratchi-sdk.mjs init-admin-db --debug
```

Add the issued values to `.env`:

```bash
KURATCHI_ADMIN_DB_NAME=kuratchi-admin
KURATCHI_ADMIN_DB_TOKEN=...
KURATCHI_GATEWAY_KEY=...
CLOUDFLARE_WORKERS_SUBDOMAIN=...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
```

For more scenarios (KV/R2 helpers, notifications, spaces, Stripe, and Kuratchi Cloud), read the guides in [`src/docs`](./src/docs/README.md).
