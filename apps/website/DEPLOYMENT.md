# Deploying Kuratchi Website to Cloudflare

## Prerequisites

- Cloudflare account
- GitHub/GitLab repository connected
- Account ID: `290c1a3b978d0f44f83b515983a1c951`

## Cloudflare Dashboard Setup (Monorepo)

### 1. Create a New Worker/Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages**
3. Click **Create Application** → **Pages** → **Connect to Git**
4. Select your `kuratchi-sdk` repository

### 2. Configure Monorepo Settings

**Important:** For monorepos, configure these settings:

#### Build Configuration
- **Framework preset**: None
- **Build command**: `pnpm run build`
- **Build output directory**: `.svelte-kit/cloudflare`
- **Root directory**: `/apps/website` ⚠️ **Critical for monorepo**

#### Environment Variables
None required for the landing page.

### 3. Build Watch Paths (Optional)

To optimize builds and only deploy when website changes:
- `apps/website/**`
- `packages/kuratchi-ui/**` (since website depends on UI package)

This prevents unnecessary deploys when dashboard or other apps change.

## Deploy via CLI (Alternative)

From the website directory:

```bash
cd apps/website

# First deployment
pnpm run build
npx wrangler pages deploy .svelte-kit/cloudflare --project-name=kuratchi-website

# Subsequent deployments
pnpm run build && npx wrangler pages deploy .svelte-kit/cloudflare --project-name=kuratchi-website
```

## Custom Domain

The website is configured for: `kuratchi.clutchcms.com`

### Setup Custom Domain:
1. In Cloudflare Dashboard → Workers & Pages → kuratchi-website
2. Go to **Custom Domains**
3. Add `kuratchi.clutchcms.com`
4. Update DNS records as instructed

## Deployment Checklist

- [x] `wrangler.jsonc` configured with correct settings
- [x] `.cfignore` created to exclude unnecessary files
- [x] Build command uses `pnpm` (monorepo package manager)
- [x] Root directory set to `/apps/website` for monorepo
- [ ] Connect repository in Cloudflare Dashboard
- [ ] Set root directory in project settings
- [ ] Configure build watch paths
- [ ] Deploy and test
- [ ] Set up custom domain

## Monorepo Notes

**Why Root Directory Matters:**
- Cloudflare needs to know where to run commands (`/apps/website`)
- Build and deploy commands execute from this root directory
- `wrangler.jsonc` location indicates the app to deploy

**Build Watch Paths:**
- Prevents unnecessary builds when other apps (dashboard, etc.) change
- Only triggers deployment when website or its dependencies change
- Saves build minutes and speeds up deployments

## Production URL

After deployment:
- **Production**: `https://kuratchi-website.pages.dev`
- **Custom Domain**: `https://kuratchi.clutchcms.com`

## Troubleshooting

### Build fails with "command not found"
- Ensure Node.js 18+ is set in Cloudflare project settings
- Verify pnpm is being used (Cloudflare auto-detects from pnpm-lock.yaml)

### Wrong app deploys
- Double-check **Root directory** is set to `/apps/website`
- Verify `wrangler.jsonc` exists in the app directory

### Assets not loading
- Check `assets.directory` in `wrangler.jsonc` points to `.svelte-kit/cloudflare`
- Verify build output directory matches

### Changes not triggering deployment
- Check build watch paths include `apps/website/**`
- Verify Git integration is active
