---
layout: docs
---

# Environment Variables

Configure your authentication setup with the appropriate environment variables.

## Core Variables

Required for all authentication scenarios:

```bash
# Session encryption (REQUIRED)
KURATCHI_AUTH_SECRET=your-secret-key-min-32-chars
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

## Auth Provider Variables

### Email Authentication (Magic Links)

```bash
EMAIL_FROM=noreply@example.com
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

Get your Resend API key from [resend.com](https://resend.com)

### OAuth Providers

```bash
# Your application URL
ORIGIN=https://app.example.com

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx

# GitHub OAuth
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxx

# Microsoft OAuth
MICROSOFT_CLIENT_ID=xxxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxx
```

## Multi-tenant Variables

Only needed if using admin/organization plugins:

```bash
# Admin database configuration
KURATCHI_ADMIN_DB_NAME=kuratchi-admin
KURATCHI_ADMIN_DB_TOKEN=token-from-cli-admin-create
KURATCHI_GATEWAY_KEY=your-gateway-key

# Cloudflare configuration
CLOUDFLARE_WORKERS_SUBDOMAIN=your-subdomain
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

## Security Best Practices

- ✅ Never commit `.env` files to version control
- ✅ Use different secrets for dev/staging/production
- ✅ Rotate secrets regularly
- ✅ Use strong, random values (min 32 characters)
