# Kuratchi Auth Guide

The Kuratchi auth module provides flexible, plugin-based authentication for SvelteKit applications. Choose your setup based on your needs:
- **Simple Auth**: Just session management
- **Auth + Storage**: Add KV, R2, D1 storage
- **Multi-tenant**: Full organization management

This guide covers all scenarios with the new v2 plugin architecture.

---

## Table of Contents

1. [Getting Started](#getting-started)
   - [Unified API (Recommended)](#unified-api)
   - [Modular API](#modular-api)
2. [Environment Variables](#environment-variables)
3. [Auth Provider Plugins (NEW)](#auth-provider-plugins)
   - [Email Auth (Magic Links)](#email-auth-plugin)
   - [OAuth (Google, GitHub, etc.)](#oauth-plugin)
   - [Credentials (Email/Password)](#credentials-plugin)
4. [Scenario 1: Simple Auth Only](#scenario-1-simple-auth-only)
5. [Scenario 2: Auth + Storage](#scenario-2-auth--storage)
6. [Scenario 3: Multi-tenant (Admin + Organizations)](#scenario-3-multi-tenant-admin--organizations)
7. [Scenario 4: Full Stack with Guards](#scenario-4-full-stack-with-guards)
8. [Scenario 5: Custom Plugins](#scenario-5-custom-plugins)
9. [Legacy v1 API](#legacy-v1-api)

---

## Getting Started

Kuratchi SDK offers two ways to configure your application: **Unified API** (recommended for most cases) or **Modular API** (for more granular control).

### Unified API

```typescript
// src/hooks.server.ts
import { kuratchi } from 'kuratchi-sdk';
import { sessionPlugin, adminPlugin, organizationPlugin, emailAuthPlugin, oauthPlugin } from 'kuratchi-sdk/auth';
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';

const app = kuratchi({
  auth: {
    plugins: [
      sessionPlugin(),
      adminPlugin({ adminSchema }),
      organizationPlugin({ organizationSchema }),
      emailAuthPlugin({
        provider: 'resend',
        apiKey: process.env.RESEND_API_KEY!,
        from: process.env.EMAIL_FROM!
      }),
      oauthPlugin({
        providers: [
          {
            name: 'google',
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!
          }
        ]
      })
    ]
  }
});

export const handle = app.handle;
```

> **Important:** `adminSchema` and `organizationSchema` are REQUIRED. Copy reference examples from `node_modules/kuratchi-sdk/src/lib/schema/*.example.ts` and customize for your needs.

### Modular API

Import only what you need from subpath exports (`kuratchi-sdk/auth`, `kuratchi-sdk/database`, etc.).

```typescript
// src/hooks.server.ts
import { createAuthHandle, sessionPlugin, adminPlugin } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    adminPlugin()
  ],
  // Storage bindings
  kvNamespaces: { default: 'MY_KV' },
  r2Buckets: { uploads: 'USER_UPLOADS' },
  d1Databases: { analytics: 'ANALYTICS_DB' }
});
```

```typescript
// Using database in a route
import { database } from 'kuratchi-sdk';
import { organizationSchema } from '$lib/schema/organization';

export async function load() {
  const orm = await database.client({
    databaseName: 'my-org-db',
    dbToken: env.DB_TOKEN,
    schema: organizationSchema
  });
  
  const { data } = await orm.users.many();
  return { users: data };
}
```

**Choose Based On:**
- **Unified API**: Best for full-stack apps with auth + database + storage
- **Modular API**: Best for auth-only apps or when you need fine-grained control

---

## Environment Variables

### Core (All Scenarios)
```bash
KURATCHI_AUTH_SECRET=your-secret-key  # Required for session encryption
```

### Storage (Optional - Scenario 2+)
```bash
# Only needed if using storage plugin
# No env vars required - bindings configured in wrangler.toml
```

### Multi-tenant (Optional - Scenario 3+)
```bash
# Only needed if using admin/organization plugins
KURATCHI_ADMIN_DB_NAME=kuratchi-admin          # Admin database name
KURATCHI_ADMIN_DB_TOKEN=token-from-cli         # From init-admin-db
KURATCHI_GATEWAY_KEY=gateway-key               # DO gateway key
CLOUDFLARE_WORKERS_SUBDOMAIN=your-subdomain    # Workers subdomain
CLOUDFLARE_ACCOUNT_ID=account-id               # Cloudflare account
CLOUDFLARE_API_TOKEN=api-token                 # API token
```

### Auth Providers (Optional)
```bash
# Email Auth (magic links)
EMAIL_FROM=noreply@example.com
RESEND_API_KEY=re_xxx                          # For Resend provider

# OAuth
ORIGIN=https://app.example.com                 # Your app URL
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx
```

---

## Auth Provider Plugins

The v2 plugin system includes three authentication provider plugins. Each one handles a specific auth flow and can be used independently or combined.

### Email Auth Plugin

Provides **magic link** authentication via email.

#### Features
- 🔗 Send magic links to users' emails
- ✉️ Built-in Resend support
- 🔒 Secure token generation and verification
- ⏱️ Configurable token expiration
- 🎨 Custom email templates

#### Setup

```typescript
import { createAuthHandle, sessionPlugin, emailAuthPlugin } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    emailAuthPlugin({
      provider: 'resend',
      apiKey: env.RESEND_API_KEY,
      from: 'noreply@example.com',
      
      // Optional: custom email template
      emailTemplate: (link, email) => ({
        subject: 'Sign in to your account',
        html: `
          <h2>Welcome back!</h2>
          <p>Click the link below to sign in:</p>
          <a href="${link}">Sign In</a>
          <p>This link expires in 15 minutes.</p>
        `
      }),
      
      // Optional: callbacks
      onBeforeSend: async (email, organizationId) => {
        console.log('Sending magic link to:', email);
      },
      onSuccess: async (email, user) => {
        console.log('User signed in:', user);
      }
    })
  ]
});
```

#### Available Routes

**POST** `/auth/magic/send`
```typescript
// Send magic link
const response = await fetch('/auth/magic/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    redirectTo: '/dashboard',        // Optional
    organizationId: 'org-id'         // Optional (auto-detected)
  })
});
```

**GET** `/auth/magic/callback?token=xxx&org=yyy`
- Automatically handles token verification and signs user in
- Users click this link from their email

#### SvelteKit Example

```typescript
// src/routes/login/+page.svelte
<script>
  let email = '';
  let loading = false;
  let sent = false;
  
  async function sendMagicLink() {
    loading = true;
    const response = await fetch('/auth/magic/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirectTo: '/dashboard' })
    });
    
    if (response.ok) {
      sent = true;
    }
    loading = false;
  }
</script>

{#if !sent}
  <form on:submit|preventDefault={sendMagicLink}>
    <input type="email" bind:value={email} placeholder="Enter your email" required />
    <button disabled={loading}>
      {loading ? 'Sending...' : 'Send Magic Link'}
    </button>
  </form>
{:else}
  <p>Check your email for the sign-in link!</p>
{/if}
```

---

### OAuth Plugin

Provides **social authentication** with Google, GitHub, Microsoft, and custom providers.

#### Features
- 🌐 Multi-provider support (Google, GitHub, Microsoft)
- 🔌 Custom provider support
- 🔒 Secure state signing (HMAC)
- 👤 Automatic user creation and linking
- 🔗 OAuth account linking

#### Setup

```typescript
import { createAuthHandle, sessionPlugin, oauthPlugin } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    oauthPlugin({
      providers: [
        {
          name: 'google',
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          scopes: ['openid', 'email', 'profile']  // Optional
        },
        {
          name: 'github',
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET
        },
        {
          name: 'microsoft',
          clientId: env.MICROSOFT_CLIENT_ID,
          clientSecret: env.MICROSOFT_CLIENT_SECRET
        }
      ],
      
      // Optional: custom profile handler
      onProfile: async (provider, profile, ctx) => {
        // Custom user creation logic
        return user;
      },
      
      // Optional: success callback
      onSuccess: async (user, provider) => {
        console.log(`User signed in via ${provider}:`, user);
      }
    })
  ]
});
```

#### Available Routes

Each provider gets two routes:

**GET** `/auth/oauth/:provider/start`
- Google: `/auth/oauth/google/start`
- GitHub: `/auth/oauth/github/start`
- Microsoft: `/auth/oauth/microsoft/start`

Query params:
- `?org=xxx` - Specify organization ID
- `?redirectTo=/dashboard` - Where to redirect after auth

**GET** `/auth/oauth/:provider/callback`
- Handles OAuth callback automatically
- Users are redirected here by the OAuth provider

#### SvelteKit Example

```typescript
// src/routes/login/+page.svelte
<script>
  function signInWithGoogle() {
    window.location.href = '/auth/oauth/google/start?redirectTo=/dashboard';
  }
  
  function signInWithGitHub() {
    window.location.href = '/auth/oauth/github/start?redirectTo=/dashboard';
  }
</script>

<div class="auth-buttons">
  <button on:click={signInWithGoogle}>
    Sign in with Google
  </button>
  <button on:click={signInWithGitHub}>
    Sign in with GitHub
  </button>
</div>
```

#### Custom Provider Example

```typescript
oauthPlugin({
  providers: [
    {
      name: 'custom',
      clientId: env.CUSTOM_CLIENT_ID,
      clientSecret: env.CUSTOM_CLIENT_SECRET,
      scopes: ['openid', 'email'],
      authorizeUrl: 'https://auth.example.com/oauth/authorize',
      tokenUrl: 'https://auth.example.com/oauth/token',
      profileUrl: 'https://api.example.com/user'
    }
  ]
})
```

---

### Credentials Plugin

Provides **email/password** authentication with rate limiting.

#### Features
- 🔑 Email/password authentication
- 🔒 Secure password verification (PBKDF2)
- 🛡️ Rate limiting (requires KV)
- 🚫 Account lockout protection
- 📊 Login attempt tracking

#### Setup

```typescript
import { 
  createAuthHandle, 
  sessionPlugin,
  storagePlugin,
  credentialsPlugin 
} from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    
    // Storage for rate limiting (optional but recommended)
    storagePlugin({ kv: { default: 'MY_KV' } }),
    
    credentialsPlugin({
      maxAttempts: 5,                // Max failed attempts
      lockoutDuration: 900000,       // 15 minutes
      
      // Optional: custom authentication
      authenticate: async (email, password, ctx) => {
        // Custom auth logic
        return user;
      },
      
      // Optional: callbacks
      onSuccess: async (user) => {
        console.log('User logged in:', user);
      },
      onFailure: async (email) => {
        console.log('Failed login attempt:', email);
      }
    })
  ]
});
```

#### Available Routes

**POST** `/auth/credentials/login`
```typescript
const response = await fetch('/auth/credentials/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    organizationId: 'org-id'         // Optional (auto-detected)
  })
});

const result = await response.json();
// { success: true, user: { id, email, name } }
// or
// { success: false, error: 'invalid_credentials' }
// or
// { success: false, error: 'too_many_attempts', message: '...' }
```

**POST** `/auth/credentials/logout`
```typescript
await fetch('/auth/credentials/logout', { method: 'POST' });
```

#### SvelteKit Example

```typescript
// src/routes/login/+page.svelte
<script>
  let email = '';
  let password = '';
  let loading = false;
  let error = '';
  
  async function login() {
    loading = true;
    error = '';
    
    const response = await fetch('/auth/credentials/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const result = await response.json();
    
    if (result.success) {
      window.location.href = '/dashboard';
    } else {
      error = result.error === 'too_many_attempts' 
        ? result.message 
        : 'Invalid email or password';
    }
    
    loading = false;
  }
</script>

<form on:submit|preventDefault={login}>
  {#if error}
    <div class="error">{error}</div>
  {/if}
  
  <input type="email" bind:value={email} placeholder="Email" required />
  <input type="password" bind:value={password} placeholder="Password" required />
  
  <button disabled={loading}>
    {loading ? 'Signing in...' : 'Sign In'}
  </button>
</form>
```

---

### Combining Auth Providers

You can use multiple auth providers together:

```typescript
import { 
  createAuthHandle,
  sessionPlugin,
  adminPlugin,
  organizationPlugin,
  emailAuthPlugin,
  oauthPlugin,
  credentialsPlugin
} from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    adminPlugin(),
    organizationPlugin(),
    
    // All three auth methods!
    emailAuthPlugin({
      provider: 'resend',
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM
    }),
    
    oauthPlugin({
      providers: [
        { name: 'google', clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
        { name: 'github', clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
      ]
    }),
    
    credentialsPlugin({
      maxAttempts: 5,
      lockoutDuration: 900000
    })
  ]
});
```

Now your login page can offer all three options:

```svelte
<h2>Sign in</h2>

<!-- Magic Link -->
<button on:click={sendMagicLink}>Email me a sign-in link</button>

<!-- OAuth -->
<button on:click={() => window.location.href = '/auth/oauth/google/start'}>
  Sign in with Google
</button>

<!-- Credentials -->
<form on:submit|preventDefault={loginWithPassword}>
  <input type="email" bind:value={email} />
  <input type="password" bind:value={password} />
  <button>Sign in with password</button>
</form>
```

---

## Complete SvelteKit Examples

### Example 1: Session Management Only

Perfect for simple apps without multi-tenancy.

#### Project Structure
```
my-app/
├── src/
│   ├── hooks.server.ts
│   ├── routes/
│   │   ├── login/
│   │   │   └── +page.server.ts
│   │   ├── dashboard/
│   │   │   └── +page.server.ts
│   │   └── +layout.server.ts
```

#### `hooks.server.ts`
```typescript
import { createAuthHandle } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle();
```

#### `src/routes/+layout.server.ts`
```typescript
export async function load({ locals }) {
  return {
    user: locals.user,
    session: locals.session
  };
}
```

#### `src/routes/login/+page.server.ts`
```typescript
import { fail, redirect } from '@sveltejs/kit';

export const actions = {
  async default({ request, locals, cookies }) {
    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');
    
    // Your authentication logic here
    // For this example, simple check
    if (email === 'user@example.com' && password === 'password') {
      // Create session data
      const sessionData = {
        userId: '123',
        email: email,
        createdAt: Date.now()
      };
      
      // Set session cookie
      const sessionString = JSON.stringify(sessionData);
      locals.kuratchi.setSessionCookie(sessionString, {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });
      
      throw redirect(303, '/dashboard');
    }
    
    return fail(400, { error: 'Invalid credentials' });
  }
};
```

#### `src/routes/login/+page.svelte`
```svelte
<script>
  import { enhance } from '$app/forms';
  export let form;
</script>

<h1>Sign In</h1>

<form method="POST" use:enhance>
  <input type="email" name="email" placeholder="Email" required />
  <input type="password" name="password" placeholder="Password" required />
  <button type="submit">Sign In</button>
  
  {#if form?.error}
    <p class="error">{form.error}</p>
  {/if}
</form>
```

#### `src/routes/dashboard/+page.server.ts`
```typescript
import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
  // Check if user is authenticated
  if (!locals.session) {
    throw redirect(303, '/login');
  }
  
  return {
    user: locals.user,
    message: `Welcome back, ${locals.user?.email}!`
  };
}
```

#### `src/routes/dashboard/+page.svelte`
```svelte
<script>
  export let data;
</script>

<h1>Dashboard</h1>
<p>{data.message}</p>
<p>User ID: {data.user?.userId}</p>
```

---

### Example 2: Session + Admin (Multi-tenant Foundation)

For SaaS apps with organization management.

#### Project Structure
```
my-app/
├── src/
│   ├── hooks.server.ts
│   ├── routes/
│   │   ├── admin/
│   │   │   ├── organizations/
│   │   │   │   ├── +page.server.ts
│   │   │   │   └── +page.svelte
│   │   │   └── create-org/
│   │   │       ├── +page.server.ts
│   │   │       └── +page.svelte
│   │   ├── login/
│   │   │   └── +page.server.ts
│   │   └── +layout.server.ts
```

#### `hooks.server.ts`
```typescript
import { createAuthHandle, sessionPlugin, adminPlugin } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    adminPlugin() // Admin database support
  ]
});
```

#### `.env`
```bash
KURATCHI_AUTH_SECRET=your-secret-key
KURATCHI_ADMIN_DB_NAME=kuratchi-admin
KURATCHI_ADMIN_DB_TOKEN=token-from-init-admin-db
KURATCHI_GATEWAY_KEY=gateway-key
CLOUDFLARE_WORKERS_SUBDOMAIN=your-subdomain
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

#### `src/routes/admin/organizations/+page.server.ts`
```typescript
import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
  // Check auth
  if (!locals.session) {
    throw redirect(303, '/login');
  }
  
  // Get admin database
  const adminDb = await locals.kuratchi.getAdminDb();
  if (!adminDb) {
    return { organizations: [], error: 'Admin DB not available' };
  }
  
  // Query organizations
  const { data: organizations } = await adminDb.organizations.many();
  const { data: databases } = await adminDb.databases.many();
  
  // Combine data
  const orgsWithDbs = organizations.map(org => {
    const db = databases.find(d => d.organization_id === org.id);
    return {
      ...org,
      databaseName: db?.database_name,
      databaseStatus: db ? 'active' : 'pending'
    };
  });
  
  return {
    organizations: orgsWithDbs
  };
}
```

#### `src/routes/admin/organizations/+page.svelte`
```svelte
<script>
  export let data;
</script>

<h1>Organizations</h1>

<a href="/admin/create-org">Create New Organization</a>

<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Slug</th>
      <th>Database</th>
      <th>Status</th>
      <th>Created</th>
    </tr>
  </thead>
  <tbody>
    {#each data.organizations as org}
      <tr>
        <td>{org.name}</td>
        <td>{org.slug}</td>
        <td>{org.databaseName || 'N/A'}</td>
        <td>{org.databaseStatus}</td>
        <td>{new Date(org.created_at).toLocaleDateString()}</td>
      </tr>
    {/each}
  </tbody>
</table>
```

#### `src/routes/admin/create-org/+page.server.ts`
```typescript
import { auth } from 'kuratchi-sdk';
import { fail, redirect } from '@sveltejs/kit';

export const actions = {
  async default({ request, locals }) {
    if (!locals.session) {
      throw redirect(303, '/login');
    }
    
    const data = await request.formData();
    const name = data.get('name');
    const slug = data.get('slug');
    const email = data.get('email');
    const password = data.get('password');
    
    try {
      const admin = await auth.admin();
      const result = await admin.createOrganization({
        organizationName: name,
        organizationSlug: slug,
        email: email,
        password: password
      });
      
      throw redirect(303, '/admin/organizations');
    } catch (error) {
      return fail(400, { 
        error: error.message,
        name,
        slug,
        email
      });
    }
  }
};
```

#### `src/routes/admin/create-org/+page.svelte`
```svelte
<script>
  import { enhance } from '$app/forms';
  export let form;
</script>

<h1>Create Organization</h1>

<form method="POST" use:enhance>
  <label>
    Organization Name
    <input 
      type="text" 
      name="name" 
      required 
      value={form?.name || ''}
    />
  </label>
  
  <label>
    Slug (URL-friendly)
    <input 
      type="text" 
      name="slug" 
      pattern="[a-z0-9-]+" 
      required 
      value={form?.slug || ''}
    />
  </label>
  
  <label>
    Admin Email
    <input 
      type="email" 
      name="email" 
      required 
      value={form?.email || ''}
    />
  </label>
  
  <label>
    Admin Password
    <input type="password" name="password" required minlength="8" />
  </label>
  
  <button type="submit">Create Organization</button>
  
  {#if form?.error}
    <p class="error">{form.error}</p>
  {/if}
</form>
```

---

### Example 3: Full Stack (Everything)

Complete setup with sessions, admin, organizations, storage, and guards.

#### Project Structure
```
my-app/
├── src/
│   ├── hooks.server.ts
│   ├── routes/
│   │   ├── admin/
│   │   │   └── organizations/
│   │   │       └── +page.server.ts
│   │   ├── dashboard/
│   │   │   ├── projects/
│   │   │   │   ├── +page.server.ts
│   │   │   │   └── +page.svelte
│   │   │   └── upload/
│   │   │       ├── +page.server.ts
│   │   │       └── +page.svelte
│   │   ├── login/
│   │   │   └── +page.server.ts
│   │   └── +layout.server.ts
```

#### `hooks.server.ts`
```typescript
import { 
  createAuthHandle, 
  sessionPlugin,
  adminPlugin,
  organizationPlugin,
  storagePlugin,
  guardsPlugin,
  requireAuth 
} from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    adminPlugin(),
    organizationPlugin(),
    
    // Storage bindings
    storagePlugin({
      kv: { 
        default: 'MY_KV',
        cache: 'CACHE_KV'
      },
      r2: { 
        uploads: 'USER_UPLOADS' 
      },
      d1: { 
        analytics: 'ANALYTICS_DB' 
      }
    }),
    
    // Route protection
    guardsPlugin({
      guards: [
        requireAuth({
          pattern: '/admin/*',
          redirectTo: '/login'
        }),
        requireAuth({
          pattern: '/dashboard/*',
          redirectTo: '/login'
        })
      ]
    })
  ]
});
```

#### `wrangler.toml`
```toml
name = "my-app"

[[kv_namespaces]]
binding = "MY_KV"
id = "your-kv-id"

[[kv_namespaces]]
binding = "CACHE_KV"
id = "your-cache-id"

[[r2_buckets]]
binding = "USER_UPLOADS"
bucket_name = "uploads"

[[d1_databases]]
binding = "ANALYTICS_DB"
database_name = "analytics"
database_id = "your-db-id"
```

#### `src/routes/dashboard/projects/+page.server.ts`
```typescript
// Automatically protected by guard!
export async function load({ locals }) {
  // Get organization database
  const orgDb = await locals.kuratchi.orgDatabaseClient();
  if (!orgDb) {
    return { projects: [], error: 'Organization database not available' };
  }
  
  // Get user's projects from org database
  const { data: projects } = await orgDb.projects
    .where({ owner_id: locals.user.id })
    .many();
  
  // Get cached project stats from KV
  const kv = locals.kuratchi.kv.default;
  const cachedStats = await kv.get('project:stats', { type: 'json' });
  
  // Log to analytics D1
  const analyticsDb = locals.kuratchi.d1.analytics;
  await analyticsDb.prepare(
    'INSERT INTO page_views (user_id, page, timestamp) VALUES (?, ?, ?)'
  ).bind(locals.user.id, '/dashboard/projects', Date.now()).run();
  
  return {
    projects,
    stats: cachedStats || { total: projects.length, active: 0 }
  };
}

export const actions = {
  async create({ request, locals }) {
    const data = await request.formData();
    const name = data.get('name');
    const description = data.get('description');
    
    const orgDb = await locals.kuratchi.orgDatabaseClient();
    if (!orgDb) {
      return { error: 'Database not available' };
    }
    
    // Create project in org database
    const { data: project } = await orgDb.projects.insert({
      name,
      description,
      owner_id: locals.user.id,
      created_at: Date.now()
    });
    
    // Invalidate cache
    const kv = locals.kuratchi.kv.default;
    await kv.delete('project:stats');
    
    return { success: true, project };
  }
};
```

#### `src/routes/dashboard/projects/+page.svelte`
```svelte
<script>
  import { enhance } from '$app/forms';
  export let data;
</script>

<h1>My Projects</h1>

{#if data.error}
  <p class="error">{data.error}</p>
{:else}
  <div class="stats">
    <span>Total: {data.stats.total}</span>
    <span>Active: {data.stats.active}</span>
  </div>

  <div class="projects">
    {#each data.projects as project}
      <div class="project-card">
        <h3>{project.name}</h3>
        <p>{project.description}</p>
        <small>{new Date(project.created_at).toLocaleDateString()}</small>
      </div>
    {/each}
  </div>

  <form method="POST" use:enhance>
    <h2>Create New Project</h2>
    <input type="text" name="name" placeholder="Project name" required />
    <textarea name="description" placeholder="Description"></textarea>
    <button type="submit">Create</button>
  </form>
{/if}
```

#### `src/routes/dashboard/upload/+page.server.ts`
```typescript
export const actions = {
  async upload({ request, locals }) {
    const data = await request.formData();
    const file = data.get('file');
    
    if (!file || !(file instanceof File)) {
      return { error: 'No file provided' };
    }
    
    // Upload to R2
    const bucket = locals.kuratchi.r2.uploads;
    const key = `${locals.user.id}/${Date.now()}-${file.name}`;
    
    await bucket.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type
      },
      customMetadata: {
        uploadedBy: locals.user.id,
        originalName: file.name
      }
    });
    
    // Save metadata to org database
    const orgDb = await locals.kuratchi.orgDatabaseClient();
    await orgDb.uploads.insert({
      user_id: locals.user.id,
      filename: file.name,
      r2_key: key,
      size: file.size,
      mime_type: file.type,
      uploaded_at: Date.now()
    });
    
    // Cache in KV for quick access
    const kv = locals.kuratchi.kv.default;
    await kv.put(`upload:latest:${locals.user.id}`, JSON.stringify({
      filename: file.name,
      key,
      uploadedAt: Date.now()
    }), {
      expirationTtl: 3600 // 1 hour
    });
    
    // Track in analytics
    const analyticsDb = locals.kuratchi.d1.analytics;
    await analyticsDb.prepare(
      'INSERT INTO uploads (user_id, filename, size, timestamp) VALUES (?, ?, ?, ?)'
    ).bind(locals.user.id, file.name, file.size, Date.now()).run();
    
    return { success: true, key };
  }
};
```

#### `src/routes/dashboard/upload/+page.svelte`
```svelte
<script>
  import { enhance } from '$app/forms';
  export let form;
</script>

<h1>Upload Files</h1>

<form method="POST" enctype="multipart/form-data" use:enhance>
  <input type="file" name="file" required />
  <button type="submit">Upload</button>
  
  {#if form?.success}
    <p class="success">File uploaded successfully!</p>
    <p>Key: {form.key}</p>
  {/if}
  
  {#if form?.error}
    <p class="error">{form.error}</p>
  {/if}
</form>
```

---

## Scenario 1: Simple Auth Only

Perfect for basic apps that just need user sessions without multi-tenancy or storage.

### Setup (`hooks.server.ts`)

```typescript
import { createAuthHandle } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle();
```

That's it! No plugins, no configuration, just pure session management.

### What You Get

- ✅ Session cookies (`locals.session`, `locals.user`)
- ✅ Cookie helpers (`setSessionCookie()`, `clearSessionCookie()`)
- ✅ Automatic session parsing from cookies
- ❌ No storage bindings
- ❌ No admin database
- ❌ No organization management

### Usage in Routes

```typescript
// src/routes/+page.server.ts
export async function load({ locals }) {
  const { user, session } = locals;
  
  return {
    user,
    isAuthenticated: !!session
  };
}
```

### Sign In Example

```typescript
// src/routes/login/+page.server.ts
import { auth } from 'kuratchi-sdk';

export const actions = {
  async login({ request, locals }) {
    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');
    
    // Authenticate (requires KuratchiAuth instance)
    const authInstance = auth.instance();
    const result = await authInstance.authenticate(email, password);
    
    if (result.success) {
      // Set session cookie
      locals.kuratchi.setSessionCookie(result.cookie);
      return { success: true };
    }
    
    return { error: 'Invalid credentials' };
  }
};
```

---

## Scenario 2: Auth + Storage

For apps that need authentication plus direct access to Cloudflare storage (KV, R2, D1) without multi-tenancy.

### Setup (`hooks.server.ts`)

```typescript
import { createAuthHandle } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  // Map friendly names to wrangler.toml bindings
  kvNamespaces: {
    default: 'MY_KV',
    cache: 'CACHE_KV'
  },
  r2Buckets: {
    uploads: 'USER_UPLOADS',
    assets: 'STATIC_ASSETS'
  },
  d1Databases: {
    default: 'MY_DB',
    analytics: 'ANALYTICS_DB'
  }
});
```

### wrangler.toml Configuration

```toml
[[kv_namespaces]]
binding = "MY_KV"
id = "your-kv-id"

[[kv_namespaces]]
binding = "CACHE_KV"
id = "your-cache-id"

[[r2_buckets]]
binding = "USER_UPLOADS"
bucket_name = "uploads"

[[d1_databases]]
binding = "MY_DB"
database_name = "main"
database_id = "your-db-id"
```

### What You Get

- ✅ Session management
- ✅ Storage bindings via `locals.kuratchi.kv/r2/d1`
- ✅ Automatic binding attachment
- ❌ No admin database
- ❌ No organization management

### Usage in Routes

```typescript
// src/routes/+page.server.ts
export async function load({ locals }) {
  const { user, session } = locals;
  
  // Access storage via friendly names
  const kv = locals.kuratchi.kv.default;
  const cache = locals.kuratchi.kv.cache;
  const bucket = locals.kuratchi.r2.uploads;
  const db = locals.kuratchi.d1.default;
  
  // Use them directly
  const cached = await kv.get('key');
  const file = await bucket.get('file.pdf');
  const users = await db.prepare('SELECT * FROM users').all();
  
  return { users: users.results, cached };
}
```

### Form Action with Storage

```typescript
// src/routes/upload/+page.server.ts
export const actions = {
  async upload({ request, locals }) {
    const data = await request.formData();
    const file = data.get('file');
    
    // Upload to R2
    const bucket = locals.kuratchi.r2.uploads;
    await bucket.put(`uploads/${file.name}`, file.stream());
    
    // Cache metadata in KV
    const kv = locals.kuratchi.kv.default;
    await kv.put(`file:${file.name}`, JSON.stringify({
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString()
    }));
    
    // Save record in D1
    const db = locals.kuratchi.d1.default;
    await db.prepare(
      'INSERT INTO uploads (filename, size, user_id) VALUES (?, ?, ?)'
    ).bind(file.name, file.size, locals.user.id).run();
    
    return { success: true };
  }
};
```

---

## Scenario 3: Multi-tenant (Admin + Organizations)

Full multi-tenant setup with admin database and per-organization databases.

### Setup (`hooks.server.ts`)

```typescript
import { 
  createAuthHandle, 
  sessionPlugin,
  adminPlugin,
  organizationPlugin,
  storagePlugin
} from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    adminPlugin(),           // Admin database
    organizationPlugin(),    // Per-org databases
    
    // Optional: Add storage
    storagePlugin({
      kv: { default: 'MY_KV' },
      d1: { analytics: 'ANALYTICS_DB' }
    })
  ]
});
```

### What You Get

- ✅ Session management
- ✅ Admin database via `getAdminDb()`
- ✅ Organization databases via `orgDatabaseClient()`
- ✅ Storage bindings (if configured)
- ✅ Multi-tenant data isolation

### Usage: Admin Operations

```typescript
// src/routes/admin/organizations/+page.server.ts
export async function load({ locals }) {
  const adminDb = await locals.kuratchi.getAdminDb();
  if (!adminDb) return { organizations: [] };
  
  // Query admin database
  const { data: organizations } = await adminDb.organizations.many();
  const { data: databases } = await adminDb.databases.many();
  
  return { organizations, databases };
}
```

### Usage: Organization Operations

```typescript
// src/routes/dashboard/+page.server.ts
export async function load({ locals }) {
  const { user, session } = locals;
  
  // Get current user's organization database
  const orgDb = await locals.kuratchi.orgDatabaseClient();
  if (!orgDb) return { projects: [] };
  
  // Query organization-specific data
  const { data: projects } = await orgDb.projects
    .where({ owner_id: user.id })
    .many();
  
  const { data: team } = await orgDb.users.many();
  
  return { projects, team };
}
```

### Creating an Organization

```typescript
// src/routes/admin/create-org/+page.server.ts
import { auth } from 'kuratchi-sdk';

export const actions = {
  async createOrg({ request }) {
    const data = await request.formData();
    
    const admin = await auth.admin();
    const result = await admin.createOrganization({
      organizationName: data.get('name'),
      organizationSlug: data.get('slug'),
      email: data.get('email'),
      password: data.get('password')
    });
    
    return { success: true, organizationId: result.organizationId };
  }
};
```

---

## Scenario 4: Full Stack with Guards

Complete setup with route protection.

### Setup (`hooks.server.ts`)

```typescript
import { 
  createAuthHandle,
  sessionPlugin,
  adminPlugin,
  organizationPlugin,
  storagePlugin,
  guardsPlugin,
  requireAuth 
} from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    adminPlugin(),
    organizationPlugin(),
    storagePlugin({
      kv: { default: 'MY_KV' },
      r2: { uploads: 'UPLOADS' }
    }),
    
    // Route guards
    guardsPlugin({
      guards: [
        // Protect admin routes
        requireAuth({
          pattern: '/admin/*',
          redirectTo: '/login'
        }),
        
        // Protect dashboard
        requireAuth({
          pattern: '/dashboard/*',
          redirectTo: '/login'
        }),
        
        // Protect API (returns 401 instead of redirect)
        requireAuth({
          pattern: '/api/*'
        }),
        
        // Custom check for admin-only routes
        requireAuth({
          pattern: '/admin/settings/*',
          check: (ctx) => ctx.session?.role === 'admin',
          redirectTo: '/unauthorized'
        })
      ]
    })
  ]
});
```

### What You Get

- ✅ Everything from Scenario 3
- ✅ Automatic route protection
- ✅ No manual auth checks in routes
- ✅ Pattern-based guards

### Protected Routes (No Extra Code)

```typescript
// src/routes/admin/+page.server.ts
// Automatically protected by guard - no auth check needed!
export async function load({ locals }) {
  // User is guaranteed to be authenticated
  const adminDb = await locals.kuratchi.getAdminDb();
  return { data: await adminDb.organizations.many() };
}
```

---

## Scenario 5: Custom Plugins

Build your own plugins for custom functionality.

### Custom Analytics Plugin

```typescript
// lib/auth-plugins/analytics.ts
import type { AuthPlugin } from 'kuratchi-sdk/auth';

export function analyticsPlugin(): AuthPlugin {
  return {
    name: 'analytics',
    priority: 999, // Run last
    
    async onRequest(ctx) {
      const url = new URL(ctx.event.request.url);
      console.log('[Analytics] Request:', url.pathname);
      
      // Track in KV
      const kv = ctx.locals.kuratchi.kv?.default;
      if (kv) {
        const key = `pageview:${url.pathname}`;
        const current = await kv.get(key);
        await kv.put(key, String((parseInt(current || '0') + 1)));
      }
    },
    
    async onSession(ctx) {
      if (ctx.session) {
        console.log('[Analytics] User:', ctx.session.userId);
        
        // Track last seen
        const kv = ctx.locals.kuratchi.kv?.default;
        if (kv) {
          await kv.put(
            `user:${ctx.session.userId}:last_seen`,
            new Date().toISOString()
          );
        }
      }
    },
    
    async onResponse(ctx) {
      // Add custom headers
      const headers = new Headers(ctx.response.headers);
      headers.set('X-Request-Id', crypto.randomUUID());
      headers.set('X-Powered-By', 'Kuratchi');
      
      return new Response(ctx.response.body, {
        status: ctx.response.status,
        statusText: ctx.response.statusText,
        headers
      });
    }
  };
}
```

### Use Custom Plugin

```typescript
// hooks.server.ts
import { 
  createAuthHandle, 
  sessionPlugin,
  storagePlugin 
} from 'kuratchi-sdk/auth';
import { analyticsPlugin } from './lib/auth-plugins/analytics';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    storagePlugin({ kv: { default: 'MY_KV' } }),
    analyticsPlugin() // Your custom plugin
  ]
});
```

### Plugin with Configuration

```typescript
// lib/auth-plugins/rate-limit.ts
import type { AuthPlugin } from 'kuratchi-sdk/auth';

export function rateLimitPlugin(options: {
  maxRequests: number;
  windowMs: number;
}): AuthPlugin {
  return {
    name: 'rate-limit',
    priority: 10, // Run early
    
    async onRequest(ctx) {
      const kv = ctx.locals.kuratchi.kv?.default;
      if (!kv) return;
      
      const ip = ctx.event.request.headers.get('cf-connecting-ip') || 'unknown';
      const key = `ratelimit:${ip}`;
      
      const current = await kv.get(key);
      const count = parseInt(current || '0');
      
      if (count >= options.maxRequests) {
        return new Response('Rate limit exceeded', { status: 429 });
      }
      
      await kv.put(key, String(count + 1), {
        expirationTtl: Math.floor(options.windowMs / 1000)
      });
    }
  };
}

// Use it
import { createAuthHandle, sessionPlugin } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    rateLimitPlugin({ maxRequests: 100, windowMs: 60000 }), // 100 req/min
    sessionPlugin()
  ]
});
```

---

## Legacy v1 API

The old API still works for backward compatibility:

```typescript
// Old way (still supported)
import { auth } from 'kuratchi-sdk';

