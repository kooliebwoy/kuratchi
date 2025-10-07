# Automatic Runtime Migrations

## Overview

Kuratchi SDK **automatically applies migrations at runtime** when you access admin or organization databases. This is the "batteries-included" approach - no manual migration commands needed!

## How It Works

### 1. Migration Detection (Automatic)

When you call `getAdminDb()` or `getOrgDb()`, the SDK:

1. **Detects the best adapter** (D1 direct > DO direct > HTTP)
2. **Tries to load Vite-bundled migrations** from `/migrations-{schemaName}/`
3. **Falls back to auto-generating** initial migration from schema if no migrations found
4. **Applies pending migrations** using the detected adapter
5. **Returns ORM client** with up-to-date schema

### 2. Migration Loading Priority

```typescript
// Priority order:
1. Vite-bundled migrations (from your project)
   → /migrations-admin/
   → /migrations-organization/
   
2. Fallback: Auto-generate from schema
   → Only works for initial migration (m0001)
   → Subsequent migrations MUST be Vite-bundled
```

### 3. Vite Glob Pattern

Migrations are loaded via Vite's `import.meta.glob`:

```typescript
// In src/lib/orm/loader.ts
const allSqlMigrationModules = import.meta.glob(
  '/migrations-*/*.sql',
  { query: '?raw', eager: false }
);
```

This means migrations are bundled **from your project root**, not from `node_modules`.

## Expected Directory Structure

```
your-project/
├── migrations-admin/           # Admin DB migrations
│   ├── meta/
│   │   └── _journal.json
│   ├── 0001_init.sql
│   └── 0002_add_columns.sql
│
├── migrations-organization/    # Organization DB migrations
│   ├── meta/
│   │   └── _journal.json
│   └── 0001_init.sql
│
├── src/
│   ├── lib/
│   │   └── schemas/
│   │       ├── admin.ts       # Your admin schema
│   │       └── organization.ts # Your org schema
│   └── hooks.server.ts
│
└── package.json
```

## Generating Migrations

Use the CLI to generate migrations:

```bash
# Generate admin migrations
npx kuratchi-sdk generate-migrations \
  --schema src/lib/schemas/admin.ts \
  --outDir migrations-admin

# Generate organization migrations  
npx kuratchi-sdk generate-migrations \
  --schema src/lib/schemas/organization.ts \
  --outDir migrations-organization
```

## Adapter Detection & Direct Binding Optimization

Both **migrations** and **database provisioning** use detected adapters for optimal performance:

| Environment | Adapter Used | How It Works | Optimizations |
|-------------|--------------|--------------|---------------|
| **Local SvelteKit** (`npm run dev`) | HTTP Client | Via HTTP to deployed DO | ⚠️ No bindings available |
| **Wrangler Dev** (`wrangler dev`) | D1/DO Direct | Directly on local database | ✅ No HTTP/auth needed |
| **Production Workers** | D1/DO Direct | Directly on bound resources | ✅ No HTTP/auth needed |
| **Remote/CLI** | HTTP Client | Via HTTP to DO endpoint | Falls back when no binding |

**Why this matters:**

### For Migrations
- ✅ Local development works without deploying DO
- ✅ Migrations run on the actual database (not remote proxy)
- ✅ Faster and more reliable

### For Database Provisioning (`createDatabase`)
When you have a direct DO binding (`wrangler dev` or production Workers):
- ✅ **Skips worker deployment** - No need to deploy/redeploy
- ✅ **Skips 30-second wait** - No need to wait for worker readiness
- ✅ **Instant provisioning** - Direct binding means instant access
- ✅ **No authentication overhead** - Binding provides direct access

**Important:** Local SvelteKit dev (`npm run dev`) doesn't have DO bindings, so it **always uses HTTP flow**. Use `wrangler dev` for direct binding optimization.

**Example speedup:**
```
npm run dev:       Deploy (5s) + Wait (30s) + Migrate (2s) = ~37 seconds (always)
wrangler dev:      Migrate (2s) = ~2 seconds  (18x faster!)
Production:        Migrate (2s) = ~2 seconds  (18x faster!)
```

## Runtime Behavior

### First Access (No Migrations)

```
[Kuratchi] Using D1 direct binding for admin
[Kuratchi] Applying migrations for admin (via d1)...
[Kuratchi Migrations] Loading migrations for admin...
[Kuratchi Migrations] No bundled migrations found for admin, using fallback...
[Kuratchi Migrations] ✓ Generated initial migration from schema
[Kuratchi Migrations] → Applying m0001 (init)...
[Kuratchi Migrations] ✓ Applied m0001 (init)
[Kuratchi Migrations] ✓ Applied 1 new migration(s)
[Kuratchi] ✓ Migrations applied for admin
```

### With Bundled Migrations (Local D1)

```
[Kuratchi] Using D1 direct binding for admin
[Kuratchi] Applying migrations for admin (via d1)...
[Kuratchi Migrations] Loading migrations for admin...
[Kuratchi Migrations] ✓ Loaded 3 migration(s) from /migrations-admin
[Kuratchi Migrations] ⊘ Skipping m0001 (init) - already applied
[Kuratchi Migrations] → Applying m0002 (add_stripe_fields)...
[Kuratchi Migrations] ✓ Applied m0002 (add_stripe_fields)
[Kuratchi Migrations] → Applying m0003 (add_indexes)...
[Kuratchi Migrations] ✓ Applied m0003 (add_indexes)
[Kuratchi Migrations] ✓ Applied 2 new migration(s)
[Kuratchi] ✓ Migrations applied for admin
```

### Already Up-to-Date (via HTTP)

