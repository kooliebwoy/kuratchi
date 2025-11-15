# Deploy Kuratchi Spaces

## Quick Deploy (3 Steps)

### 1. Create .env file

```bash
cp .env.example .env
```

### 2. Edit .env with your credentials

```bash
code .env
```

Add your values:
```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token  
KURATCHI_GATEWAY_KEY=your-gateway-key
```

### 3. Deploy

```bash
pnpm deploy:spaces
```

## Where to Find Credentials

**CLOUDFLARE_ACCOUNT_ID:**
- https://dash.cloudflare.com → Workers & Pages → (right sidebar)

**CLOUDFLARE_API_TOKEN:**
- https://dash.cloudflare.com/profile/api-tokens
- Create Token → "Edit Cloudflare Workers" template

**KURATCHI_GATEWAY_KEY:**
- Generate: `openssl rand -hex 32`
- Or use your existing Kuratchi key

## After Deployment

You'll see:
```
✨ Deployment successful!
📍 Worker URL: https://kuratchi-spaces.your-subdomain.workers.dev
```

Add the URL to your `.env`:
```bash
echo "KURATCHI_SPACES_WORKER_URL=https://kuratchi-spaces.your-subdomain.workers.dev" >> .env
```

## Using in Your Apps

Copy `.env` to your apps or add the values manually:

```bash
# apps/chat/.env
KURATCHI_GATEWAY_KEY=your-key
KURATCHI_SPACES_WORKER_URL=https://kuratchi-spaces.your-subdomain.workers.dev
```

That's it! See [Integration Guide](./KURATCHI_SPACES_INTEGRATION.md) for usage.
