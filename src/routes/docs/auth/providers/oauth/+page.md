---
layout: docs
---

# OAuth Authentication

Social authentication with Google, GitHub, Microsoft, and custom providers.

## Quick Setup

```typescript
import { createAuthHandle, sessionPlugin, oauthPlugin } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    oauthPlugin({
      providers: {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET
        },
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET
        }
      }
    })
  ]
});
```

## Features

- �� Multi-provider support
- 🔌 Custom provider support
- 🔒 Secure state signing
- 👤 Automatic user creation
- 🔗 Account linking

## Environment Variables

```bash
ORIGIN=https://app.example.com
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
```

## API Routes

Each provider gets two routes:

```typescript
GET /auth/oauth/{provider}        // Start OAuth flow
GET /auth/oauth/{provider}/callback  // Handle callback
```

[View complete example →](/docs/auth/examples/simple)