export const handle = auth.handle({
  kvNamespaces: { default: 'MY_KV' },
  guards: [myGuard]
});
```

### Programmatic Auth Access

```ts
import { auth } from 'kuratchi-sdk';

// Reads env by default. Override with partial config.
const authInstance = auth.instance({
  origin: 'https://app.example.com', // optional override
});
```

`auth.instance()` validates required env vars and constructs `KuratchiAuth` with a Durable Object-backed admin client.

### Admin Helper

```typescript
import { auth } from 'kuratchi-sdk';

const admin = await auth.admin();

// Create organization
await admin.createOrganization({
  organizationName: 'Acme Corp',
  organizationSlug: 'acme',
  email: 'founder@acme.test',
  password: 'welcome-acme'
});

// List organizations
const orgs = await admin.listOrganizations();

// Get/delete organization
const org = await admin.getOrganization(orgs[0].id);
await admin.deleteOrganization(org.id);
```

---

## Comparison: v1 vs v2

| Feature | v1 API | v2 API (Plugin-based) |
|---------|--------|----------------------|
| **Session only** | ❌ Always loads admin/org | ✅ Just `createAuthHandle()` |
| **Storage bindings** | Via options | Via `storagePlugin()` or options |
| **Multi-tenant** | Always enabled | Optional via `adminPlugin()` + `organizationPlugin()` |
| **Route guards** | Via options | Via `guardsPlugin()` |
| **Custom logic** | Hard to extend | Easy with custom plugins |
| **Bundle size** | Larger (everything included) | Smaller (tree-shakeable) |
| **Testing** | Harder (monolithic) | Easier (isolated plugins) |

---

## Quick Reference

### All Available Plugins

| Plugin | Purpose | Required? | Dependencies |
|--------|---------|-----------|--------------|
| `sessionPlugin()` | Session cookie management | ✅ Default | None |
| `storagePlugin()` | KV/R2/D1 bindings | ❌ Optional | None |
| `adminPlugin()` | Admin database access | ❌ Optional | None |
| `organizationPlugin()` | Per-org database access | ❌ Optional | `adminPlugin()` |
| `guardsPlugin()` | Route protection | ❌ Optional | `sessionPlugin()` |
| **`emailAuthPlugin()`** | **Magic links** | ❌ **Optional** | `sessionPlugin()` |
| **`oauthPlugin()`** | **Social login** | ❌ **Optional** | `sessionPlugin()` |
| **`credentialsPlugin()`** | **Email/password** | ❌ **Optional** | `sessionPlugin()` |

### Use Case → Setup

```typescript
// Just auth (session only)
createAuthHandle()

