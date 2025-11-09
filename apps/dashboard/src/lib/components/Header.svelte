<script lang="ts">
  import { Bell, Search, Command, UserCircle, X, Building2, LogOut, ChevronDown } from 'lucide-svelte';
  import { searchOrganizations, setActiveOrganization, clearOrganization } from '$lib/api/superadmin.remote';
  import { signOut } from '$lib/api/auth.remote';
  import { goto, invalidateAll } from '$app/navigation';
  
  interface Props {
    workspace: string;
    user: { name: string; email: string };
    isSuperadmin?: boolean;
  }
  
  let { workspace, user, isSuperadmin = false }: Props = $props();

  let term = $state('');
  let searchResults = $state<Array<{ id: string; name: string; slug?: string }>>([]);
  let showSearchModal = $state(false);
  let isSearching = $state(false);
  let showNotificationDrawer = $state(false);

  let debounceTimer: any;
  let showUserMenu = $state(false);

  function onInput(e: Event) {
    term = (e.target as HTMLInputElement).value;
    clearTimeout(debounceTimer);
    
    if (!term.trim()) {
      searchResults = [];
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

  function openSearchModal() {
    showSearchModal = true;
    term = '';
    searchResults = [];
  }

  function closeSearchModal() {
    showSearchModal = false;
    term = '';
    searchResults = [];
  }

  // Watch for search form state
  $effect(() => {
    isSearching = !!searchOrganizations.pending;
  });

  // Watch for search results from the form
  $effect(() => {
    if (searchOrganizations.result && !searchOrganizations.pending) {
      searchResults = searchOrganizations.result || [];
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

  // Handle sign out - redirect after successful logout
  async function handleSignOut(e: Event) {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const result = await signOut.submit(formData);
    
    // Redirect to signin page after successful logout
    if (result?.success) {
      // Invalidate all data to clear server-side cache
      await invalidateAll();
      // Navigate to signin
      goto('/auth/signin', { replaceState: true });
    }
  }
</script>

<header class="flex items-center justify-between border-b border-base-200/60 bg-base-100/60 px-8 py-4 backdrop-blur">
  <div class="flex items-center gap-3">
    <Command class="h-5 w-5" />
    <h2 class="text-lg font-semibold">{workspace}</h2>
  </div>

  <div class="flex items-center gap-3">
    <!-- Search Modal Trigger -->
    <button
      class="btn btn-ghost text-base-content/70 gap-2"
      onclick={openSearchModal}
    >
      <Search class="h-4 w-4" />
      <span class="text-xs text-base-content/50">Search...</span>
    </button>

    <!-- Notifications Drawer Trigger -->
    <button
      class="btn btn-circle btn-ghost text-base-content/70"
      onclick={() => showNotificationDrawer = !showNotificationDrawer}
    >
      <Bell class="h-5 w-5" />
    </button>

    <!-- User Menu -->
    <div class="relative">
      <button
        class="flex items-center gap-3 rounded-xl border border-base-200/80 bg-base-200/40 px-3 py-2 hover:bg-base-200/60 transition-colors"
        onclick={() => showUserMenu = !showUserMenu}
        onblur={() => setTimeout(() => showUserMenu = false, 200)}
      >
        <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
          <UserCircle class="h-6 w-6" />
        </div>
        <div class="text-left">
          <p class="text-sm font-medium">{user.name}</p>
          <p class="text-xs text-base-content/50">{user.email}</p>
        </div>
        <ChevronDown class="h-4 w-4 text-base-content/50" />
      </button>

      {#if showUserMenu}
        <div class="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-base-300 bg-base-100 shadow-xl overflow-hidden">
          <div class="p-3 border-b border-base-200 bg-base-200/30">
            <p class="text-sm font-medium truncate">{user.name}</p>
            <p class="text-xs text-base-content/50 truncate">{user.email}</p>
          </div>
          
          <div class="p-2">
            <form {...signOut} onsubmit={handleSignOut}>
              <button
                type="submit"
                class="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error/10 rounded-lg transition-colors"
                disabled={!!signOut.pending}
              >
                {#if signOut.pending}
                  <span class="loading loading-spinner loading-xs"></span>
                  <span>Signing out...</span>
                {:else}
                  <LogOut class="h-4 w-4" />
                  <span>Sign Out</span>
                {/if}
              </button>
            </form>
          </div>
        </div>
      {/if}
    </div>
  </div>
</header>

<!-- Search Modal -->
{#if showSearchModal}
  <div class="fixed inset-0 z-50 flex items-start justify-center pt-20">
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-black/20 backdrop-blur-sm"
      onclick={closeSearchModal}
    ></div>

    <!-- Modal Content -->
    <div class="relative z-50 w-full max-w-2xl mx-4">
      <div class="bg-base-100 rounded-2xl shadow-2xl border border-base-200 overflow-hidden">
        <!-- Search Header -->
        <div class="flex items-center gap-3 border-b border-base-200 px-6 py-4">
          <Search class="h-5 w-5 text-base-content/50" />
          <input
            type="text"
            class="flex-1 bg-transparent text-lg outline-none placeholder-base-content/50"
            placeholder="Search organizations, sites, users..."
            value={term}
            oninput={onInput}
            autofocus
          />
          <button
            type="button"
            class="btn btn-ghost btn-sm btn-circle"
            onclick={closeSearchModal}
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <!-- Search Results -->
        <div class="max-h-96 overflow-y-auto">
          {#if !term.trim()}
            <div class="p-6 text-center text-base-content/50">
              <p>Start typing to search...</p>
            </div>
          {:else if isSearching}
            <div class="p-6 text-center">
              <span class="loading loading-spinner loading-sm"></span>
            </div>
          {:else if searchResults.length > 0}
            <div class="divide-y divide-base-200">
              {#each searchResults as result}
                <button
                  class="w-full flex items-center gap-3 px-6 py-3 hover:bg-base-200/50 transition-colors text-left"
                  onclick={() => {
                    handleSwitch();
                    closeSearchModal();
                  }}
                >
                  <Building2 class="h-4 w-4 text-primary flex-shrink-0" />
                  <div class="min-w-0 flex-1">
                    <div class="font-medium text-base-content truncate">{result.name}</div>
                    {#if result.slug}
                      <div class="text-xs text-base-content/50 truncate">{result.slug}</div>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {:else}
            <div class="p-6 text-center text-base-content/50">
              <p>No results found</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Notifications Drawer -->
{#if showNotificationDrawer}
  <div class="fixed inset-y-0 right-0 z-50 w-96 bg-base-100 border-l border-base-200 shadow-2xl flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-base-200 px-6 py-4">
      <h3 class="font-semibold text-lg">Notifications</h3>
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-circle"
        onclick={() => showNotificationDrawer = false}
      >
        <X class="h-4 w-4" />
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-3">
      <div class="p-4 rounded-lg border border-base-200 bg-base-200/30 hover:bg-base-200/50 transition-colors cursor-pointer">
        <p class="font-medium text-sm text-base-content">Welcome to Kuratchi</p>
        <p class="text-xs text-base-content/60 mt-1">Get started by creating your first site</p>
        <p class="text-xs text-base-content/40 mt-2">Just now</p>
      </div>

      <div class="p-4 rounded-lg border border-base-200 bg-base-200/30 hover:bg-base-200/50 transition-colors cursor-pointer">
        <p class="font-medium text-sm text-base-content">System Update</p>
        <p class="text-xs text-base-content/60 mt-1">Dashboard has been updated with new features</p>
        <p class="text-xs text-base-content/40 mt-2">2 hours ago</p>
      </div>

      <div class="p-4 rounded-lg border border-base-200 bg-base-200/30 hover:bg-base-200/50 transition-colors cursor-pointer">
        <p class="font-medium text-sm text-base-content">Email Campaign Sent</p>
        <p class="text-xs text-base-content/60 mt-1">Your email campaign was successfully delivered</p>
        <p class="text-xs text-base-content/40 mt-2">1 day ago</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-base-200 p-4">
      <button class="btn btn-sm btn-ghost w-full">View All Notifications</button>
    </div>
  </div>

  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-40 bg-black/20"
    onclick={() => showNotificationDrawer = false}
  ></div>
{/if}
