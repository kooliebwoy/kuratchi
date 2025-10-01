<script lang="ts">
  import "../../app.css";
</script>

<div class="min-h-screen bg-base-100">
  <!-- Navigation -->
  <div class="navbar bg-base-100 border-b border-base-300 sticky top-0 z-50 backdrop-blur-lg bg-base-100/80">
    <div class="container mx-auto flex items-center justify-between">
      <a href="/" class="btn btn-ghost px-0">
        <span class="text-2xl font-black tracking-tight text-primary">Kuratchi</span>
        <span class="badge badge-ghost badge-sm ml-2 text-base-content/60">Docs</span>
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
    </div>
  </div>

  <!-- Content with Sidebar -->
  <div class="container mx-auto px-4 py-8">
    <div class="flex gap-8">
      <!-- Sidebar -->
      <aside class="w-64 flex-shrink-0 hidden lg:block">
        <div class="sticky top-24">
          <div class="card bg-base-200 shadow-lg">
            <div class="card-body p-4">
              <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Documentation
              </h3>
              <ul class="menu menu-sm p-0 gap-1 w-full min-w-full">
                <li><a href="/docs/getting-started" class="rounded-lg">🚀 Getting Started</a></li>
                
                <!-- Authentication with submenu -->
                <li>
                  <details open>
                    <summary class="rounded-lg">🔐 Authentication</summary>
                    <ul class="ml-2">
                      <li><a href="/docs/auth" class="text-sm">Overview</a></li>
                      <li><a href="/docs/auth/environment" class="text-sm">Environment</a></li>
                      <li>
                        <details>
                          <summary class="text-sm">Providers</summary>
                          <ul class="ml-2">
                            <li><a href="/docs/auth/providers/email" class="text-xs">Email (Magic Links)</a></li>
                            <li><a href="/docs/auth/providers/oauth" class="text-xs">OAuth</a></li>
                            <li><a href="/docs/auth/providers/credentials" class="text-xs">Credentials</a></li>
                          </ul>
                        </details>
                      </li>
                      <li>
                        <details>
                          <summary class="text-sm">Examples</summary>
                          <ul class="ml-2">
                            <li><a href="/docs/auth/examples/simple" class="text-xs">Simple Auth</a></li>
                            <li><a href="/docs/auth/examples/storage" class="text-xs">With Storage</a></li>
                            <li><a href="/docs/auth/examples/multi-tenant" class="text-xs">Multi-tenant</a></li>
                          </ul>
                        </details>
                      </li>
                    </ul>
                  </details>
                </li>
                
                <!-- ORM with submenu -->
                <li>
                  <details>
                    <summary class="rounded-lg">📊 ORM</summary>
                    <ul class="ml-2">
                      <li><a href="/docs/orm" class="text-sm">Overview</a></li>
                      <li><a href="/docs/orm/schema" class="text-sm">Schema Definition</a></li>
                      <li><a href="/docs/orm/queries" class="text-sm">Queries</a></li>
                      <li><a href="/docs/orm/relations" class="text-sm">Relations</a></li>
                      <li><a href="/docs/orm/migrations" class="text-sm">Migrations</a></li>
                    </ul>
                  </details>
                </li>
                
                <!-- Database with submenu -->
                <li>
                  <details>
                    <summary class="rounded-lg">💾 Database</summary>
                    <ul class="ml-2">
                      <li><a href="/docs/database" class="text-sm">Overview</a></li>
                      <li><a href="/docs/database/setup" class="text-sm">Setup</a></li>
                      <li><a href="/docs/database/provisioning" class="text-sm">Provisioning</a></li>
                      <li><a href="/docs/database/clients" class="text-sm">Clients</a></li>
                    </ul>
                  </details>
                </li>
                
                <!-- Storage with submenu -->
                <li>
                  <details>
                    <summary class="rounded-lg">💿 Storage</summary>
                    <ul class="ml-2">
                      <li><a href="/docs/storage/kv" class="text-sm">KV (Key-Value)</a></li>
                      <li><a href="/docs/storage/r2" class="text-sm">R2 (Object Storage)</a></li>
                      <li><a href="/docs/storage/d1" class="text-sm">D1 (SQL)</a></li>
                    </ul>
                  </details>
                </li>
                
                <li><a href="/docs/cli" class="rounded-lg">🛠️ CLI</a></li>
                
                <!-- Studio - Coming Soon -->
                <li>
                  <div class="rounded-lg px-3 py-2 flex items-center justify-between opacity-60 cursor-not-allowed">
                    <span class="flex items-center gap-2">
                      <span>🎨 Studio</span>
                    </span>
                    <span class="badge badge-primary badge-sm">Soon</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 min-w-0">
        <article class="prose prose-lg max-w-none">
          <slot />
        </article>
      </main>
    </div>
  </div>

  <!-- Footer -->
  <footer class="footer footer-center p-10 bg-base-200 text-base-content mt-20">
    <aside>
      <p class="font-bold text-lg">Kuratchi</p>
      <p>Batteries-included SvelteKit + Cloudflare Workers</p>
    </aside>
  </footer>
</div>