// Auth + storage
createAuthHandle({
  kvNamespaces: { default: 'MY_KV' }
})

// Auth with email (magic links)
import { sessionPlugin, emailAuthPlugin } from 'kuratchi-sdk/auth';

createAuthHandle({
  plugins: [
    sessionPlugin(),
    emailAuthPlugin({
      provider: 'resend',
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM
    })
  ]
})

// Auth with OAuth
import { sessionPlugin, oauthPlugin } from 'kuratchi-sdk/auth';

createAuthHandle({
  plugins: [
    sessionPlugin(),
    oauthPlugin({
      providers: [
        { name: 'google', clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      ]
    })
  ]
})

// Multi-tenant with all auth providers
import { 
  sessionPlugin,
  adminPlugin,
  organizationPlugin,
  emailAuthPlugin,
  oauthPlugin,
  credentialsPlugin
} from 'kuratchi-sdk/auth';

createAuthHandle({
  plugins: [
    sessionPlugin(),
    adminPlugin(),
    organizationPlugin(),
    emailAuthPlugin({ provider: 'resend', apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }),
    oauthPlugin({ providers: [{ name: 'google', clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }] }),
    credentialsPlugin()
  ]
})

// Full stack
import { 
  sessionPlugin, 
  adminPlugin, 
  organizationPlugin, 
  storagePlugin, 
  guardsPlugin,
  emailAuthPlugin,
  oauthPlugin
} from 'kuratchi-sdk/auth';

createAuthHandle({
  plugins: [
    sessionPlugin(),
    adminPlugin(),
    organizationPlugin(),
    storagePlugin({ kv: { default: 'MY_KV' } }),
    emailAuthPlugin({ provider: 'resend', apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }),
    oauthPlugin({ providers: [{ name: 'google', clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }] }),
    guardsPlugin({ guards: [...] })
  ]
})
```

### Available in `locals.kuratchi`

| Property | Scenario | Description |
|----------|----------|-------------|
| `session` | All | Current session object |
| `user` | All | Current user object |
| `setSessionCookie()` | All | Set session cookie |
| `clearSessionCookie()` | All | Clear session cookie |
| `kv.*` | Storage plugin | KV namespaces |
| `r2.*` | Storage plugin | R2 buckets |
| `d1.*` | Storage plugin | D1 databases |
| `getAdminDb()` | Admin plugin | Get admin DB client |
| `orgDatabaseClient()` | Organization plugin | Get org DB client |

### Available Auth Routes

Routes automatically registered when you use auth provider plugins:

| Route | Method | Plugin | Purpose |
|-------|--------|--------|---------|
| `/auth/magic/send` | POST | `emailAuthPlugin()` | Send magic link email |
| `/auth/magic/callback` | GET | `emailAuthPlugin()` | Verify magic link token |
| `/auth/oauth/google/start` | GET | `oauthPlugin()` | Start Google OAuth flow |
| `/auth/oauth/google/callback` | GET | `oauthPlugin()` | Handle Google callback |
| `/auth/oauth/github/start` | GET | `oauthPlugin()` | Start GitHub OAuth flow |
| `/auth/oauth/github/callback` | GET | `oauthPlugin()` | Handle GitHub callback |
| `/auth/oauth/microsoft/start` | GET | `oauthPlugin()` | Start Microsoft OAuth flow |
| `/auth/oauth/microsoft/callback` | GET | `oauthPlugin()` | Handle Microsoft callback |
| `/auth/credentials/login` | POST | `credentialsPlugin()` | Email/password login |
| `/auth/credentials/logout` | POST | `credentialsPlugin()` | Sign out |

---

## Migration Guide (v1 → v2)

### Before (v1)
```typescript
import { auth } from 'kuratchi-sdk';

export const handle = auth.handle({
  kvNamespaces: { default: 'MY_KV' },
  guards: [requireAuth({ pattern: '/admin/*' })]
});
```

### After (v2 - Recommended)
```typescript
import { 
  createAuthHandle, 
  sessionPlugin,
  storagePlugin,
  guardsPlugin,
  requireAuth 
} from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    storagePlugin({ kv: { default: 'MY_KV' } }),
    guardsPlugin({
      guards: [requireAuth({ pattern: '/admin/*' })]
    })
  ]
});
```

**Benefits of migrating:**
- Smaller bundle (only load what you need)
- Better testability (isolated plugins)
- More extensible (custom plugins)
- Clearer dependencies (explicit plugins)

---

## Troubleshooting

### "No platform environment available"
- Ensure you're running with `wrangler dev` or deployed to Workers
- Check that `wrangler.toml` has the correct bindings

### "Admin DB not configured"
- Set `KURATCHI_ADMIN_DB_TOKEN` and `CLOUDFLARE_WORKERS_SUBDOMAIN`
- Run `init-admin-db` CLI command first

### "No database found for organization"
- Ensure `adminPlugin()` is loaded before `organizationPlugin()`
- Check that organization exists in admin DB
- Verify `KURATCHI_GATEWAY_KEY` is set

### Storage bindings not working
- Verify binding names match `wrangler.toml`
- Check that storage plugin is configured correctly
- Use dev tools to inspect `locals.kuratchi.kv/r2/d1`

---

## Best Practices

1. **Use plugins for clarity**: Be explicit about what features you need
2. **Order matters**: Admin plugin before organization plugin
3. **Test in isolation**: Test plugins independently
4. **Guard early**: Put authentication guards before other plugins
5. **Custom plugins**: Create plugins for reusable middleware logic
6. **Environment variables**: Use descriptive names, document them
7. **Error handling**: Always check if DB clients are available before using

---

## Next Steps

- [Storage Guide](./storage.md) - Learn about KV, R2, D1 helpers
- [ORM Guide](./orm.md) - Database queries and migrations
- [Durable Objects](./do.md) - Multi-tenant database architecture
- [CLI Reference](./cli.md) - Admin database setup commands
