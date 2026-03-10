# @kuratchi/sdk

Unified client SDK for the Kuratchi platform.

## Install

```bash
npm install @kuratchi/sdk
```

## Quick Start

```ts
import { createClient } from '@kuratchi/sdk';

const kuratchi = createClient({
  apiKey: process.env.KURATCHI_API_KEY!,
  baseUrl: 'https://your-kuratchi-instance.com',
});

const db = kuratchi.database('my-db');
await db.query('SELECT * FROM users');
```

## Included Clients

- `database(name)` for D1-backed SQL access
- `kv(name)` for Workers KV operations
- `r2(name)` for R2 object storage
- `platform` for control-plane resource management