```
[Kuratchi] Using HTTP client for organization
[Kuratchi] Applying migrations for organization (via http)...
[Kuratchi Migrations] Loading migrations for organization...
[Kuratchi Migrations] ✓ Loaded 3 migration(s) from /migrations-organization
[Kuratchi Migrations] ⊘ Skipping m0001 (init) - already applied
[Kuratchi Migrations] ⊘ Skipping m0002 (add_stripe_fields) - already applied
[Kuratchi Migrations] ⊘ Skipping m0003 (add_indexes) - already applied
[Kuratchi Migrations] ✓ All 3 migration(s) already applied
[Kuratchi] ✓ Migrations applied for organization
```

## Migration History Tracking

Migrations are tracked in a `migrations_history` table (auto-created):

```sql
CREATE TABLE migrations_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag TEXT NOT NULL UNIQUE,
  created_at INTEGER
);
```

Each applied migration is recorded to prevent re-application.

## Workflow Example

### Step 1: Generate Migrations

```bash
# After modifying src/lib/schemas/admin.ts
npx kuratchi-sdk generate-migrations \
  --schema src/lib/schemas/admin.ts \
  --outDir migrations-admin
```

**Output:**
```
✓ Generated migration: migrations-admin/0002_add_stripe_columns.sql
✓ Updated journal: migrations-admin/meta/_journal.json
```

### Step 2: Commit Migrations

```bash
git add migrations-admin/
git commit -m "Add Stripe columns to admin schema"
```

### Step 3: Deploy

```bash
# Build your app (Vite bundles migrations)
npm run build

# Deploy to Cloudflare Workers
wrangler deploy
```

### Step 4: Migrations Auto-Apply

On first request, migrations auto-apply:

```typescript
// In your route handler
export async function load({ locals }) {
  // This triggers automatic migration application
  const adminDb = await locals.kuratchi.getAdminDb();
  
  // Migrations already applied at this point!
  const orgs = await adminDb.organizations.many();
  
  return { organizations: orgs.data };
}
```

## Fallback Behavior

If no migrations are found (e.g., development, first run), the SDK auto-generates the initial migration from your schema:

```typescript
// Automatically creates tables from schema
const adminDb = await locals.kuratchi.getAdminDb();
// ✓ Admin tables created from schema
```

**Limitation:** Only the **initial migration** can be auto-generated. Subsequent migrations must be Vite-bundled.

## Troubleshooting

### "No bundled migrations found"

**Cause:** Vite isn't finding your migrations directory.

**Solution:**
1. Ensure migrations are in project root: `/migrations-admin/`, `/migrations-organization/`
2. Rebuild your app: `npm run build`
3. Check Vite is bundling migrations (look for logs)

### "Migration failed"

**Cause:** SQL syntax error or constraint violation.

**Solution:**
1. Check migration SQL in `/migrations-{name}/XXXX_tag.sql`
2. Test migration locally with D1:
   ```bash
   wrangler d1 execute DB_NAME --file=migrations-admin/0002_migration.sql
   ```
3. Fix SQL and regenerate migrations

### "Only the initial migration can be auto-generated"

**Cause:** Trying to auto-generate migration #2+ from schema.

**Solution:**
1. Generate migrations with CLI: `npx kuratchi-sdk generate-migrations`
2. Ensure migrations are Vite-bundled
3. Commit migrations to git

### Migrations applied to wrong database

**Cause:** Multiple databases with same schema name.

**Solution:**
Use unique schema names:
```typescript
// Bad - both use name "admin"
const adminSchema = { name: 'admin', ... };
const backupSchema = { name: 'admin', ... }; // ❌ Collision!

// Good - unique names
const adminSchema = { name: 'admin', ... };
const backupSchema = { name: 'admin-backup', ... }; // ✅ Unique
```

## Best Practices

### ✅ DO

1. **Generate migrations for every schema change**
   ```bash
   npm run migrate:generate
   ```

2. **Commit migrations to version control**
   ```bash
   git add migrations-*/
   ```

3. **Test migrations locally first**
   ```bash
   wrangler d1 execute LOCAL_DB --file=migrations-admin/0002_new.sql
   ```

4. **Use descriptive migration tags**
   ```bash
   --tag add_stripe_integration
   ```

5. **Keep migrations idempotent** (use `IF NOT EXISTS`, `IF NOT NULL`, etc.)

### ❌ DON'T

1. **Don't edit applied migrations** - Create new ones instead
2. **Don't delete migration files** - They're part of history
3. **Don't modify _journal.json manually** - Use CLI
4. **Don't rely on fallback for production** - Always generate migrations
5. **Don't skip testing migrations** - They run in production automatically!

## Performance Considerations

### Migration Caching

Migrations are applied **once per cold start**. Subsequent requests reuse the same ORM client.

### D1 vs DO

- **D1 Direct Binding:** Migrations applied to local D1 database
- **DO HTTP:** Migrations applied to Durable Object storage
- **Both:** Same migration system, different adapters

### Large Migrations

For migrations with thousands of rows:
1. Use `TRANSACTION` blocks
2. Batch large operations
3. Consider background jobs for data migrations

## Summary

| Feature | Status | Details |
|---------|--------|---------|
| **Auto-apply** | ✅ Enabled | Always applies pending migrations at runtime |
| **Vite bundling** | ✅ Automatic | Migrations bundled from `/migrations-*/` |
| **Fallback generation** | ✅ Initial only | Auto-generates m0001 from schema if needed |
| **History tracking** | ✅ Automatic | Prevents duplicate application |
| **CLI generation** | ✅ Required | For migrations #2+ |
| **Manual application** | ❌ Not needed | Happens automatically |

**Bottom line:** Just generate migrations with the CLI, commit them, and deploy. Migrations apply automatically! 🚀
