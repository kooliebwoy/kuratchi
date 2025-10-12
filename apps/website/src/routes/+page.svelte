<script lang="ts">
  import { Database, Zap, Lock, Globe, GitBranch, Github, Code } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Kuratchi - Open Source Backend Platform for SvelteKit & Cloudflare</title>
  <meta name="description" content="The open-source backend platform built for speed. Database, Auth, Storage - all optimized for SvelteKit and Cloudflare Workers." />
</svelte:head>

<div class="min-h-screen bg-white">
  <!-- Navbar -->
  <nav class="bg-white border-b border-gray-100">
    <div class="max-w-7xl mx-auto px-6 py-4">
      <div class="flex items-center justify-between">
        <a href="/" class="flex items-center gap-2 text-xl font-bold text-gray-900 hover:text-gray-700 transition-colors">
          <Database class="w-6 h-6" />
          Kuratchi
        </a>
        
        <div class="hidden md:flex items-center gap-8">
          <a href="#features" class="text-gray-600 hover:text-gray-900 transition-colors font-medium">Features</a>
          <a href="#why" class="text-gray-600 hover:text-gray-900 transition-colors font-medium">Why Kuratchi</a>
          <a href="https://github.com/kooliebwoy/kuratchi" target="_blank" rel="noopener" class="text-gray-600 hover:text-gray-900 transition-colors font-medium">GitHub</a>
        </div>
        
        <div class="flex items-center gap-3">
          <a href="https://github.com/kooliebwoy/kuratchi" target="_blank" rel="noopener" class="hidden sm:flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors">
            <Github class="w-5 h-5" />
            <span class="font-medium">Star</span>
          </a>
          <a href="/auth/start" class="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            Get Started
          </a>
        </div>
      </div>
    </div>
  </nav>

  <!-- Hero Section -->
  <section class="bg-white pt-20 pb-24">
    <div class="max-w-7xl mx-auto px-6">
      <div class="text-center max-w-4xl mx-auto">
        <div class="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium mb-8">
          <span>Coming Soon</span>
          <span class="text-blue-400">•</span>
          <span>Open Source</span>
          <span class="text-blue-400">•</span>
          <span>Free Forever</span>
        </div>
        
        <h1 class="text-5xl md:text-7xl font-black mb-6 text-gray-900 leading-tight">
          Build Faster with<br />
          <span class="text-blue-600">Kuratchi</span>
        </h1>
        
        <p class="text-xl md:text-2xl mb-10 text-gray-600 max-w-3xl mx-auto leading-relaxed">
          The open-source backend platform built for SvelteKit and Cloudflare Workers. 
          Database, Auth, and Storage, using D1, DOs, KV, and R2.
        </p>
        
        <div class="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <a href="/auth/start" class="flex items-center gap-2 px-7 py-3.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg">
            Get Started
            <Zap class="w-5 h-5" />
          </a>
          <a href="https://github.com/kooliebwoy/kuratchi" target="_blank" rel="noopener" class="flex items-center gap-2 px-7 py-3.5 border-2 border-gray-200 text-gray-700 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors font-semibold text-lg">
            <Github class="w-5 h-5" />
            View on GitHub
          </a>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
          <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <div class="text-sm text-gray-500 font-medium mb-2">Open Source</div>
            <div class="text-4xl font-bold text-blue-600 mb-1">100%</div>
            <div class="text-sm text-gray-600">Self Hosted</div>
          </div>
          
          <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <div class="text-sm text-gray-500 font-medium mb-2">SDK</div>
            <div class="text-4xl font-bold text-blue-600 mb-1">Free</div>
            <div class="text-sm text-gray-600">Always will be</div>
          </div>
          
          <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <div class="text-sm text-gray-500 font-medium mb-2">Built with</div>
            <div class="text-4xl font-bold text-blue-600 mb-1">Svelte 5</div>
            <div class="text-sm text-gray-600">Remote functions</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Code Examples Section -->
  <section class="py-24 bg-white">
    <div class="max-w-7xl mx-auto px-6">
      <div class="text-center mb-16">
        <h2 class="text-4xl md:text-5xl font-black mb-4 text-gray-900">Simple to Use</h2>
        <p class="text-xl text-gray-600">Get started in minutes with our intuitive API</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <!-- Setup Example -->
        <div>
          <h3 class="text-lg font-bold text-gray-900 mb-4">🚀 Setup in hooks.server.ts</h3>
          <div class="mockup-code bg-gray-900 text-sm">
            <pre data-prefix="1"><code class="text-blue-400">import</code> <code class="text-gray-300">{'{ kuratchi }'}</code> <code class="text-blue-400">from</code> <code class="text-green-400">'kuratchi-sdk'</code><code class="text-gray-300">;</code></pre>
            <pre data-prefix="2"><code class="text-blue-400">import</code> <code class="text-gray-300">{'{'}</code></pre>
            <pre data-prefix="3"><code class="text-gray-300">  sessionPlugin,</code></pre>
            <pre data-prefix="4"><code class="text-gray-300">  adminPlugin,</code></pre>
            <pre data-prefix="5"><code class="text-gray-300">  emailAuthPlugin</code></pre>
            <pre data-prefix="6"><code class="text-gray-300">{'}'} </code><code class="text-blue-400">from</code> <code class="text-green-400">'kuratchi-sdk/auth'</code><code class="text-gray-300">;</code></pre>
            <pre data-prefix="7"><code class="text-gray-300"></code></pre>
            <pre data-prefix="8"><code class="text-blue-400">const</code> <code class="text-yellow-300">app</code> <code class="text-gray-300">= </code><code class="text-yellow-300">kuratchi</code><code class="text-gray-300">({"{"}</code></pre>
            <pre data-prefix="9"><code class="text-gray-300">  auth: {"{"}</code></pre>
            <pre data-prefix="10"><code class="text-gray-300">    plugins: [</code></pre>
            <pre data-prefix="11"><code class="text-gray-300">      </code><code class="text-yellow-300">sessionPlugin</code><code class="text-gray-300">(),</code></pre>
            <pre data-prefix="12"><code class="text-gray-300">      </code><code class="text-yellow-300">adminPlugin</code><code class="text-gray-300">(),</code></pre>
            <pre data-prefix="13"><code class="text-gray-300">      </code><code class="text-yellow-300">emailAuthPlugin</code><code class="text-gray-300">({"{ ... }"})</code></pre>
            <pre data-prefix="14"><code class="text-gray-300">    ]</code></pre>
            <pre data-prefix="15"><code class="text-gray-300">  {"}"}</code></pre>
            <pre data-prefix="16"><code class="text-gray-300">{"}"});</code></pre>
            <pre data-prefix="17"><code class="text-gray-300"></code></pre>
            <pre data-prefix="18"><code class="text-blue-400">export</code> <code class="text-blue-400">const</code> <code class="text-yellow-300">handle</code> <code class="text-gray-300">= </code><code class="text-yellow-300">app</code><code class="text-gray-300">.handle;</code></pre>
          </div>
        </div>

        <!-- Type-Safe Queries -->
        <div>
          <h3 class="text-lg font-bold text-gray-900 mb-4">🎯 Minimal ORM Included</h3>
          <div class="mockup-code bg-gray-900 text-sm">
            <pre data-prefix="1"><code class="text-gray-500">// Get minimal ORM client</code></pre>
            <pre data-prefix="2"><code class="text-blue-400">const</code> <code class="text-yellow-300">db</code> <code class="text-gray-300">= </code><code class="text-blue-400">await</code> <code class="text-yellow-300">locals</code><code class="text-gray-300">.kuratchi</code></pre>
            <pre data-prefix="3"><code class="text-gray-300">  .</code><code class="text-yellow-300">orgDatabaseClient</code><code class="text-gray-300">();</code></pre>
            <pre data-prefix="4"><code class="text-gray-300"></code></pre>
            <pre data-prefix="5"><code class="text-gray-500">// Query with relationships</code></pre>
            <pre data-prefix="6"><code class="text-blue-400">const</code> <code class="text-yellow-300">users</code> <code class="text-gray-300">= </code><code class="text-blue-400">await</code> <code class="text-yellow-300">db</code><code class="text-gray-300">.users</code></pre>
            <pre data-prefix="7"><code class="text-gray-300">  .</code><code class="text-yellow-300">where</code><code class="text-gray-300">({"{"} deleted_at: {"{ is: null }"} {"}"})</code></pre>
            <pre data-prefix="8"><code class="text-gray-300">  .</code><code class="text-yellow-300">include</code><code class="text-gray-300">({"{"} posts: </code><code class="text-blue-400">true</code> <code class="text-gray-300">{"}"})</code></pre>
            <pre data-prefix="9"><code class="text-gray-300">  .</code><code class="text-yellow-300">orderBy</code><code class="text-gray-300">({"{"} created_at: </code><code class="text-green-400">'desc'</code> <code class="text-gray-300">{"}"})</code></pre>
            <pre data-prefix="10"><code class="text-gray-300">  .</code><code class="text-yellow-300">limit</code><code class="text-gray-300">(</code><code class="text-purple-400">20</code><code class="text-gray-300">)</code></pre>
            <pre data-prefix="11"><code class="text-gray-300">  .</code><code class="text-yellow-300">many</code><code class="text-gray-300">();</code></pre>
            <pre data-prefix="12"><code class="text-gray-300"></code></pre>
            <pre data-prefix="13"><code class="text-gray-500">// Full TypeScript autocomplete ✨</code></pre>
          </div>
        </div>
      </div>

      <!-- Load Function Example (Full Width) -->
      <div>
        <h3 class="text-lg font-bold text-gray-900 mb-4">⚡ Use in Your SvelteKit Routes</h3>
        <div class="mockup-code bg-gray-900 text-sm">
          <pre data-prefix="1"><code class="text-gray-500">// src/routes/+page.server.ts</code></pre>
          <pre data-prefix="2"><code class="text-blue-400">export</code> <code class="text-blue-400">const</code> <code class="text-yellow-300">load</code> <code class="text-gray-300">= </code><code class="text-blue-400">async</code> <code class="text-gray-300">({"{ locals }"}) </code><code class="text-blue-400">=></code> <code class="text-gray-300">{"{"}</code></pre>
          <pre data-prefix="3"><code class="text-gray-300">  </code><code class="text-gray-500">// Access authenticated user</code></pre>
          <pre data-prefix="4"><code class="text-gray-300">  </code><code class="text-blue-400">const</code> <code class="text-gray-300">{"{ "}</code><code class="text-yellow-300">kuratchi</code><code class="text-gray-300">, </code><code class="text-yellow-300">session</code> <code class="text-gray-300">{"} = "}</code><code class="text-yellow-300">locals</code><code class="text-gray-300">;</code></pre>
          <pre data-prefix="5"><code class="text-gray-300"></code></pre>
          <pre data-prefix="6"><code class="text-gray-300">  </code><code class="text-gray-500">// Get org database client</code></pre>
          <pre data-prefix="7"><code class="text-gray-300">  </code><code class="text-blue-400">const</code> <code class="text-yellow-300">db</code> <code class="text-gray-300">= </code><code class="text-blue-400">await</code> <code class="text-gray-300">kuratchi.</code><code class="text-yellow-300">orgDatabaseClient</code><code class="text-gray-300">();</code></pre>
          <pre data-prefix="8"><code class="text-gray-300">  </code><code class="text-blue-400">const</code> <code class="text-gray-300">{"{ "}</code><code class="text-yellow-300">data</code> <code class="text-gray-300">{"} = "}</code><code class="text-blue-400">await</code> <code class="text-yellow-300">db</code><code class="text-gray-300">.posts.</code><code class="text-yellow-300">where</code><code class="text-gray-300">({"{ published: true }"}).</code><code class="text-yellow-300">many</code><code class="text-gray-300">();</code></pre>
          <pre data-prefix="9"><code class="text-gray-300"></code></pre>
          <pre data-prefix="10"><code class="text-gray-300">  </code><code class="text-blue-400">return</code> <code class="text-gray-300">{"{ "}</code><code class="text-yellow-300">user</code><code class="text-gray-300">, posts: </code><code class="text-yellow-300">data</code> <code class="text-gray-300">{"}"};</code></pre>
          <pre data-prefix="11"><code class="text-gray-300">{"}"};</code></pre>
        </div>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section id="features" class="py-24 bg-gray-50">
    <div class="max-w-7xl mx-auto px-6">
      <div class="text-center mb-16">
        <h2 class="text-4xl md:text-5xl font-black mb-4 text-gray-900">Everything You Need</h2>
        <p class="text-xl text-gray-600">Powerful features. Batteries included.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <!-- Feature 1: Database -->
        <div class="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-lg transition-shadow">
          <div class="bg-blue-50 rounded-xl p-3 w-fit mb-5">
            <Database class="w-8 h-8 text-blue-600" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Edge Database</h3>
          <p class="text-gray-600 leading-relaxed">Cloudflare D1 powered databases with type-safe ORM. Define schemas, run migrations, and query with full TypeScript support.</p>
        </div>

        <!-- Feature 2: Auth -->
        <div class="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-lg transition-shadow">
          <div class="bg-blue-50 rounded-xl p-3 w-fit mb-5">
            <Lock class="w-8 h-8 text-blue-600" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Authentication</h3>
          <p class="text-gray-600 leading-relaxed">Built-in auth with sessions, OAuth providers, magic links, and role-based access control. Security by default.</p>
        </div>

        <!-- Feature 3: Edge Performance -->
        <div class="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-lg transition-shadow">
          <div class="bg-blue-50 rounded-xl p-3 w-fit mb-5">
            <Zap class="w-8 h-8 text-blue-600" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Edge First</h3>
          <p class="text-gray-600 leading-relaxed">Deploy globally on Cloudflare Workers. Sub-10ms response times from any location in the world.</p>
        </div>

        <!-- Feature 4: Type Safety -->
        <div class="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-lg transition-shadow">
          <div class="bg-blue-50 rounded-xl p-3 w-fit mb-5">
            <Code class="w-8 h-8 text-blue-600" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Type Safe SDK</h3>
          <p class="text-gray-600 leading-relaxed">Full TypeScript support with generated types from your schemas. Autocomplete everywhere.</p>
        </div>

        <!-- Feature 5: SvelteKit Native -->
        <div class="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-lg transition-shadow">
          <div class="bg-blue-50 rounded-xl p-3 w-fit mb-5">
            <Globe class="w-8 h-8 text-blue-600" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">SvelteKit Native</h3>
          <p class="text-gray-600 leading-relaxed">Built specifically for SvelteKit. Hooks, load functions, and form actions work seamlessly.</p>
        </div>

        <!-- Feature 6: Open Source -->
        <div class="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-lg transition-shadow">
          <div class="bg-blue-50 rounded-xl p-3 w-fit mb-5">
            <GitBranch class="w-8 h-8 text-blue-600" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Open Source</h3>
          <p class="text-gray-600 leading-relaxed">MIT licensed. Inspect the code, contribute, or self-host. You own your data and infrastructure.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Why Kuratchi Section -->
  <section id="why" class="py-24 bg-white">
    <div class="max-w-4xl mx-auto px-6">
      <div class="text-center mb-16">
        <h2 class="text-4xl md:text-5xl font-black mb-4 text-gray-900">Why We're Building This</h2>
        <p class="text-xl text-gray-600">Fast, transparent, and dogfooded</p>
      </div>

      <div class="space-y-6">
        <div class="bg-gray-50 rounded-2xl p-8 border border-gray-100">
          <h3 class="text-2xl font-bold mb-3 text-gray-900">🚀 We're Building Fast</h3>
          <p class="text-lg text-gray-600 leading-relaxed">
            We believe in shipping quickly and iterating based on real usage. New features, bug fixes, and improvements land constantly.
          </p>
        </div>

        <div class="bg-gray-50 rounded-2xl p-8 border border-gray-100">
          <h3 class="text-2xl font-bold mb-3 text-gray-900">🍽️ We Dogfood Everything</h3>
          <p class="text-lg text-gray-600 leading-relaxed">
            This entire platform runs on Kuratchi. Our dashboard, authentication, database management—all built with our own SDK. If it's not good enough for us, it's not good enough for you.
          </p>
        </div>

        <div class="bg-gray-50 rounded-2xl p-8 border border-gray-100">
          <h3 class="text-2xl font-bold mb-3 text-gray-900">💎 Open Source Forever</h3>
          <p class="text-lg text-gray-600 leading-relaxed">
            The SDK is free and always will be. MIT licensed, transparent development, and community-driven. No vendor lock-in, no surprises.
          </p>
        </div>

        <div class="bg-gray-50 rounded-2xl p-8 border border-gray-100">
          <h3 class="text-2xl font-bold mb-3 text-gray-900">⚡ Built for the Edge</h3>
          <p class="text-lg text-gray-600 leading-relaxed">
            Why compromise? Cloudflare Workers + D1 + SvelteKit = the fastest full-stack development experience. Period.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="py-16 bg-white border-t border-gray-100">
    <div class="max-w-7xl mx-auto px-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <!-- Brand Column -->
        <div class="md:col-span-1">
          <div class="flex items-center gap-2 text-xl font-bold text-gray-900 mb-4">
            <Database class="w-6 h-6" />
            <span>Kuratchi</span>
          </div>
          <p class="text-gray-600 text-sm leading-relaxed">
            Open Source Backend Platform for SvelteKit & Cloudflare Workers
          </p>
        </div>

        <!-- Product Column -->
        <div>
          <h3 class="font-bold text-gray-900 mb-4">Product</h3>
          <ul class="space-y-3">
            <li><a href="#features" class="text-gray-600 hover:text-gray-900 transition-colors text-sm">Features</a></li>
            <li><a href="#why" class="text-gray-600 hover:text-gray-900 transition-colors text-sm">Why Kuratchi</a></li>
            <li><a href="/docs" class="text-gray-600 hover:text-gray-900 transition-colors text-sm">Documentation</a></li>
          </ul>
        </div>

        <!-- Resources Column -->
        <div>
          <h3 class="font-bold text-gray-900 mb-4">Resources</h3>
          <ul class="space-y-3">
            <li><a href="https://github.com/kooliebwoy/kuratchi" target="_blank" rel="noopener" class="text-gray-600 hover:text-gray-900 transition-colors text-sm">GitHub</a></li>
            <li><a href="https://discord.gg/kuratchi" class="text-gray-600 hover:text-gray-900 transition-colors text-sm">Discord</a></li>
            <li><a href="/docs" class="text-gray-600 hover:text-gray-900 transition-colors text-sm">Guides</a></li>
          </ul>
        </div>

        <!-- Company Column -->
        <div>
          <h3 class="font-bold text-gray-900 mb-4">Company</h3>
          <ul class="space-y-3">
            <li><a href="/about" class="text-gray-600 hover:text-gray-900 transition-colors text-sm">About</a></li>
            <li><a href="/blog" class="text-gray-600 hover:text-gray-900 transition-colors text-sm">Blog</a></li>
            <li><a href="https://github.com/kooliebwoy/kuratchi" target="_blank" rel="noopener" class="text-gray-600 hover:text-gray-900 transition-colors text-sm">Contribute</a></li>
          </ul>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div class="pt-8 border-t border-gray-100">
        <div class="flex flex-col md:flex-row justify-between items-center gap-4">
          <p class="text-gray-500 text-sm">© 2024 Kuratchi. All rights reserved.</p>
          <div class="flex items-center gap-6">
            <a href="/privacy" class="text-gray-500 hover:text-gray-900 transition-colors text-sm">Privacy Policy</a>
            <a href="/terms" class="text-gray-500 hover:text-gray-900 transition-colors text-sm">Terms of Service</a>
          </div>
        </div>
      </div>
    </div>
  </footer>
</div>
