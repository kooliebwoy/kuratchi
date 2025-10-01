---
layout: docs
---

# Email Authentication (Magic Links)

Passwordless authentication using magic links sent via email.

## Quick Setup

```typescript
import { createAuthHandle, sessionPlugin, emailAuthPlugin } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    emailAuthPlugin({
      provider: 'resend',
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM
    })
  ]
});
```

## Features

- 🔗 Passwordless authentication
- ✉️ Built-in Resend support
- 🔒 Secure token generation
- ⏱️ Configurable expiration
- 🎨 Custom email templates

## Environment Variables

```bash
EMAIL_FROM=noreply@example.com
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

## API Routes

### Send Magic Link
```typescript
POST /auth/magic/send
Body: { email: "user@example.com" }
```

### Verify Link
```typescript
GET /auth/magic/verify?token=xxx
```

[View complete example →](/docs/auth/examples/simple)
