---
layout: docs
---

# Credentials Authentication

Email/password authentication with rate limiting and security features.

## Quick Setup

```typescript
import { createAuthHandle, sessionPlugin, credentialsPlugin } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    credentialsPlugin({
      hashPassword: async (password) => {
        // Use your preferred hashing (bcrypt, argon2, etc.)
        return await hash(password);
      },
      verifyPassword: async (password, hash) => {
        return await verify(hash, password);
      }
    })
  ]
});
```

## Features

- 🔑 Email/password authentication
- 🔒 Secure password verification
- 🛡️ Rate limiting (requires KV)
- 🚫 Account lockout protection
- 📊 Login attempt tracking

## Environment Variables

No additional environment variables required. Configure via `wrangler.toml` if using rate limiting:

```toml
[[kv_namespaces]]
binding = "KV"
id = "your-kv-id"
```

## API Routes

```typescript
POST /auth/credentials/login   // Sign in
POST /auth/credentials/logout  // Sign out
```

[View complete example →](/docs/auth/examples/simple)
