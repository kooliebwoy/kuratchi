<script lang="ts">
  import { Database, Zap, Code2, Lock, Globe, GitBranch, Github } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Kuratchi - Open Source Backend Platform for SvelteKit & Cloudflare</title>
  <meta name="description" content="The open-source backend platform built for speed. Database, Auth, Storage - all optimized for SvelteKit and Cloudflare Workers." />
</svelte:head>

<div class="min-h-screen">
  <!-- Navbar -->
  <nav class="navbar bg-base-100 border-b border-base-300">
    <div class="navbar-start">
      <a href="/" class="btn btn-ghost text-xl font-bold">
        <Database class="w-6 h-6" />
        Kuratchi
      </a>
    </div>
    <div class="navbar-center hidden lg:flex">
      <ul class="menu menu-horizontal px-1">
        <li><a href="#features">Features</a></li>
        <li><a href="#why">Why Kuratchi</a></li>
        <li><a href="https://github.com/kuratchi/kuratchi" target="_blank" rel="noopener">GitHub</a></li>
      </ul>
    </div>
    <div class="navbar-end gap-2">
      <a href="https://github.com/kuratchi/kuratchi" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
        <Github class="w-5 h-5" />
        Star on GitHub
      </a>
      <a href="/auth/start" class="btn btn-primary btn-sm">Get Started</a>
    </div>
  </nav>

  <!-- Hero Section -->
  <section class="hero min-h-[80vh] bg-gradient-to-br from-primary/5 via-base-100 to-secondary/5">
    <div class="hero-content text-center max-w-5xl">
      <div>
        <div class="inline-block mb-4">
          <div class="badge badge-primary badge-lg">Coming Soon • Open Source • Free Forever</div>
        </div>
        
        <h1 class="text-5xl md:text-7xl font-black mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Build Faster with<br />Kuratchi
        </h1>
        
        <p class="text-xl md:text-2xl mb-8 text-base-content/80 max-w-3xl mx-auto">
          The open-source backend platform built for <span class="font-bold text-primary">SvelteKit</span> and <span class="font-bold text-secondary">Cloudflare Workers</span>. 
          Database, Auth, and Storage—all optimized for edge performance.
        </p>
        
        <div class="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <a href="/auth/start" class="btn btn-primary btn-lg">
            Start Building
            <Zap class="w-5 h-5" />
          </a>
          <a href="https://github.com/kuratchi/kuratchi" target="_blank" rel="noopener" class="btn btn-outline btn-lg">
            <Github class="w-5 h-5" />
            View on GitHub
          </a>
        </div>

        <div class="stats stats-horizontal shadow-lg bg-base-200">
          <div class="stat place-items-center">
            <div class="stat-title">Open Source</div>
            <div class="stat-value text-primary">100%</div>
            <div class="stat-desc">MIT Licensed</div>
          </div>
          
          <div class="stat place-items-center">
            <div class="stat-title">SDK</div>
            <div class="stat-value text-secondary">Free</div>
            <div class="stat-desc">Always will be</div>
          </div>
          
          <div class="stat place-items-center">
            <div class="stat-title">Built with</div>
            <div class="stat-value text-accent">Svelte 5</div>
            <div class="stat-desc">Modern stack</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section id="features" class="py-20 bg-base-200">
    <div class="container mx-auto px-4 max-w-6xl">
      <div class="text-center mb-16">
        <h2 class="text-4xl md:text-5xl font-black mb-4">Everything You Need</h2>
        <p class="text-xl text-base-content/70">Powerful features built for modern web development</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <!-- Feature 1: Database -->
        <div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
          <div class="card-body">
            <div class="bg-primary/10 rounded-lg p-3 w-fit">
              <Database class="w-8 h-8 text-primary" />
            </div>
            <h3 class="card-title">Edge Database</h3>
            <p>Cloudflare D1 powered databases with type-safe ORM. Define schemas, run migrations, and query with full TypeScript support.</p>
          </div>
        </div>

        <!-- Feature 2: Auth -->
        <div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
          <div class="card-body">
            <div class="bg-secondary/10 rounded-lg p-3 w-fit">
              <Lock class="w-8 h-8 text-secondary" />
            </div>
            <h3 class="card-title">Authentication</h3>
            <p>Built-in auth with sessions, OAuth providers, magic links, and role-based access control. Security by default.</p>
          </div>
        </div>

        <!-- Feature 3: Edge Performance -->
        <div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
          <div class="card-body">
            <div class="bg-accent/10 rounded-lg p-3 w-fit">
              <Zap class="w-8 h-8 text-accent" />
            </div>
            <h3 class="card-title">Edge First</h3>
            <p>Deploy globally on Cloudflare Workers. Sub-10ms response times from any location in the world.</p>
          </div>
        </div>

        <!-- Feature 4: Type Safety -->
        <div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
          <div class="card-body">
            <div class="bg-primary/10 rounded-lg p-3 w-fit">
              <Code2 class="w-8 h-8 text-primary" />
            </div>
            <h3 class="card-title">Type Safe SDK</h3>
            <p>Full TypeScript support with generated types from your schemas. Autocomplete everywhere.</p>
          </div>
        </div>

        <!-- Feature 5: SvelteKit Native -->
        <div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
          <div class="card-body">
            <div class="bg-secondary/10 rounded-lg p-3 w-fit">
              <Globe class="w-8 h-8 text-secondary" />
            </div>
            <h3 class="card-title">SvelteKit Native</h3>
            <p>Built specifically for SvelteKit. Hooks, load functions, and form actions work seamlessly.</p>
          </div>
        </div>

        <!-- Feature 6: Open Source -->
        <div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
          <div class="card-body">
            <div class="bg-accent/10 rounded-lg p-3 w-fit">
              <GitBranch class="w-8 h-8 text-accent" />
            </div>
            <h3 class="card-title">Open Source</h3>
            <p>MIT licensed. Inspect the code, contribute, or self-host. You own your data and infrastructure.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Why Kuratchi Section -->
  <section id="why" class="py-20 bg-base-100">
    <div class="container mx-auto px-4 max-w-4xl">
      <div class="text-center mb-16">
        <h2 class="text-4xl md:text-5xl font-black mb-4">Why We're Building This</h2>
        <p class="text-xl text-base-content/70">Fast, transparent, and dogfooded</p>
      </div>

      <div class="space-y-6">
        <div class="card bg-base-200 shadow-xl">
          <div class="card-body">
            <h3 class="card-title text-2xl">🚀 We're Building Fast</h3>
            <p class="text-lg">
              We believe in shipping quickly and iterating based on real usage. New features, bug fixes, and improvements land constantly.
            </p>
          </div>
        </div>

        <div class="card bg-base-200 shadow-xl">
          <div class="card-body">
            <h3 class="card-title text-2xl">🍽️ We Dogfood Everything</h3>
            <p class="text-lg">
              This entire platform runs on Kuratchi. Our dashboard, authentication, database management—all built with our own SDK. If it's not good enough for us, it's not good enough for you.
            </p>
          </div>
        </div>

        <div class="card bg-base-200 shadow-xl">
          <div class="card-body">
            <h3 class="card-title text-2xl">💎 Open Source Forever</h3>
            <p class="text-lg">
              The SDK is free and always will be. MIT licensed, transparent development, and community-driven. No vendor lock-in, no surprises.
            </p>
          </div>
        </div>

        <div class="card bg-base-200 shadow-xl">
          <div class="card-body">
            <h3 class="card-title text-2xl">⚡ Built for the Edge</h3>
            <p class="text-lg">
              Why compromise? Cloudflare Workers + D1 + SvelteKit = the fastest full-stack development experience. Period.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="py-20 bg-gradient-to-br from-primary to-secondary text-primary-content">
    <div class="container mx-auto px-4 text-center max-w-3xl">
      <h2 class="text-4xl md:text-5xl font-black mb-6">Ready to Build?</h2>
      <p class="text-xl mb-8 opacity-90">
        Join us in building the future of backend development. Open source, free, and blazing fast.
      </p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/auth/start" class="btn btn-neutral btn-lg">
          Get Started Now
          <Zap class="w-5 h-5" />
        </a>
        <a href="https://github.com/kuratchi/kuratchi" target="_blank" rel="noopener" class="btn btn-outline btn-lg text-white border-white hover:bg-white hover:text-primary">
          <Github class="w-5 h-5" />
          Star on GitHub
        </a>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="footer footer-center p-10 bg-base-200 text-base-content">
    <aside>
      <div class="flex items-center gap-2 text-2xl font-bold">
        <Database class="w-8 h-8" />
        <span>Kuratchi</span>
      </div>
      <p class="font-medium">Open Source Backend Platform</p>
      <p>Built with 💚 for SvelteKit & Cloudflare Workers</p>
    </aside>
    <nav>
      <div class="grid grid-flow-col gap-4">
        <a href="https://github.com/kuratchi/kuratchi" target="_blank" rel="noopener" class="link link-hover">GitHub</a>
        <a href="https://discord.gg/kuratchi" class="link link-hover">Discord</a>
        <a href="/docs" class="link link-hover">Docs</a>
      </div>
    </nav>
  </footer>
</div>
