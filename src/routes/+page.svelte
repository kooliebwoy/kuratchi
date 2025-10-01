<script lang="ts">
  import "../app.css";
</script>

<div class="min-h-screen bg-base-100">
  <!-- Navigation -->
  <div class="navbar bg-base-100 border-b border-base-300">
    <div class="container mx-auto flex items-center justify-between">
      <a href="/" class="btn btn-ghost px-0">
        <span class="text-2xl font-black tracking-tight text-primary">Kuratchi</span>
        <span class="badge badge-ghost badge-sm ml-2 text-base-content/60">SDK included</span>
      </a>
      <div class="flex items-center gap-4 text-sm">
        <a href="/docs" class="px-3 py-2 hover:text-primary">Docs</a>
        <a href="https://github.com/kooliebwoy/kuratchi-sdk" target="_blank" class="px-3 py-2 flex items-center gap-2 hover:text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub
        </a>
      </div>

<style>
  .shiki-wrapper :global(pre) {
    margin: 0;
    padding: 1.25rem;
    border-radius: 0.75rem;
    background: linear-gradient(135deg, #1a1b26 0%, #0f172a 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 10px 30px -15px rgba(8, 47, 73, 0.6);
  }

  .shiki-wrapper :global(code) {
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular,
      Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
  }

  .shiki-wrapper :global(.line) {
    display: block;
  }
</style>
    </div>
  </div>

  <!-- Hero Section -->
  <div class="hero min-h-[70vh] bg-gradient-to-br from-base-100 to-base-200">
    <div class="hero-content text-center">
      <div class="max-w-3xl space-y-8">
        <div class="space-y-3">
          <span class="badge badge-primary badge-outline">SvelteKit · Cloudflare Workers</span>
          <h1 class="text-5xl md:text-6xl font-bold text-base-content">
            Build with Kuratchi
          </h1>
          <p class="text-lg md:text-xl text-base-content/80">
            Opinionated tooling for teams who want authentication, database access, storage, and deployment to just work on Cloudflare Workers—without fighting boilerplate.
          </p>
        </div>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/docs" class="btn btn-primary btn-lg">
            Explore Documentation
          </a>
          <a href="https://github.com/kooliebwoy/kuratchi-sdk" target="_blank" class="btn btn-outline btn-lg">
            Star on GitHub
          </a>
        </div>
        <div class="mockup-code bg-base-300 shadow-xl max-w-2xl mx-auto">
          <pre data-prefix="$"><code>npm install kuratchi-sdk</code></pre>
          <pre data-prefix="$"><code>npx kuratchi admin create</code></pre>
          <pre data-prefix="$"><code>npm run dev</code></pre>
        </div>
      </div>
    </div>
  </div>

  <!-- Features Section -->
  <div class="py-20 bg-base-100">
    <div class="container mx-auto px-4 space-y-12">
      <div class="text-center space-y-3">
        <h2 class="text-4xl font-bold text-base-content">Everything you need to ship fast</h2>
        <p class="text-base-content/70 max-w-2xl mx-auto">
          Kuratchi packages the patterns we use in production: opinionated auth flows, type-safe data access, and Cloudflare-native storage with a DX that feels like SvelteKit.
        </p>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="card bg-base-200 shadow-sm border border-base-300/40">
          <div class="card-body">
            <h3 class="card-title text-base-content">🔐 Authentication</h3>
            <p class="text-base-content/80">Magic links, OAuth, and credentials. Sessions, cookies, and guards are wired up for you.</p>
          </div>
        </div>
        <div class="card bg-base-200 shadow-sm border border-base-300/40">
          <div class="card-body">
            <h3 class="card-title text-base-content">📊 Database & ORM</h3>
            <p class="text-base-content/80">Schema-first ORM for D1 with automatic migrations, typed queries, and multi-tenant helpers.</p>
          </div>
        </div>
        <div class="card bg-base-200 shadow-sm border border-base-300/40">
          <div class="card-body">
            <h3 class="card-title text-base-content">💿 Storage & DOs</h3>
            <p class="text-base-content/80">KV, R2, and Durable Objects available on `locals` with the same batteries-included approach.</p>
          </div>
        </div>
        <div class="card bg-base-200 shadow-sm border border-base-300/40">
          <div class="card-body">
            <h3 class="card-title text-base-content">🛠️ CLI & Tooling</h3>
            <p class="text-base-content/80">One command to bootstrap admin databases, scaffold migrations, and inspect your Workers runtime.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Code Example Section -->
  <div class="py-20 bg-base-200">
    <div class="container mx-auto px-4 space-y-12">
      <div class="text-center space-y-3">
        <h2 class="text-3xl md:text-4xl font-bold text-base-content">Zero-to-production in a few files</h2>
        <p class="text-base-content/70 max-w-2xl mx-auto">Kuratchi plugs directly into SvelteKit hooks, gives you typed database clients, and exposes Cloudflare primitives through `locals`.</p>
      </div>

      <div class="grid lg:grid-cols-3 gap-6">
        <div class="card bg-base-100 shadow-sm border border-base-300/40">
          <div class="card-body">
            <h3 class="card-title text-base-content">Auth handle</h3>
            <div class="mockup-code bg-base-300 text-xs">
              <pre data-prefix=""><code>// src/hooks.server.ts</code></pre>
              <pre data-prefix=""><code>import &#123;</code></pre>
              <pre data-prefix=""><code>  createAuthHandle,</code></pre>
              <pre data-prefix=""><code>  sessionPlugin,</code></pre>
              <pre data-prefix=""><code>  emailAuthPlugin</code></pre>
              <pre data-prefix=""><code>&#125; from 'kuratchi-sdk/auth';</code></pre>
              <pre data-prefix=""><code></code></pre>
              <pre data-prefix=""><code>export const handle = createAuthHandle(&#123;</code></pre>
              <pre data-prefix=""><code>  plugins: [</code></pre>
              <pre data-prefix=""><code>    sessionPlugin(),</code></pre>
              <pre data-prefix=""><code>    emailAuthPlugin(&#123; provider: 'resend' &#125;)</code></pre>
              <pre data-prefix=""><code>  ]</code></pre>
              <pre data-prefix=""><code>&#125;);</code></pre>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm border border-base-300/40">
          <div class="card-body">
            <h3 class="card-title text-base-content">Schema + ORM</h3>
            <div class="mockup-code bg-base-300 text-xs">
              <pre data-prefix=""><code>// src/lib/schema/app.ts</code></pre>
              <pre data-prefix=""><code>export const appSchema = &#123;</code></pre>
              <pre data-prefix=""><code>  name: 'app',</code></pre>
              <pre data-prefix=""><code>  version: 1,</code></pre>
              <pre data-prefix=""><code>  tables: &#123;</code></pre>
              <pre data-prefix=""><code>    users: &#123;</code></pre>
              <pre data-prefix=""><code>      id: 'text primary key',</code></pre>
              <pre data-prefix=""><code>      email: 'text not null unique',</code></pre>
              <pre data-prefix=""><code>      name: 'text'</code></pre>
              <pre data-prefix=""><code>    &#125;</code></pre>
              <pre data-prefix=""><code>  &#125;</code></pre>
              <pre data-prefix=""><code>&#125;;</code></pre>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm border border-base-300/40">
          <div class="card-body">
            <h3 class="card-title text-base-content">Page load</h3>
            <div class="mockup-code bg-base-300 text-xs">
              <pre data-prefix=""><code>// src/routes/+page.server.ts</code></pre>
              <pre data-prefix=""><code>import &#123; d1 &#125; from 'kuratchi-sdk';</code></pre>
              <pre data-prefix=""><code>import &#123; appSchema &#125; from '$lib/schema/app';</code></pre>
              <pre data-prefix=""><code></code></pre>
              <pre data-prefix=""><code>export async function load() &#123;</code></pre>
              <pre data-prefix=""><code>  const orm = await d1.client('MY_DB', appSchema);</code></pre>
              <pre data-prefix=""><code>  const users = await orm.users</code></pre>
              <pre data-prefix=""><code>    .where(&#123; active: true &#125;)</code></pre>
              <pre data-prefix=""><code>    .orderBy('created_at', 'desc')</code></pre>
              <pre data-prefix=""><code>    .limit(10)</code></pre>
              <pre data-prefix=""><code>    .many();</code></pre>
              <pre data-prefix=""><code></code></pre>
              <pre data-prefix=""><code>  return &#123; users: users.data ?? [] &#125;;</code></pre>
              <pre data-prefix=""><code>&#125;</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- CTA Section -->
  <div class="py-16 bg-base-100 border-t border-base-300">
    <div class="container mx-auto px-4 text-center space-y-6">
      <h2 class="text-3xl md:text-4xl font-semibold text-base-content">Opinionated by design. Built for SvelteKit on Workers.</h2>
      <p class="text-base-content/70 max-w-2xl mx-auto">Kuratchi stays focused on the stack we know best so you can spend more time shipping features instead of wiring infrastructure.</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/docs/getting-started" class="btn btn-lg btn-primary">
          Start Building
        </a>
        <a href="https://github.com/kooliebwoy/kuratchi-sdk" target="_blank" class="btn btn-lg btn-outline">
          Star on GitHub
        </a>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="footer footer-center p-10 bg-base-200 text-base-content">
    <aside>
      <p class="font-bold text-lg">
        Kuratchi
      </p>
      <p>Batteries-included SvelteKit + Cloudflare Workers</p>
      <p class="text-sm opacity-70">Built with ❤️ for the modern web</p>
    </aside>
    <nav>
      <div class="grid grid-flow-col gap-4">
        <a href="https://github.com/kooliebwoy/kuratchi-sdk" target="_blank" class="link link-hover">GitHub</a>
        <a href="/docs" class="link link-hover">Documentation</a>
        <a href="/docs/cli" class="link link-hover">CLI</a>
        <a href="/docs/api" class="link link-hover">API Reference</a>
      </div>
    </nav>
  </footer>
</div>
