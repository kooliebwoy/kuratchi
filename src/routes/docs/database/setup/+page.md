---
layout: docs
---

# Database Setup

Configure your environment for database provisioning.

## Environment Variables

```bash
KURATCHI_GATEWAY_KEY=your-gateway-key
CLOUDFLARE_WORKERS_SUBDOMAIN=your-subdomain
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

## Get Gateway Key

```bash
npx kuratchi-sdk admin create
```

This outputs your gateway key and admin database credentials.

## Initialize Database Module

```typescript
import { database } from 'kuratchi-sdk';

const db = database.instance({
  gatewayKey: env.KURATCHI_GATEWAY_KEY,
  workersSubdomain: env.CLOUDFLARE_WORKERS_SUBDOMAIN,
  accountId: env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: env.CLOUDFLARE_API_TOKEN
});
```

[Next: Provision databases →](/docs/database/provisioning)
