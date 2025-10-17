# Kuratchi Cloud

Premium managed infrastructure with a single API key.

## Quick Start

```typescript
import { cloud } from 'kuratchi-sdk';

const client = new cloud.Client({
  apiKey: process.env.KURATCHI_API_KEY,
  databaseId: process.env.DATABASE_ID,
  schema: {
    users: {
      id: { type: 'integer', primaryKey: true },
      name: { type: 'text', notNull: true }
    }
  }
});

// Database operations
await client.orm.users.insert({ name: 'Alice' });
await client.query('SELECT * FROM users');

// Platform management
const databases = await client.platform.databases.list();
const analytics = await client.platform.databases.analytics('db-id');
```

## Why Kuratchi Cloud?

### ✅ Single API Key
No need for Cloudflare, Resend, or other service keys. Just your Kuratchi API key.

### ✅ Fully Managed
We handle infrastructure, scaling, and maintenance. You focus on building.

### ✅ Premium Experience
- Automatic backups
- Global edge deployment
- Built-in analytics
- 24/7 monitoring

### ✅ Simple Pricing
One bill for everything. No surprise charges from multiple providers.

## API

### Database Operations

```typescript
// ORM
await client.orm.users.insert({ name: 'Alice' });
const users = await client.orm.users.where({ name: 'Alice' }).many();

// Raw SQL
await client.query('SELECT * FROM users WHERE id = ?', [1]);
await client.exec('CREATE TABLE posts (id INTEGER PRIMARY KEY)');
await client.batch([
  { query: 'INSERT INTO users (name) VALUES (?)', params: ['Bob'] },
  { query: 'INSERT INTO users (name) VALUES (?)', params: ['Charlie'] }
]);

// Drizzle ORM
import { drizzle } from 'drizzle-orm/sqlite-proxy';
const db = drizzle(client.getDrizzleProxy());
```

### Platform Management

```typescript
// List databases
const { data: databases } = await client.platform.databases.list();

// Create database
const result = await client.platform.databases.create({
  name: 'my-db',
  description: 'Production database'
});

// Get analytics
const { data: analytics } = await client.platform.databases.analytics('db-id', {
  days: 14
});
```

## vs Self-Hosted

| Feature | Kuratchi Cloud | Self-Hosted |
|---------|---------------|-------------|
| API Keys | 1 (Kuratchi) | Multiple (Cloudflare, Resend, etc.) |
| Infrastructure | Managed by us | You manage |
| Scaling | Automatic | Manual |
| Billing | Single invoice | Multiple bills |
| Setup Time | < 5 minutes | Hours/days |
| Maintenance | Zero | Ongoing |

## Pricing

Visit [kuratchi.dev/pricing](https://kuratchi.dev/pricing) for current pricing.

## Migration from Self-Hosted

```typescript
// Before (self-hosted)
import { database } from 'kuratchi-sdk';

const { orm } = await database.connect({
  databaseName: 'my-db',
  dbToken: process.env.CLOUDFLARE_DB_TOKEN,
  gatewayKey: process.env.CLOUDFLARE_GATEWAY_KEY,
  schema
});

// After (Kuratchi Cloud)
import { cloud } from 'kuratchi-sdk';

const client = new cloud.Client({
  apiKey: process.env.KURATCHI_API_KEY,
  databaseId: process.env.DATABASE_ID,
  schema
});

const { orm } = client;  // Same ORM interface!
```

## Support

- Documentation: [docs.kuratchi.dev](https://docs.kuratchi.dev)
- Discord: [discord.gg/kuratchi](https://discord.gg/kuratchi)
- Email: support@kuratchi.dev