<style>
  /* Prose Styling */
  :global(.prose) {
    color: oklch(var(--bc));
    max-width: none;
  }
  
  :global(.prose h1) {
    font-size: 2.5rem;
    font-weight: 800;
    margin-top: 0;
    margin-bottom: 2rem;
    color: oklch(var(--bc));
    line-height: 1.2;
  }
  
  :global(.prose h2) {
    font-size: 2rem;
    font-weight: 700;
    margin-top: 3rem;
    margin-bottom: 1.5rem;
    color: oklch(var(--bc));
    padding-bottom: 0.5rem;
    border-bottom: 2px solid oklch(var(--bc) / 0.1);
  }
  
  :global(.prose h3) {
    font-size: 1.5rem;
    font-weight: 600;
    margin-top: 2rem;
    margin-bottom: 1rem;
    color: oklch(var(--bc));
  }
  
  :global(.prose h4) {
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    color: oklch(var(--bc));
  }
  
  :global(.prose p) {
    margin-bottom: 1.25rem;
    line-height: 1.75;
    color: oklch(var(--bc) / 0.9);
  }
  
  :global(.prose a) {
    color: oklch(var(--p));
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.2s;
  }
  
  :global(.prose a:hover) {
    color: oklch(var(--pf));
  }
  
  :global(.prose strong) {
    font-weight: 600;
    color: oklch(var(--bc));
  }
  
  /* Inline code - using badge style */
  :global(.prose code) {
    background-color: oklch(var(--b2));
    color: oklch(var(--p));
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.9em;
    font-weight: 500;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    border: 1px solid oklch(var(--bc) / 0.1);
  }
  
  /* Code blocks - using DaisyUI mockup-code style (but not for actual mockup-code component) */
  :global(.prose pre:not(.mockup-code pre)) {
    background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
    color: #e5e7eb;
    padding: 1rem;
    border-radius: var(--rounded-box, 1rem);
    overflow-x: auto;
    margin: 1.5rem 0;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  /* Add mockup-code window controls */
  :global(.prose pre:not(.mockup-code pre)::before) {
    content: "";
    position: absolute;
    top: 1rem;
    left: 1rem;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    background-color: #ff5f56;
    box-shadow: 1.5rem 0 0 #ffbd2e, 3rem 0 0 #27c93f;
    z-index: 1;
  }
  
  :global(.prose pre:not(.mockup-code pre) code) {
    display: block;
    background-color: transparent;
    padding: 2.5rem 1rem 1rem 1rem;
    border-radius: 0;
    font-size: 0.875rem;
    line-height: 1.7;
    color: #e5e7eb;
    overflow-x: auto;
    font-family: 'Fira Code', 'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    border: none;
    font-weight: 400;
  }
  
  /* Let mockup-code component work naturally */
  :global(.mockup-code) {
    margin: 1.5rem 0;
  }
  
  /* Syntax highlighting hints */
  :global(.prose pre code .token.comment) {
    color: #6b7280;
  }
  
  :global(.prose pre code .token.string) {
    color: #34d399;
  }
  
  :global(.prose pre code .token.keyword) {
    color: #60a5fa;
  }
  
  :global(.prose ul) {
    list-style-type: disc;
    padding-left: 1.5rem;
    margin: 1.25rem 0;
  }
  
  :global(.prose ul li) {
    margin-bottom: 0.5rem;
    padding-left: 0.5rem;
    color: oklch(var(--bc) / 0.9);
  }
  
  :global(.prose ol) {
    list-style-type: decimal;
    padding-left: 1.5rem;
    margin: 1.25rem 0;
  }
  
  :global(.prose ol li) {
    margin-bottom: 0.5rem;
    padding-left: 0.5rem;
    color: oklch(var(--bc) / 0.9);
  }
  
  :global(.prose blockquote) {
    border-left: 4px solid oklch(var(--p));
    padding-left: 1rem;
    font-style: italic;
    margin: 1.5rem 0;
    color: oklch(var(--bc) / 0.8);
  }
  
  /* Tables */
  :global(.prose table) {
    width: 100%;
    border-collapse: collapse;
    margin: 2rem 0;
    font-size: 0.875rem;
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  }
  
  :global(.prose thead) {
    background: linear-gradient(135deg, oklch(var(--p)) 0%, oklch(var(--pf)) 100%);
  }
  
  :global(.prose th) {
    padding: 1rem 1.25rem;
    text-align: left;
    font-weight: 600;
    color: oklch(var(--pc));
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
  }
  
  :global(.prose tbody) {
    background-color: oklch(var(--b1));
  }
  
  :global(.prose td) {
    border-bottom: 1px solid oklch(var(--bc) / 0.1);
    padding: 1rem 1.25rem;
    color: oklch(var(--bc) / 0.9);
  }
  
  :global(.prose tbody tr:hover) {
    background-color: oklch(var(--b2));
    transition: background-color 0.2s;
  }
  
  :global(.prose tbody tr:last-child td) {
    border-bottom: none;
  }
  
  :global(.prose hr) {
    border: none;
    border-top: 1px solid oklch(var(--bc) / 0.1);
    margin: 2rem 0;
  }
  
  /* Active sidebar link */
  :global(.menu a.active) {
    background-color: oklch(var(--p));
    color: oklch(var(--pc));
  }
</style>
