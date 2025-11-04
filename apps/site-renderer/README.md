# Site Renderer

Dynamic site renderer that loads customer site configurations at runtime (Shopify/Wix style) and renders them using shared UI components.

## Tech Stack

- **SvelteKit** - Application framework
- **Tailwind CSS 4** - Styling
- **DaisyUI** - UI components
- **Lucide Svelte** - Icons
- **@kuratchi/ui** - Shared component library

## Architecture

The site-renderer communicates with the dashboard via secure API endpoints instead of directly accessing databases. This ensures:
- **Security**: No direct database access from public-facing app
- **Isolation**: Site-renderer can't access admin or organization data
- **Control**: Dashboard API controls what data is exposed
- **Scalability**: API can be cached, rate-limited, etc.

### Flow

1. **Request arrives** → `hooks.server.ts` extracts subdomain
2. **Site resolution** → Calls `POST /api/sites/resolve` on dashboard
3. **Page loading** → Calls `POST /api/sites/pages` for content
4. **Rendering** → Displays site using resolved data

## Setup

1. **Install dependencies**:
```bash
pnpm install
```

2. **Configure environment** (copy `.env.example` to `.env`):
```env
DASHBOARD_API_URL=http://localhost:5173
SITE_RENDERER_API_TOKEN=your-secure-token-here
```

3. **Set the same token in dashboard** (`.env`):
```env
SITE_RENDERER_API_TOKEN=your-secure-token-here
```

## Development

```bash
pnpm dev
```

The site-renderer runs on a different port than the dashboard. To test:

1. Create a site in the dashboard (e.g., subdomain: "mysite")
2. Access the site at `http://mysite.localhost:5174` (or your configured port)
3. The renderer will fetch site data from the dashboard API

## Building

```bash
pnpm build
pnpm preview
```

## Features

- **Secure API communication** with dashboard
- **Token-based authentication** for API requests
- **Dynamic site resolution** by subdomain
- **Page content rendering** from site databases
- Ready for block/layout renderer integration
