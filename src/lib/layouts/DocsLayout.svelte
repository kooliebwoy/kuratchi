<script lang="ts">
  import "../../app.css";
</script>

<div class="min-h-screen bg-base-100">
  <!-- Navigation -->
  <div class="navbar bg-base-100 border-b border-base-300">
    <div class="container mx-auto">
      <div class="flex-1">
        <a href="/" class="btn btn-ghost text-xl font-bold">
          <span class="text-primary">Kuratchi</span>
          <span class="text-base-content">SDK</span>
        </a>
      </div>
      <div class="flex-none">
        <ul class="menu menu-horizontal px-1">
          <li><a href="/docs">Documentation</a></li>
          <li><a href="https://github.com/kooliebwoy/kuratchi-sdk" target="_blank">GitHub</a></li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Documentation Content -->
  <div class="container mx-auto px-4 py-12">
    <div class="max-w-4xl mx-auto">
      <article class="prose prose-lg max-w-none">
        <slot />
      </article>
    </div>
  </div>

  <!-- Footer -->
  <footer class="footer footer-center p-10 bg-base-200 text-base-content mt-20">
    <aside>
      <p class="font-bold text-lg">Kuratchi SDK</p>
      <p>Batteries-included SvelteKit + Cloudflare Workers</p>
    </aside>
    <nav>
      <div class="grid grid-flow-col gap-4">
        <a href="https://github.com/kooliebwoy/kuratchi-sdk" target="_blank" class="link link-hover">GitHub</a>
        <a href="/" class="link link-hover">Home</a>
        <a href="/docs" class="link link-hover">Docs Home</a>
      </div>
    </nav>
  </footer>
</div>

<style>
  :global(.prose) {
    @apply text-base-content;
  }
  
  :global(.prose h1) {
    @apply text-4xl font-bold mb-6 text-base-content;
  }
  
  :global(.prose h2) {
    @apply text-3xl font-bold mt-12 mb-4 text-base-content;
  }
  
  :global(.prose h3) {
    @apply text-2xl font-bold mt-8 mb-3 text-base-content;
  }
  
  :global(.prose p) {
    @apply mb-4 leading-relaxed;
  }
  
  :global(.prose a) {
    @apply text-primary hover:underline;
  }
  
  :global(.prose code) {
    @apply bg-base-200 px-2 py-1 rounded text-sm;
  }
  
  :global(.prose pre) {
    @apply bg-base-200 p-4 rounded-lg overflow-x-auto mb-4;
  }
  
  :global(.prose pre code) {
    @apply bg-transparent p-0;
  }
  
  :global(.prose ul) {
    @apply list-disc list-inside mb-4 space-y-2;
  }
  
  :global(.prose ol) {
    @apply list-decimal list-inside mb-4 space-y-2;
  }
  
  :global(.prose blockquote) {
    @apply border-l-4 border-primary pl-4 italic my-4;
  }
  
  :global(.prose table) {
    @apply w-full border-collapse mb-4;
  }
  
  :global(.prose th) {
    @apply bg-base-200 p-2 text-left font-bold;
  }
  
  :global(.prose td) {
    @apply border border-base-300 p-2;
  }
</style>
