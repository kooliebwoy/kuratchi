<script lang="ts">
  import "../app.css";
  import Navbar from "$lib/components/Navbar.svelte";
</script>

<div class="min-h-screen bg-base-100">
  <Navbar />

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
        <div class="mockup-code bg-base-300 shadow-xl max-w-2xl text-start">
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
            <div class="mockup-code bg-base-300 text-xs before:content-[''] before:block before:h-3 before:w-full before:bg-base-300 before:mb-2 relative">
              <div class="absolute top-3 left-4 flex gap-2">
                <div class="w-3 h-3 rounded-full bg-error"></div>
                <div class="w-3 h-3 rounded-full bg-warning"></div>
                <div class="w-3 h-3 rounded-full bg-success"></div>
              </div>
              <pre data-prefix="" class="mt-4"><code><span class="text-base-content/60">// src/hooks.server.ts</span></code></pre>
              <pre data-prefix=""><code><span class="text-purple-400">import</span> &#123;</code></pre>
              <pre data-prefix=""><code>  createAuthHandle,</code></pre>
              <pre data-prefix=""><code>  sessionPlugin,</code></pre>
              <pre data-prefix=""><code>  emailAuthPlugin</code></pre>
              <pre data-prefix=""><code>&#125; <span class="text-purple-400">from</span> <span class="text-green-400">'kuratchi-sdk/auth'</span>;</code></pre>
              <pre data-prefix=""><code></code></pre>
              <pre data-prefix=""><code><span class="text-purple-400">export const</span> handle = <span class="text-blue-400">createAuthHandle</span>(&#123;</code></pre>
              <pre data-prefix=""><code>  plugins: [</code></pre>
              <pre data-prefix=""><code>    <span class="text-blue-400">sessionPlugin</span>(),</code></pre>
              <pre data-prefix=""><code>    <span class="text-blue-400">emailAuthPlugin</span>(&#123; provider: <span class="text-green-400">'resend'</span> &#125;)</code></pre>
              <pre data-prefix=""><code>  ]</code></pre>
              <pre data-prefix=""><code>&#125;);</code></pre>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm border border-base-300/40">
          <div class="card-body">
            <h3 class="card-title text-base-content">Schema + ORM</h3>
            <div class="mockup-code bg-base-300 text-xs before:content-[''] before:block before:h-3 before:w-full before:bg-base-300 before:mb-2 relative">
              <div class="absolute top-3 left-4 flex gap-2">
                <div class="w-3 h-3 rounded-full bg-error"></div>
                <div class="w-3 h-3 rounded-full bg-warning"></div>
                <div class="w-3 h-3 rounded-full bg-success"></div>
              </div>
              <pre data-prefix="" class="mt-4"><code><span class="text-base-content/60">// src/lib/schema/app.ts</span></code></pre>
              <pre data-prefix=""><code><span class="text-purple-400">export const</span> appSchema = &#123;</code></pre>
              <pre data-prefix=""><code>  name: <span class="text-green-400">'app'</span>,</code></pre>
              <pre data-prefix=""><code>  version: <span class="text-orange-400">1</span>,</code></pre>
              <pre data-prefix=""><code>  tables: &#123;</code></pre>
              <pre data-prefix=""><code>    users: &#123;</code></pre>
              <pre data-prefix=""><code>      id: <span class="text-green-400">'text primary key'</span>,</code></pre>
              <pre data-prefix=""><code>      email: <span class="text-green-400">'text not null unique'</span>,</code></pre>
              <pre data-prefix=""><code>      name: <span class="text-green-400">'text'</span></code></pre>
              <pre data-prefix=""><code>    &#125;</code></pre>
              <pre data-prefix=""><code>  &#125;</code></pre>
              <pre data-prefix=""><code>&#125;;</code></pre>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm border border-base-300/40">
          <div class="card-body">
            <h3 class="card-title text-base-content">Page load</h3>
            <div class="mockup-code bg-base-300 text-xs before:content-[''] before:block before:h-3 before:w-full before:bg-base-300 before:mb-2 relative">
              <div class="absolute top-3 left-4 flex gap-2">
                <div class="w-3 h-3 rounded-full bg-error"></div>
                <div class="w-3 h-3 rounded-full bg-warning"></div>
                <div class="w-3 h-3 rounded-full bg-success"></div>
              </div>
              <pre data-prefix="" class="mt-4"><code><span class="text-base-content/60">// src/routes/+page.server.ts</span></code></pre>
              <pre data-prefix=""><code><span class="text-purple-400">import</span> &#123; d1 &#125; <span class="text-purple-400">from</span> <span class="text-green-400">'kuratchi-sdk'</span>;</code></pre>
              <pre data-prefix=""><code><span class="text-purple-400">import</span> &#123; appSchema &#125; <span class="text-purple-400">from</span> <span class="text-green-400">'$lib/schema/app'</span>;</code></pre>
              <pre data-prefix=""><code></code></pre>
              <pre data-prefix=""><code><span class="text-purple-400">export async function</span> <span class="text-blue-400">load</span>() &#123;</code></pre>
              <pre data-prefix=""><code>  <span class="text-purple-400">const</span> orm = <span class="text-purple-400">await</span> d1.<span class="text-blue-400">client</span>(<span class="text-green-400">'MY_DB'</span>, appSchema);</code></pre>
              <pre data-prefix=""><code>  <span class="text-purple-400">const</span> users = <span class="text-purple-400">await</span> orm.users</code></pre>
              <pre data-prefix=""><code>    .<span class="text-blue-400">where</span>(&#123; active: <span class="text-orange-400">true</span> &#125;)</code></pre>
              <pre data-prefix=""><code>    .<span class="text-blue-400">orderBy</span>(<span class="text-green-400">'created_at'</span>, <span class="text-green-400">'desc'</span>)</code></pre>
              <pre data-prefix=""><code>    .<span class="text-blue-400">limit</span>(<span class="text-orange-400">10</span>)</code></pre>
              <pre data-prefix=""><code>    .<span class="text-blue-400">many</span>();</code></pre>
              <pre data-prefix=""><code></code></pre>
              <pre data-prefix=""><code>  <span class="text-purple-400">return</span> &#123; users: users.data ?? [] &#125;;</code></pre>
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
