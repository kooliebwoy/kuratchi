<script lang="ts">
  import { Button, Card } from '@kuratchi/ui';
  import { Bell, Search, Command, UserCircle, X, Building2, LogOut, ChevronDown } from '@lucide/svelte';
  import { searchOrganizations, setActiveOrganization } from '$lib/functions/superadmin.remote';
  import { signOut } from '$lib/functions/auth.remote';
  import { goto, invalidateAll } from '$app/navigation';
  import NotificationDrawer from '$lib/components/NotificationDrawer.svelte';

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
  let showUserMenu = $state(false);

  let debounceTimer: any;

  function onInput(e: Event) {
    term = (e.target as HTMLInputElement).value;
    clearTimeout(debounceTimer);

    if (!term.trim()) {
      searchResults = [];
      return;
    }

    debounceTimer = setTimeout(() => {
      if (term.trim()) {
        const form = document.getElementById('org-search-form') as HTMLFormElement;
        form?.requestSubmit();
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

  $effect(() => {
    isSearching = !!searchOrganizations.pending;
  });

  $effect(() => {
    if (searchOrganizations.result && !searchOrganizations.pending) {
      searchResults = searchOrganizations.result || [];
    }
  });

  function handleSwitch() {
    term = '';
    searchResults = [];
    showSearchModal = false;
    window.location.reload();
  }

  async function handleSignOut(e: Event) {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const result = await signOut.submit(formData);

    if (result?.success) {
      await invalidateAll();
      goto('/auth/signin', { replaceState: true });
    }
  }
</script>

<header class="kui-header">
  <div class="kui-brand">
    <Command class="kui-icon" />
    <h2>{workspace}</h2>
  </div>

  <div class="kui-actions">
    <Button variant="ghost" size="sm" onclick={openSearchModal}>
      <Search class="kui-icon" />
      <span class="kui-subtext">Search…</span>
    </Button>

    <Button
      variant="ghost"
      size="sm"
      class="kui-circle"
      onclick={() => showNotificationDrawer = !showNotificationDrawer}
      aria-label="Notifications"
    >
      <Bell class="kui-icon" />
    </Button>

    <div class="kui-user-menu">
      <Button
        variant="ghost"
        size="sm"
        class="kui-user-trigger"
        onclick={() => showUserMenu = !showUserMenu}
        onblur={() => setTimeout(() => showUserMenu = false, 200)}
      >
        <div class="kui-avatar">
          <UserCircle class="kui-icon-lg" />
        </div>
        <div class="kui-user-text">
          <p class="kui-strong">{user.name}</p>
          <p class="kui-subtext">{user.email}</p>
        </div>
        <ChevronDown class="kui-icon" />
      </Button>

      {#if showUserMenu}
        <Card class="kui-user-dropdown">
          <div class="kui-user-dropdown__head">
            <p class="kui-strong truncate">{user.name}</p>
            <p class="kui-subtext truncate">{user.email}</p>
          </div>
          <form {...signOut} onsubmit={handleSignOut} class="kui-stack">
            <Button type="submit" variant="ghost" class="danger" disabled={!!signOut.pending}>
              {#if signOut.pending}
                Signing out…
              {:else}
                <LogOut class="kui-icon" />
                Sign out
              {/if}
            </Button>
          </form>
        </Card>
      {/if}
    </div>
  </div>
</header>

{#if showSearchModal}
  <div class="kui-search-modal">
    <div class="kui-backdrop" onclick={closeSearchModal}></div>

    <Card class="kui-search-card">
      <form id="org-search-form" {...searchOrganizations} class="hidden">
        <input type="hidden" name="query" bind:value={term} />
      </form>

      <div class="kui-search-head">
        <Search class="kui-icon" />
        <input
          type="text"
          class="kui-search-input"
          placeholder="Search organizations, sites, users..."
          value={term}
          oninput={onInput}
          autofocus
        />
        <Button variant="ghost" size="xs" onclick={closeSearchModal} aria-label="Close search">
          <X class="kui-icon" />
        </Button>
      </div>

      <div class="kui-search-results">
        {#if !term.trim()}
          <div class="kui-subtext">Start typing to search…</div>
        {:else if isSearching}
          <div class="kui-subtext">Searching…</div>
        {:else if searchResults.length > 0}
          <div class="kui-result-list">
            {#each searchResults as result}
              <div class="kui-result-row">
                <div class="kui-inline">
                  <Building2 class="kui-icon" />
                  <div>
                    <div class="kui-strong">{result.name}</div>
                    <div class="kui-subtext">{result.slug}</div>
                  </div>
                </div>
                <!-- Switch organization functionality temporarily hidden for launch -->
                <Button variant="ghost" size="xs" disabled title="Organization switching temporarily disabled">
                  Switch
                </Button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="kui-subtext">No results found</div>
        {/if}
      </div>
    </Card>
  </div>
{/if}

<NotificationDrawer bind:open={showNotificationDrawer} />

<style>
  .kui-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 24px;
    border-bottom: 1px solid #e5e7eb;
    background: rgba(255,255,255,0.8);
    backdrop-filter: blur(8px);
  }

  .kui-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .kui-brand h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }

  .kui-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .kui-icon {
    width: 16px;
    height: 16px;
  }

  .kui-icon-lg {
    width: 20px;
    height: 20px;
  }

  .kui-circle {
    padding: 6px;
    border-radius: 999px;
  }

  .kui-user-menu {
    position: relative;
  }

  .kui-user-trigger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    background: #f8fafc;
  }

  .kui-avatar {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    background: linear-gradient(135deg, #c7d2fe, #a5b4fc);
    display: grid;
    place-items: center;
    color: #1d1b72;
  }

  .kui-user-text {
    display: grid;
    gap: 2px;
  }

  .kui-strong {
    margin: 0;
    font-weight: 600;
  }

  .kui-subtext {
    margin: 0;
    color: #6b7280;
    font-size: 12px;
  }

  .kui-user-dropdown {
    position: absolute;
    right: 0;
    margin-top: 8px;
    width: 220px;
    z-index: 50;
    padding: 10px;
  }

  .kui-user-dropdown__head {
    border-bottom: 1px solid #f1f1f3;
    padding-bottom: 8px;
    margin-bottom: 8px;
  }

  .kui-stack {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .danger {
    color: #b91c1c;
  }

  .kui-search-modal {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: start center;
    padding-top: 80px;
  }

  .kui-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.25);
    backdrop-filter: blur(6px);
  }

  .kui-search-card {
    position: relative;
    z-index: 60;
    width: min(680px, 92vw);
    padding: 0;
  }

  .kui-search-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid #f1f1f3;
  }

  .kui-search-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 15px;
    background: transparent;
  }

  .kui-search-results {
    max-height: 60vh;
    overflow: auto;
    padding: 12px 14px;
  }

  .kui-result-list {
    display: grid;
    gap: 8px;
  }

  .kui-result-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
  }
</style>
