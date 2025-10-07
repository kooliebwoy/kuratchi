# Kuratchi

> A Supabase-like platform for SvelteKit and Cloudflare Workers

**Status:** Early Development 🚧

## What is Kuratchi?

Kuratchi is an open-source backend-as-a-service (BaaS) platform designed specifically for SvelteKit applications running on Cloudflare Workers. Think Supabase, but built from the ground up for the SvelteKit + Cloudflare ecosystem.

### Core Features

- 🔐 **Authentication** - Plugin-based auth system (credentials, OAuth, magic links, email verification)
- 🗄️ **Database** - Type-safe ORM with migrations, multi-tenancy, and D1 integration
- 🔑 **KV Storage** - Key-value store with Cloudflare KV
- 📦 **R2 Storage** - File storage with Cloudflare R2
- 🚀 **Edge-First** - Built for Cloudflare Workers from day one
- 🔌 **Plugin System** - Extensible architecture for custom functionality

## Monorepo Structure

This is a Turborepo monorepo containing:

```
kuratchi/
├── apps/
│   ├── docs/              # Documentation site
│   ├── dashboard/         # Admin dashboard (coming soon)
│   └── examples/          # Example applications
│       ├── basic-auth/    # Basic authentication example
│       └── multi-tenant/  # Multi-tenant SaaS example
├── packages/
│   ├── kuratchi-sdk/      # Core SDK package
│   ├── cli/               # CLI tool (coming soon)
│   ├── config-typescript/ # Shared TypeScript configs
│   └── config-eslint/     # Shared ESLint configs
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+
- Cloudflare account (for deployment)

### Installation

```bash
# Install pnpm if you haven't
npm install -g pnpm

# Clone the repo
git clone https://github.com/yourusername/kuratchi.git
cd kuratchi

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development
pnpm dev
```

## Using the SDK

### Install in your SvelteKit project

```bash
pnpm add kuratchi-sdk
```

### Basic Setup

```typescript
// src/hooks.server.ts
import { kuratchiHandle } from 'kuratchi-sdk/auth';
import { adminPlugin } from 'kuratchi-sdk/auth';
import { credentialsPlugin } from 'kuratchi-sdk/auth';
import { sessionPlugin } from 'kuratchi-sdk/auth';

export const handle = kuratchiHandle({
  plugins: [
    adminPlugin({
      adminDbName: process.env.KURATCHI_ADMIN_DB_NAME,
      adminDbToken: process.env.KURATCHI_ADMIN_DB_TOKEN,
      gatewayKey: process.env.KURATCHI_GATEWAY_KEY,
    }),
    sessionPlugin(),
    credentialsPlugin(),
  ],
});
```

### Authentication Example

```typescript
// +page.server.ts
export const actions = {
  login: async ({ request, locals }) => {
    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');
    
    const result = await locals.kuratchi.auth.credentials.signIn(email, password);
    
    if (!result.success) {
      return fail(401, { error: result.error });
    }
    
    throw redirect(303, '/dashboard');
  },
};
```

```svelte
<!-- +page.svelte -->
<script>
  export let data;
</script>

{#if data.session}
  <h1>Welcome, {data.session.user.email}!</h1>
  <p>Role: {data.session.user.role}</p>
{:else}
  <form method="POST" action="?/login">
    <input name="email" type="email" required />
    <input name="password" type="password" required />
    <button>Sign In</button>
  </form>
{/if}
```

## Development

### Commands

```bash
# Run all dev servers
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format

# Clean everything
pnpm clean
```

### Working on the SDK

```bash
# Navigate to SDK package
cd packages/kuratchi-sdk

# Run SDK dev mode
pnpm dev

# Build SDK
pnpm build

# Run SDK tests
pnpm test
```

### Working on Examples

```bash
# Run specific example
pnpm --filter basic-auth dev

# Build specific example
pnpm --filter basic-auth build
```

## Architecture

### Plugin System

Kuratchi uses a plugin-based architecture for extensibility:

```typescript
interface AuthPlugin {
  name: string;
  priority: number;
  onRequest?: (ctx: PluginContext) => Promise<void>;
  onSession?: (ctx: SessionContext) => Promise<void>;
}
```

Built-in plugins:
- **Admin Plugin** - Organization and database management
- **Session Plugin** - Session handling and validation
- **Credentials Plugin** - Email/password authentication
- **OAuth Plugin** - OAuth provider integration
- **Email Auth Plugin** - Magic link authentication

### Database Layer

Type-safe ORM with automatic migrations:

```typescript
import { kuratchiDatabase } from 'kuratchi-sdk/database';

const db = kuratchiDatabase(env.DB, schema);

// Type-safe queries
const users = await db.users.where({ email: 'user@example.com' }).all();

// Automatic migrations
await db.applyMigrations();
```

## Roadmap

### Phase 1: Core Platform (Current)
- [x] Authentication system
- [x] Database ORM
- [x] Multi-tenancy
- [x] Plugin architecture
- [ ] Complete documentation
- [ ] Example applications

### Phase 2: Developer Experience
- [ ] CLI tool for database management
- [ ] Admin dashboard
- [ ] Studio (database browser)
- [ ] Migration tooling
- [ ] Testing utilities

### Phase 3: Advanced Features
- [ ] Real-time subscriptions
- [ ] Edge functions
- [ ] Webhooks
- [ ] Analytics
- [ ] Monitoring

### Phase 4: Ecosystem
- [ ] Community plugins
- [ ] Templates
- [ ] Integrations
- [ ] Marketplace

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pnpm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Documentation

- [SDK Documentation](./packages/kuratchi-sdk/README.md)
- [Plugin API](./packages/kuratchi-sdk/PLUGIN_API.md)
- [Schema Guide](./packages/kuratchi-sdk/SCHEMA_GUIDE.md)
- [Migration Guide](./MONOREPO_MIGRATION.md)

## Community

- [Discord](https://discord.gg/kuratchi) (coming soon)
- [Twitter](https://twitter.com/kuratchi) (coming soon)
- [GitHub Discussions](https://github.com/yourusername/kuratchi/discussions)

## License

MIT License - see [LICENSE](LICENSE) for details

## Acknowledgments

Inspired by:
- [Supabase](https://supabase.com) - The open-source Firebase alternative
- [Cloudflare Workers](https://workers.cloudflare.com) - Edge computing platform
- [SvelteKit](https://kit.svelte.dev) - The fastest way to build web apps

---

**Built with ❤️ for the SvelteKit community**
