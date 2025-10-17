<script lang="ts">
  import { Bell, Search, Command, UserCircle, X, Building2 } from 'lucide-svelte';
  import { searchOrganizations, setActiveOrganization, clearOrganization } from '$lib/api/superadmin.remote';
  
  interface Props {
    workspace: string;
    user: { name: string; email: string };
    isSuperadmin?: boolean;
  }
  
  let { workspace, user, isSuperadmin = false }: Props = $props();

  let term = $state('');
  let searchResults = $state<Array<{ id: string; name: string; slug?: string }>>([]);
  let showDropdown = $state(false);
  let isSearching = $state(false);

  let debounceTimer: any;
  function onInput(e: Event) {
    term = (e.target as HTMLInputElement).value;
    clearTimeout(debounceTimer);
    
    if (!term.trim()) {
      searchResults = [];
      showDropdown = false;
      return;
    }
    
    debounceTimer = setTimeout(() => {
      if (term.trim()) {
        // Trigger form submission programmatically
        const form = document.getElementById('org-search-form') as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }
    }, 300);
  }

  // Watch for search form state
  $effect(() => {
    isSearching = !!searchOrganizations.pending;
  });

  // Watch for search results from the form
  $effect(() => {
    if (searchOrganizations.result && !searchOrganizations.pending) {
      searchResults = searchOrganizations.result || [];
      showDropdown = true;
    }
  });

  function handleSwitch() {
    showDropdown = false;
    term = '';
    // Reload to reflect new org context
    window.location.reload();
  }

  function clearSearch() {
    term = '';
    searchResults = [];
    showDropdown = false;
  }
</script>

<header class="flex items-center justify-between border-b border-base-200/60 bg-base-100/60 px-8 py-4 backdrop-blur">
  <div class="flex items-center gap-3">
    <Command class="h-5 w-5" />
    <h2 class="text-lg font-semibold">{workspace}</h2>
  </div>

  <div class="flex items-center gap-3">
    <!-- Superadmin Organization Search -->
    {#if isSuperadmin}
      <!-- Hidden search form -->
      <form
        id="org-search-form"
        {...searchOrganizations}
        class="hidden"
      >
        <input type="hidden" name="term" value={term} />
      </form>

      <div class="relative">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/50" />
          <input
            type="text"
            class="input input-bordered pl-10 pr-10 w-80 bg-base-200/40"
            placeholder="Search organizations..."
            value={term}
            oninput={onInput}
            onfocus={() => { if (searchResults.length) showDropdown = true; }}
            onblur={() => setTimeout(() => showDropdown = false, 200)}
          />
          {#if term}
            <button
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
              onclick={clearSearch}
            >
              <X class="h-3 w-3" />
            </button>
          {/if}
        </div>

        {#if showDropdown}
          <div class="absolute z-50 mt-2 w-full rounded-lg border border-base-300 bg-base-100 shadow-xl max-h-96 overflow-hidden">
            {#if isSearching}
              <div class="p-4 text-sm text-base-content/70">Searching...</div>
            {:else if searchResults.length > 0}
              <ul class="max-h-80 overflow-auto">
                {#each searchResults as org}
                  <li class="border-b border-base-200 last:border-0">
                    <form
                      {...setActiveOrganization}
                      onsubmit={handleSwitch}
                      class="flex items-center justify-between p-3 hover:bg-base-200/50 transition-colors"
                    >
                      <input type="hidden" name="organizationId" value={org.id} />
                      <div class="min-w-0 flex-1 flex items-center gap-2">
                        <Building2 class="h-4 w-4 text-primary flex-shrink-0" />
                        <div class="min-w-0">
                          <div class="font-medium text-base-content truncate">{org.name}</div>
                          {#if org.slug}
                            <div class="text-xs text-base-content/50 truncate">{org.slug}</div>
                          {/if}
                        </div>
                      </div>
                      <button
                        type="submit"
                        class="btn btn-xs btn-primary ml-3"
                        disabled={!!setActiveOrganization.pending}
                      >
                        Switch
                      </button>
                    </form>
                  </li>
                {/each}
              </ul>
              
              <!-- Clear Organization Button -->
              <div class="border-t border-base-200 p-2">
                <form {...clearOrganization} onsubmit={handleSwitch} class="w-full">
                  <button type="submit" class="btn btn-sm btn-ghost w-full justify-start gap-2">
                    <X class="h-4 w-4" />
                    Clear Organization (Admin Mode)
                  </button>
                </form>
              </div>
            {:else}
              <div class="p-4 text-sm text-base-content/50">No organizations found</div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <button class="btn btn-circle btn-ghost text-base-content/70">
      <Bell class="h-5 w-5" />
    </button>

    <div class="flex items-center gap-3 rounded-xl border border-base-200/80 bg-base-200/40 px-3 py-2">
      <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
        <UserCircle class="h-6 w-6" />
      </div>
      <div>
        <p class="text-sm font-medium">{user.name}</p>
        <p class="text-xs text-base-content/50">{user.email}</p>
      </div>
    </div>
  </div>
</header>
