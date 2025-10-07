# V1 (Legacy) vs V2 (Plugin) API

## Overview

Kuratchi SDK maintains **two API styles** for backward compatibility:

- **V1 Legacy API** - Monolithic `auth.handle()` and `database.admin()` with built-in defaults
- **V2 Plugin API** - Modular plugins with explicit configuration (recommended)

## Schema Strategy

### V1 Legacy API (Uses Example Schemas as Defaults)

The v1 API is **backward compatible** and uses example schemas as internal defaults:

**Files:**
- `src/lib/auth/handle.ts` - Legacy handle creator
- `src/lib/auth/kuratchi-auth.ts` - Legacy `KuratchiAuth` class
- `src/lib/database/index.ts` - Legacy `database.admin()` helper

**Behavior:**
```typescript
import { auth } from 'kuratchi-sdk';

// Works without explicit schema (uses admin.example.ts internally)
export const handle = auth.handle();

// Works without explicit schema (uses admin.example.ts internally)
const admin = await database.admin();
```

**Why:** Backward compatibility. Existing users don't break when upgrading.

### V2 Plugin API (Requires Explicit Schemas)

The v2 plugin API **requires explicit schemas** - no defaults:

**Files:**
- `src/lib/auth/plugins/admin.ts` - Requires `adminSchema`
- `src/lib/auth/plugins/organization.ts` - Requires `organizationSchema`

**Behavior:**
```typescript
import { kuratchi } from 'kuratchi-sdk';
import { adminPlugin, organizationPlugin } from 'kuratchi-sdk/auth';
import { adminSchema } from '$lib/schemas/admin'; // USER provides

const app = kuratchi({
  auth: {
    plugins: [
      adminPlugin({ adminSchema }),              // REQUIRED
      organizationPlugin({ organizationSchema }) // REQUIRED
    ]
  }
});
```

**Why:** Explicit is better than implicit. Users know exactly what schema is being used.

## What About `kuratchi-auth.ts`?

Yes, it's still exported for **backward compatibility**:

```typescript
// src/lib/index.ts
export { auth } from './auth/kuratchi-auth.js'; // V1 legacy API
```

**Usage:**
```typescript
// OLD WAY (v1 - still works)
import { auth } from 'kuratchi-sdk';

const authInstance = auth.instance();
await authInstance.signIn.magicLink.send('user@example.com');
```

**Recommendation:** Migrate to v2 plugin API for new projects.

## Import Paths After Refactoring

### Example Schemas (Reference Only)
```typescript
// These are ONLY used by legacy v1 API internally
import { adminSchemaDsl } from '../schema/admin.example.js';
import { organizationSchemaDsl } from '../schema/organization.example.js';
```

### User Schemas (Custom)
```typescript
// Users create these in their own app
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';
```

## Migration Path

### Current Users (v1)
```typescript
// Still works - no breaking changes
import { auth, database } from 'kuratchi-sdk';

export const handle = auth.handle();
const admin = await database.admin();
```

### New Projects (v2 Recommended)
```typescript
import { kuratchi } from 'kuratchi-sdk';
import { sessionPlugin, adminPlugin, organizationPlugin } from 'kuratchi-sdk/auth';
import { adminSchema, organizationSchema } from '$lib/schemas';

export const handle = kuratchi({
  auth: {
    plugins: [
      sessionPlugin(),
      adminPlugin({ adminSchema }),
      organizationPlugin({ organizationSchema })
    ]
  }
}).handle;
```

## Files Fixed

Updated to import from `.example.js`:

1. ✅ `src/lib/auth/handle.ts` - Legacy v1 handle
2. ✅ `src/lib/auth/kuratchi-auth.ts` - Legacy v1 API
3. ✅ `src/lib/database/index.ts` - Legacy `database.admin()` helper
4. ✅ `src/tests/do.live.deploy.test.ts` - Test using example schema

## Key Takeaways

| Feature | V1 Legacy API | V2 Plugin API |
|---------|---------------|---------------|
| **Schema Config** | Optional (uses examples) | **Required** (explicit) |
| **Import Style** | `import { auth }` | `import { adminPlugin }` |
| **Configuration** | Monolithic | Modular plugins |
| **Recommended** | ❌ Legacy support only | ✅ New projects |
| **Breaking Changes** | None (backward compatible) | Migration required |

## Decision Summary

✅ **Keep v1 working** with example schemas as internal defaults  
✅ **Force v2 to be explicit** - no magic, no surprises  
✅ **Clear migration path** - users can upgrade when ready  
✅ **No breaking changes** - existing code still works
