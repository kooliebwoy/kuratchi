# Database Token Management

## The Token Expiration Problem (FIXED)

### Previous Issue ❌

Database tokens expired after 30 days by default. This created a **critical deadlock** for the admin database:

1. Admin DB token expires after 30 days
2. To refresh ANY token, you need access to the admin DB
3. But you can't access admin DB if its token is expired
4. **Circular dependency = locked out!**

### Solution ✅

**v2.x.x and later** implements multiple fixes:

## 1. Intelligent Token TTL

Tokens now have different lifespans based on their role:

```typescript
// Admin DB: 100-year TTL (essentially permanent)
const isAdminDb = databaseName.includes('admin');
const ttl = isAdminDb 
  ? 100 * 365 * 24 * 60 * 60 * 1000  // 100 years
  : 365 * 24 * 60 * 60 * 1000;       // 1 year (renewable)
```

**Why 100 years for admin?**
- Prevents the circular dependency deadlock
- Admin DB is the root of trust
- If compromised, use CLI to regenerate (see below)

**Why 1 year for organization DBs?**
- Long enough to avoid frequent rotation
- Can be refreshed via admin DB methods
- Balance between security and convenience

## 2. CLI Token Refresh

If your admin token expires or is compromised, regenerate it:

```bash
# Regenerate admin DB token
npx kuratchi-sdk refresh-admin-token

# With custom name
npx kuratchi-sdk refresh-admin-token --name my-admin-db

# Output:
{
  "ok": true,
  "databaseName": "kuratchi-admin",
  "token": "kuratchi-admin.abc123...xyz789",
  "message": "Update KURATCHI_ADMIN_DB_TOKEN in your environment with this new token"
}
```

**Required:**
- `KURATCHI_GATEWAY_KEY` (or `--gatewayKey`) - Your DO gateway key
- `KURATCHI_ADMIN_DB_NAME` (optional, defaults to `kuratchi-admin`)

**Important:** After running this command, update your `KURATCHI_ADMIN_DB_TOKEN` environment variable with the new token.

## 3. Programmatic Token Refresh

For organization databases, use the admin plugin method:

```typescript
// In a SvelteKit route
export const actions = {
  refreshToken: async ({ locals, request }) => {
    const data = await request.formData();
    const orgId = data.get('organizationId');
    
    // Refresh organization database token
    const result = await locals.kuratchi.admin.refreshDatabaseToken(orgId);
    
    return { success: true, result };
  }
};
```

**API:**
```typescript
await locals.kuratchi.admin.refreshDatabaseToken(organizationId: string): Promise<{
  success: boolean;
  databaseName: string;
  organizationId: string;
}>
```

## 4. Token Inspection

Check token expiration without making a request:

```typescript
// Token format: dbName.random.expirationTimestamp.signature
const token = 'my-db.abc123.1234567890.xyz789';
const parts = token.split('.');
const expirationMs = Number(parts[2]);
const expirationDate = new Date(expirationMs);

console.log(`Token expires: ${expirationDate.toISOString()}`);
console.log(`Days until expiration: ${(expirationMs - Date.now()) / (1000 * 60 * 60 * 24)}`);
```

## 5. Proactive Token Rotation

Set up automated rotation for organization databases:

```typescript
// Cron job or scheduled task
import { createSignedDbToken } from 'kuratchi-sdk/utils/token';

async function rotateExpiringTokens() {
  const adminDb = await getAdminDb();
  const gatewayKey = process.env.KURATCHI_GATEWAY_KEY;
  
  // Get all organization databases
  const { data: databases } = await adminDb.databases
    .where({ deleted_at: { is: null } })
    .many();
  
  const sevenDaysFromNow = Date.now() + (7 * 24 * 60 * 60 * 1000);
  const rotated = [];
  
  for (const db of databases ?? []) {
    // Parse token expiration
    const parts = db.db_token.split('.');
    const exp = Number(parts[2]);
    
    // Rotate if expiring within 7 days
    if (exp < sevenDaysFromNow) {
      const newToken = await createSignedDbToken(
        db.database_name, 
        gatewayKey,
        365 * 24 * 60 * 60 * 1000 // 1 year
      );
      
      await adminDb.databases
        .where({ id: db.id })
        .update({ db_token: newToken });
      
      rotated.push(db.database_name);
    }
  }
  
  return { rotated };
}
```

## Best Practices

### ✅ DO

1. **Secure your gateway key** - It can regenerate admin tokens
2. **Monitor expiration** - Set up alerts for tokens expiring within 30 days
3. **Use environment secrets** - Never hardcode tokens
4. **Rotate on compromise** - If a token is compromised, regenerate immediately
5. **Test rotation** - Verify token refresh works in staging first

### ❌ DON'T

1. **Don't commit tokens** - Add to `.gitignore`
2. **Don't share tokens** - Each environment should have its own
3. **Don't ignore warnings** - Token expiration errors need immediate action
4. **Don't use short TTLs** - Causes unnecessary rotation burden
5. **Don't skip backups** - Always backup gateway key securely

## Token Security

### Gateway Key Protection

The gateway key is the root of trust:
- Can create/validate ALL database tokens
- Should be rotated if compromised
- Store in secrets manager (not `.env` in production)

```bash
# Development
KURATCHI_GATEWAY_KEY=dev-key-12345

# Production (use secrets manager)
# AWS Secrets Manager, Cloudflare Workers secrets, etc.
```

### Token Hierarchy

```
Gateway Key (root)
  └─ Admin DB Token (100 years)
      └─ Organization DB Tokens (1 year, renewable)
```

## Migration Guide

### From v1 (30-day tokens)

If you have existing deployments with 30-day tokens:

1. **Check expiration:**
   ```typescript
   const token = process.env.KURATCHI_ADMIN_DB_TOKEN;
   const exp = Number(token.split('.')[2]);
   const daysLeft = (exp - Date.now()) / (1000 * 60 * 60 * 24);
   console.log(`Admin token expires in ${daysLeft} days`);
   ```

2. **Regenerate before expiration:**
   ```bash
   npx kuratchi-sdk refresh-admin-token
   ```

3. **Update environment:**
   ```bash
   # Update .env or secrets manager
   KURATCHI_ADMIN_DB_TOKEN=new-token-here
   ```

4. **Redeploy application** with new token

5. **Verify:**
   ```bash
   # Should succeed with new token
   curl -X POST https://your-app.workers.dev/api/admin/test
   ```

## Troubleshooting

### "Token expired" Error

```json
{ "error": "Token expired" }
```

**Solution:**
```bash
# For admin DB
npx kuratchi-sdk refresh-admin-token

# For organization DB (via API)
POST /api/admin/refresh-token
{ "organizationId": "org-123" }
```

### "Token db mismatch" Error

Token is for a different database than requested.

**Solution:** Regenerate token for the correct database name.

### "Bad signature" Error

Gateway key doesn't match the one used to create the token.

**Solution:** Verify `KURATCHI_GATEWAY_KEY` matches the key used during `init-admin-db`.

## Summary

| Database Type | Token TTL | Renewable Via | Use Case |
|---------------|-----------|---------------|----------|
| **Admin DB** | 100 years | CLI only (`refresh-admin-token`) | Root database |
| **Organization DB** | 1 year | Admin plugin (`refreshDatabaseToken`) | Tenant databases |
| **Custom DB** | 1 year | Manual regeneration | One-off databases |

The token expiration deadlock is **permanently solved** for admin databases, while organization databases have a reasonable 1-year TTL that can be refreshed programmatically.
