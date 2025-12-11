---
title: Introduction
description: Get started with the Kuratchi SDK for SvelteKit.
---

Kuratchi SDK provides end-to-end authentication and multi-tenant organization databases for SvelteKit applications running on Cloudflare Workers.

## Installation

```bash
npm install kuratchi-sdk
```

## Environment Variables

Add these to your `.env` file:

```bash
# Auth
KURATCHI_AUTH_SECRET=your-long-random-secret

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
KURATCHI_GATEWAY_KEY=your-gateway-key

# Optional: OAuth providers
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

## Next Steps

Once installed, head to [Hooks Setup](/getting-started/hooks/) to configure the SDK in your SvelteKit app.
