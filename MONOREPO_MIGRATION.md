# Kuratchi Monorepo Migration Guide

## Overview
This repo is now a Turborepo monorepo, structured for building a Supabase-like platform for SvelteKit + Cloudflare Workers.

## Structure
```
kuratchi/
├── apps/
│   ├── docs/              # Landing page + documentation (SvelteKit)
│   ├── dashboard/         # Admin dashboard (future)
│   └── examples/
│       ├── basic-auth/    # Basic auth example
│       └── multi-tenant/  # Multi-tenant SaaS example
├── packages/
│   ├── kuratchi-sdk/      # Core SDK package
│   ├── cli/               # CLI tool (future)
│   ├── config-typescript/ # Shared TypeScript configs
│   └── config-eslint/     # Shared ESLint configs
├── turbo.json             # Turborepo config
├── package.json           # Root workspace config
└── pnpm-workspace.yaml    # pnpm workspace config
```

## Migration Steps

### 1. Install pnpm (if not already installed)
```bash
npm install -g pnpm
```

### 2. Move current SDK to packages/kuratchi-sdk
```bash
# Create packages directory
mkdir -p packages

# Move current files to packages/kuratchi-sdk
mkdir -p packages/kuratchi-sdk
mv src packages/kuratchi-sdk/
mv bin packages/kuratchi-sdk/
mv static packages/kuratchi-sdk/
mv svelte.config.js packages/kuratchi-sdk/
mv vite.config.ts packages/kuratchi-sdk/
mv tsconfig.json packages/kuratchi-sdk/
mv .npmrc packages/kuratchi-sdk/
mv *.md packages/kuratchi-sdk/ # Keep docs with SDK

# Update package.json for kuratchi-sdk
mv package.json packages/kuratchi-sdk/package.json
mv package-lock.json packages/kuratchi-sdk/package-lock.json

# Use new root package.json
mv package.json.new package.json
```

### 3. Install dependencies
```bash
# Install root dependencies
pnpm install

# Build everything
pnpm build
```

### 4. Development
```bash
# Run all dev servers in parallel
pnpm dev

# Run specific package
pnpm --filter kuratchi-sdk dev

# Build specific package
pnpm --filter kuratchi-sdk build

# Test everything
pnpm test
```

## Next Steps

### Create Example Apps
```bash
# Create basic auth example
pnpm create svelte@latest apps/examples/basic-auth
cd apps/examples/basic-auth
pnpm add kuratchi-sdk@workspace:*
```

### Create Documentation Site
```bash
# Create docs site
pnpm create svelte@latest apps/docs
cd apps/docs
# Set up documentation with your preferred tool (MDsveX, Markdoc, etc.)
```

### Future Packages
- `packages/cli` - CLI tool for database management
- `packages/migrations` - Shared migration utilities
- `packages/types` - Shared TypeScript types
- `packages/ui` - Shared UI components (for dashboard/docs)

## Benefits

✅ **Monorepo Benefits:**
- Shared dependencies and configs
- Atomic commits across packages
- Easier to test SDK changes with examples
- Better DX with Turbo caching
- Easier to onboard contributors

✅ **For Supabase-like Platform:**
- SDK, CLI, and dashboard in one repo
- Examples show real usage patterns
- Documentation stays in sync
- Faster iteration cycles

## Publishing

### Using Changesets (Recommended)
```bash
# Add a changeset
pnpm changeset

# Version packages
pnpm changeset version

# Publish
pnpm changeset publish
```

### Manual Publishing
```bash
cd packages/kuratchi-sdk
pnpm version patch
pnpm publish
```

## Troubleshooting

### Clean Install
```bash
pnpm clean
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Build Issues
```bash
# Clean Turbo cache
rm -rf .turbo

# Rebuild everything
pnpm build
```
