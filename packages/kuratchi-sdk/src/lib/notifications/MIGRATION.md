# Migration Guide: Notifications Configuration

## Overview

The notifications module now follows the same configuration pattern as other Kuratchi SDK modules (email, Stripe, etc.). Instead of calling a separate `initNotifications()` function, you configure notifications directly in your `kuratchi()` config.

## Before (Old Pattern - Deprecated)

```typescript
import { kuratchi } from 'kuratchi-sdk';
import { initNotifications } from 'kuratchi-sdk/notifications';

// Old way - separate initialization
const app = kuratchi({
  auth: { /* ... */ },
  email: { /* ... */ },
  stripe: { /* ... */ },
});

// Separate init call (deprecated)
initNotifications({
  resendApiKey: process.env.RESEND_API_KEY,
  resendFrom: 'noreply@yourdomain.com',
  systemEmail: 'admin@yourdomain.com',
  enableMonitoring: true,
});

export const handle = app.handle;
```

## After (New Pattern - Recommended)

```typescript
import { kuratchi } from 'kuratchi-sdk';

// New way - unified configuration
export const { handle } = kuratchi({
  auth: { /* ... */ },
  email: { /* ... */ },
  stripe: { /* ... */ },
  
  // Add notifications config alongside other modules
  notifications: {
    resendApiKey: process.env.RESEND_API_KEY,
    resendFrom: 'noreply@yourdomain.com',
    systemEmail: 'admin@yourdomain.com',
    enableMonitoring: true,
  },
});
```

## Migration Steps

### Step 1: Move Configuration

Move your `initNotifications()` call into the `kuratchi()` config:

**Before:**
```typescript
const app = kuratchi({ /* ... */ });
initNotifications({ /* config */ });
```

**After:**
```typescript
const app = kuratchi({
  // ... other config
  notifications: { /* config */ },
});
```

### Step 2: Remove Import (Optional)

Remove the `initNotifications` import if you're no longer using it:

```typescript
// Remove this line
import { initNotifications } from 'kuratchi-sdk/notifications';
```

Keep other notification function imports as needed:

```typescript
// Keep these - they still work the same way
import { 
  sendNotification,
  getUserNotifications,
  checkExcessiveDatabaseCreation,
  // etc.
} from 'kuratchi-sdk/notifications';
```

### Step 3: No API Changes

All notification functions work exactly the same way. Only the initialization changed:

```typescript
// These all still work the same ✅
await sendNotification(event, { /* ... */ });
await getUserNotifications(event, { /* ... */ });
await checkExcessiveDatabaseCreation(event, userId);
```

## Complete Example

Here's a full `hooks.server.ts` with notifications properly configured:

```typescript
import {
  sessionPlugin,
  adminPlugin,
  organizationPlugin,
  credentialsPlugin,
  oauthPlugin,
} from 'kuratchi-sdk/auth';
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';
import { kuratchi } from 'kuratchi-sdk';
import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const { handle }: { handle: Handle } = kuratchi({
  // Authentication
  auth: {
    plugins: [
      sessionPlugin(),
      adminPlugin({ adminSchema, organizationSchema }),
      organizationPlugin({ organizationSchema }),
      credentialsPlugin(),
      oauthPlugin({
        providers: [
          {
            name: 'google',
            clientId: env.GOOGLE_CLIENT_ID || '',
            clientSecret: env.GOOGLE_CLIENT_SECRET || ''
          }
        ]
      }),
    ]
  },

  // Email (existing module)
  email: {
    apiKey: env.RESEND_API_KEY,
    from: env.RESEND_FROM_EMAIL,
    fromName: 'Your App',
    trackEmails: true,
  },

  // Storage
  storage: {
    kv: { default: 'KV' },
    r2: { default: 'BUCKET' }
  },

  // Stripe (existing module)
  stripe: {
    apiKey: env.STRIPE_SECRET_KEY,
    trackEvents: true,
  },

  // Notifications (NEW MODULE - same pattern!)
  notifications: {
    // Resend for user emails
    resendApiKey: env.RESEND_API_KEY,
    resendFrom: env.RESEND_FROM_EMAIL,
    resendFromName: 'Your App',

    // Cloudflare Email for system emails
    cloudflareEmail: {
      from: 'system@yourdomain.com',
    },

    // Platform monitoring
    systemEmail: env.ADMIN_EMAIL || 'admin@yourdomain.com',
    enableMonitoring: true,
    monitoringThresholds: {
      maxDatabasesPerHour: 10,
      maxSignupsPerMinute: 5,
    },

    // Features
    enableInApp: true,
    enableEmail: true,
    enableQueue: true,

    // Storage
    storageDb: 'admin',
    defaultExpiryDays: 30,
  },
});
```

## Why This Change?

### Consistency
All Kuratchi SDK modules now use the same configuration pattern:
- ✅ `email: { ... }`
- ✅ `stripe: { ... }`
- ✅ `notifications: { ... }`
- ❌ ~~`initNotifications({ ... })`~~ (old way)

### Simplicity
One configuration object instead of multiple initialization calls:
```typescript
// One config to rule them all
kuratchi({
  auth: { ... },
  email: { ... },
  stripe: { ... },
  notifications: { ... },
})
```

### Type Safety
Better TypeScript autocomplete and type checking when everything is in one config object.

## Backward Compatibility

The old `initNotifications()` function still works but is deprecated. It will log a warning:

```typescript
// This still works but shows a deprecation warning
initNotifications({ /* config */ });
// Warning: initNotifications() is deprecated. Configure via kuratchi({ notifications: {...} }) instead.
```

**Recommendation:** Migrate to the new pattern to avoid deprecation warnings and follow best practices.

## Breaking Changes

None! This is a non-breaking change. The old pattern still works, but the new pattern is recommended.

## Questions?

- See [README.md](./README.md) for full documentation
- See [QUICKSTART.md](./QUICKSTART.md) for quick setup guide
- See [examples/hooks.server.with-notifications.ts](../../examples/hooks.server.with-notifications.ts) for complete example

## Summary

| Aspect | Old Pattern | New Pattern |
|--------|-------------|-------------|
| Configuration | Separate `initNotifications()` | In `kuratchi({ notifications: {} })` |
| Consistency | ❌ Different from other modules | ✅ Same as email, Stripe, etc. |
| Code Location | Two places (config + init call) | One place (config only) |
| API Functions | Same | Same |
| Breaking Changes | N/A | None |

**Bottom line:** Just move your config from `initNotifications()` into `kuratchi({ notifications: {} })` and you're done! 🎉