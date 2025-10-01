---
layout: docs
---

# Database Overview

Durable Object-backed SQLite provisioning with typed runtime clients.

## Features

- ✅ Per-organization databases
- ✅ Automatic provisioning
- ✅ Type-safe ORM clients
- ✅ SQL access when needed
- ✅ KV storage included

## Quick Start

```typescript
import { database } from 'kuratchi-sdk';

// Create a database
const db = await database.create({
  name: 'org-123',
  schema,
  gatewayKey: env.KURATCHI_GATEWAY_KEY
});

// Get a client
const client = database.client(schema, 'org-123', env.KURATCHI_GATEWAY_KEY);

// Query
const users = await client.users.all();
```

## Architecture

- **Durable Objects** - Each database is a DO instance
- **SQLite** - Full SQL database per organization
- **HTTP API** - Access via gateway
- **ORM Layer** - Type-safe queries

## Use Cases

### Multi-tenant SaaS
Each organization gets its own isolated database.

### Per-user Data
Create a database for each user's private data.

### Microservices
Separate databases for different services.

## Next Steps

1. [Set up environment](/docs/database/setup)
2. [Provision databases](/docs/database/provisioning)
3. [Use clients](/docs/database/clients)
