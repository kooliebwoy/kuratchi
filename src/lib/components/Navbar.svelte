<script lang="ts">
  export let showDocsDrawer = false;
</script>

<div class="navbar bg-base-100 border-b border-base-300 sticky top-0 z-50 backdrop-blur-lg bg-base-100/80">
  <div class="container mx-auto flex items-center justify-between">
    <div class="flex items-center gap-2">
      {#if showDocsDrawer}
        <label for="docs-drawer" class="btn btn-square btn-ghost lg:hidden">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-6 h-6 stroke-current">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </label>
      {:else}
        <div class="dropdown lg:hidden">
          <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
          <!-- svelte-ignore a11y-label-has-associated-control -->
          <label tabindex="0" class="btn btn-square btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-6 h-6 stroke-current">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </label>
          <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
          <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-200 rounded-box w-52">
            <li><a href="/docs">Documentation</a></li>
            <li><a href="https://github.com/kooliebwoy/kuratchi-sdk" target="_blank">GitHub</a></li>
          </ul>
        </div>
      {/if}
      <a href="/" class="btn btn-ghost px-0">
        <span class="text-2xl font-black tracking-tight text-primary">Kuratchi</span>
        <span class="badge badge-ghost badge-sm ml-2 text-base-content/60">{showDocsDrawer ? 'Docs' : 'SDK included'}</span>
      </a>
    </div>
    <div class="flex items-center gap-4 text-sm hidden lg:flex">
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
