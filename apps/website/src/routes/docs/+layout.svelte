<script lang="ts">
  import { docNav } from '$lib/docs';
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>Kuratchi Docs</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 text-gray-900">
  <header class="border-b border-gray-200 bg-white/80 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
      <a href="/" class="text-lg font-semibold text-gray-900 hover:text-blue-600">Kuratchi</a>
      <nav class="flex items-center gap-4 text-sm font-medium text-gray-600">
        {#each docNav as link}
          <a
            href={link.href}
            class={`rounded-md px-3 py-2 transition-colors hover:bg-blue-50 hover:text-blue-700 ${
              $page.url.pathname === link.href ? 'bg-blue-50 text-blue-700' : ''
            }`}
          >
            {link.label}
          </a>
        {/each}
      </nav>
    </div>
  </header>

  <main class="mx-auto max-w-5xl px-6 py-10">
    <slot />
  </main>
</div>
