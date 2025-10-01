---
layout: docs
---

# Schema Definition

Define your database structure using Kuratchi's schema DSL (Domain Specific Language).

## Schema Structure

```typescript
import type { SchemaDsl } from 'kuratchi-sdk';

const schema: SchemaDsl = {
  name: 'my-app',
  version: 1,
  tables: {
    users: {
      id: 'text primary key not null',
      email: 'text not null unique',
      name: 'text',
      active: 'boolean default 1',
      createdAt: 'timestamp_ms default now'
    }
  }
};
```

## Column Definition Format

Columns use a shorthand string format:

```
'<type> [constraints...]'
```

### Basic Examples

```typescript
{
  id: 'text primary key',
  email: 'text not null unique',
  name: 'text',
  age: 'integer',
  balance: 'real',
  avatar: 'blob',
  settings: 'json'
}
```

## Column Types

- `text` - Strings
- `integer` - Whole numbers
- `real` - Floating point numbers
- `blob` - Binary data
- `json` - JSON objects (auto-serialized)
- `boolean` - 0 or 1 (stored as integer)
- `timestamp_ms` - Millisecond timestamps (stored as integer)

## Constraints

### Primary Key

```typescript
id: 'text primary key'
id: 'integer primary key not null'
```

### Not Null

```typescript
email: 'text not null'
name: 'text not null unique'
```

### Unique

```typescript
email: 'text unique'
slug: 'text not null unique'
```

### Default Values

```typescript
status: 'text default active'
count: 'integer default 0'
active: 'boolean default 1'
createdAt: 'timestamp_ms default now'
data: 'json default (json_object())'
```

### Enum

```typescript
role: 'enum(user,admin,moderator)'
status: 'enum(active,inactive,pending)'
```

## Foreign Keys

Use the `->` syntax:

```typescript
{
  // Basic foreign key
  userId: 'text -> users.id',
  
  // With cascade delete
  userId: 'text -> users.id cascade',
  
  // With not null
  userId: 'text not null -> users.id cascade',
  
  // With other constraints
  organizationId: 'text -> organizations.id'
}
```

## Mixins (Reusable Fields)

Define common field sets to reuse across tables:

```typescript
const schema: SchemaDsl = {
  name: 'my-app',
  version: 1,
  mixins: {
    timestamps: {
      created_at: 'text default now',
      updated_at: 'text default now',
      deleted_at: 'text'
    },
    softDelete: {
      deleted: 'boolean default 0',
      deletedAt: 'timestamp_ms'
    }
  },
  tables: {
    users: {
      id: 'text primary key',
      email: 'text not null unique',
      '...timestamps': true  // Spreads timestamp fields
    },
    posts: {
      id: 'text primary key',
      title: 'text not null',
      '...timestamps': true,
      '...softDelete': true  // Can use multiple mixins
    }
  }
};
```

## Complete Example

```typescript
const schema: SchemaDsl = {
  name: 'blog',
  version: 1,
  mixins: {
    timestamps: {
      created_at: 'text default now',
      updated_at: 'text default now',
      deleted_at: 'text'
    }
  },
  tables: {
    users: {
      id: 'text primary key not null',
      email: 'text not null unique',
      name: 'text',
      firstName: 'text',
      lastName: 'text',
      phone: 'text',
      emailVerified: 'timestamp_ms',
      image: 'text',
      role: 'enum(user,admin,editor)',
      password_hash: 'text',
      active: 'boolean default 1',
      '...timestamps': true
    },
    posts: {
      id: 'text primary key not null',
      userId: 'text not null -> users.id cascade',
      title: 'text not null',
      content: 'text',
      slug: 'text unique',
      published: 'boolean default 0',
      publishedAt: 'timestamp_ms',
      views: 'integer default 0',
      metadata: 'json default (json_object())',
      '...timestamps': true
    },
    comments: {
      id: 'text primary key not null',
      postId: 'text not null -> posts.id cascade',
      userId: 'text not null -> users.id cascade',
      content: 'text not null',
      approved: 'boolean default 0',
      '...timestamps': true
    },
    sessions: {
      sessionToken: 'text primary key not null',
      userId: 'text not null -> users.id cascade',
      expires: 'timestamp_ms not null',
      '...timestamps': true
    }
  }
};
```

## Real-World Example (Admin Schema)

```typescript
const adminSchema: SchemaDsl = {
  name: 'admin',
  version: 1,
  mixins: {
    timestamps: {
      updated_at: 'text default now',
      created_at: 'text default now',
      deleted_at: 'text'
    }
  },
  tables: {
    users: {
      id: 'text primary key not null',
      email: 'text not null unique',
      name: 'text',
      role: 'enum(superadmin,owner,editor,member)',
      password_hash: 'text',
      emailVerified: 'timestamp_ms',
      status: 'boolean',
      '...timestamps': true
    },
    organizations: {
      id: 'text primary key not null',
      organizationName: 'text',
      email: 'text unique',
      organizationSlug: 'text unique',
      stripeCustomerId: 'text',
      status: 'enum(active,inactive,lead)',
      '...timestamps': true
    },
    oauthAccounts: {
      id: 'text primary key',
      userId: 'text -> users.id cascade',
      provider: 'text not null',
      providerAccountId: 'text not null',
      access_token: 'text',
      refresh_token: 'text',
      expires_at: 'timestamp_ms',
      '...timestamps': true
    }
  }
};
```

## Best Practices

- ✅ Use `text primary key` for UUIDs/ULIDs
- ✅ Use `integer primary key` for auto-increment IDs
- ✅ Always add `not null` to required fields
- ✅ Use `timestamp_ms` for dates/times
- ✅ Use `boolean` for true/false values
- ✅ Use `enum()` for fixed value sets
- ✅ Use mixins for common field patterns
- ✅ Add `cascade` to foreign keys for automatic cleanup
- ❌ Don't use spaces in enum values
- ❌ Don't forget `not null` on foreign keys

[Next: Learn queries →](/docs/orm/queries)
