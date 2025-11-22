<script lang="ts">
  import { Button, Loading } from '@kuratchi/ui';
  import { goto, invalidateAll } from '$app/navigation';
  import { searchOrganizations } from '$lib/functions/superadmin.remote';
  import { signOut } from '$lib/functions/auth.remote';
  import NotificationDrawer from '$lib/components/NotificationDrawer.svelte';
  import { Bell, Search, Command, UserCircle, X, Building2, LogOut, ChevronDown } from '@lucide/svelte';
  import type { AppUser } from './types';

  interface Props {
    workspace: string;
    user: AppUser;
    isSuperadmin?: boolean;
  }

  let { workspace, user, isSuperadmin = false }: Props = $props();

  let term = $state('');
  let searchResults = $state<Array<{ id: string; name: string; slug?: string }>>([]);
  let showSearchModal = $state(false);
  let isSearching = $state(false);
  let showNotificationDrawer = $state(false);
  let showUserMenu = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function onInput(e: Event) {
    term = (e.target as HTMLInputElement).value;
    if (debounceTimer) clearTimeout(debounceTimer);

    if (!term.trim()) {
      searchResults = [];
      return;
    }

    debounceTimer = setTimeout(() => {
      const form = document.getElementById('org-search-form') as HTMLFormElement;
      form?.requestSubmit();
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
    if (!searchOrganizations.pending && searchOrganizations.result) {
      searchResults = searchOrganizations.result || [];
    }
  });

  function handleSwitch() {
    term = '';
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

  const initials = $derived(() => {
    if (!user?.name) return '';
    return user.name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  });
</script>

<header class="kui-app-header">
  <div class="kui-app-header__workspace">
    <span class="kui-app-header__workspace-icon">
      <Command />
    </span>
    <div>
      <p class="kui-app-header__eyebrow">Workspace</p>
      <h2 class="kui-app-header__title">{workspace}</h2>
      {#if isSuperadmin}
        <span class="kui-app-header__badge">Superadmin</span>
      {/if}
    </div>
  </div>

  <div class="kui-app-header__actions">
    <Button variant="ghost" size="sm" class="kui-app-header__action" onclick={openSearchModal}>
      <Search class="kui-app-header__action-icon" />
      <span>Search</span>
    </Button>

    <button
      class="kui-app-header__icon-button"
      aria-label="Notifications"
      onclick={() => showNotificationDrawer = !showNotificationDrawer}
    >
      <Bell />
    </button>

    <div class="kui-app-header__user">
      <button
        class="kui-app-header__user-button"
        onclick={() => showUserMenu = !showUserMenu}
        onblur={() => setTimeout(() => showUserMenu = false, 150)}
        aria-haspopup="menu"
        aria-expanded={showUserMenu}
      >
        <div class="kui-app-header__avatar">
          {#if user.avatarUrl}
            <img src={user.avatarUrl} alt={user.name} />
          {:else if initials}
            <span>{initials}</span>
          {:else}
            <UserCircle class="kui-app-header__avatar-icon" />
          {/if}
        </div>
        <div class="kui-app-header__user-meta">
          <p class="kui-app-header__user-name">{user.name}</p>
          <p class="kui-app-header__user-email">{user.email}</p>
        </div>
        <ChevronDown class="kui-app-header__chevron" />
      </button>

      {#if showUserMenu}
        <div class="kui-app-header__menu" role="menu">
          <div class="kui-app-header__menu-header">
            <p class="kui-app-header__menu-title">{user.name}</p>
            <p class="kui-app-header__menu-subtitle">{user.email}</p>
          </div>
          <div class="kui-app-header__menu-actions">
            <form {...signOut} onsubmit={handleSignOut}>
              <Button variant="ghost" size="sm" type="submit" class="kui-app-header__signout" disabled={!!signOut.pending}>
                {#if signOut.pending}
                  <Loading size="sm" />
                  <span>Signing out...</span>
                {:else}
                  <LogOut class="kui-app-header__action-icon" />
                  <span>Sign Out</span>
                {/if}
              </Button>
            </form>
          </div>
        </div>
      {/if}
    </div>
  </div>
</header>

<!-- Hidden form used for remote search -->
<form {...searchOrganizations} id="org-search-form" class="kui-visually-hidden">
  <input type="hidden" name="term" value={term} />
</form>

<!-- Search Modal -->
{#if showSearchModal}
  <div class="kui-app-header__overlay">
    <div class="kui-app-header__overlay-backdrop" onclick={closeSearchModal}></div>
    <div class="kui-app-header__dialog">
      <div class="kui-app-header__search-row">
        <Search class="kui-app-header__muted-icon" />
        <input
          type="text"
          class="kui-app-header__search-input"
          placeholder="Search organizations, sites, users..."
          value={term}
          oninput={onInput}
          autofocus
        />
        <button type="button" class="kui-app-header__icon-button" onclick={closeSearchModal} aria-label="Close search">
          <X />
        </button>
      </div>

      <div class="kui-app-header__results">
        {#if !term.trim()}
          <p class="kui-app-header__muted-text">Start typing to search...</p>
        {:else if isSearching}
          <div class="kui-app-header__center">
            <Loading />
          </div>
        {:else if searchResults.length > 0}
          <div class="kui-app-header__list">
            {#each searchResults as result}
              <button
                class="kui-app-header__result"
                onclick={() => {
                  handleSwitch();
                  closeSearchModal();
                }}
              >
                <div class="kui-app-header__result-icon">
                  <Building2 />
                </div>
                <div class="kui-app-header__result-body">
                  <div class="kui-app-header__result-title">{result.name}</div>
                  {#if result.slug}
                    <div class="kui-app-header__result-subtitle">{result.slug}</div>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {:else}
          <p class="kui-app-header__muted-text">No results found</p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Notifications Drawer -->
<NotificationDrawer bind:show={showNotificationDrawer} onClose={() => showNotificationDrawer = false} />

<style>
  .kui-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .kui-app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--kui-spacing-md) var(--kui-spacing-lg);
    border-bottom: 1px solid var(--kui-color-border);
    backdrop-filter: blur(12px);
    background: color-mix(in srgb, var(--kui-color-surface) 85%, transparent);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .kui-app-header__workspace {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
  }

  .kui-app-header__workspace-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    box-shadow: var(--kui-shadow-xs);
  }

  .kui-app-header__eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.7rem;
    color: var(--kui-color-muted);
  }

  .kui-app-header__title {
    margin: 0.1rem 0 0;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .kui-app-header__badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    font-weight: 600;
    font-size: 0.75rem;
    margin-top: 0.35rem;
  }

  .kui-app-header__actions {
    display: inline-flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
  }

  .kui-app-header__action {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .kui-app-header__action-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-app-header__icon-button {
    border: 1px solid var(--kui-color-border);
    background: var(--kui-color-surface);
    color: var(--kui-color-muted);
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--kui-radius-md);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    cursor: pointer;
    transition: transform var(--kui-duration-base) ease, box-shadow var(--kui-duration-base) ease, border-color var(--kui-duration-base) ease;
  }

  .kui-app-header__icon-button:hover {
    transform: translateY(-1px);
    box-shadow: var(--kui-shadow-sm);
    border-color: color-mix(in srgb, var(--kui-color-border) 70%, var(--kui-color-primary) 30%);
  }

  .kui-app-header__user {
    position: relative;
  }

  .kui-app-header__user-button {
    display: inline-flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    border: 1px solid var(--kui-color-border);
    background: var(--kui-color-surface);
    padding: 0.35rem 0.65rem 0.35rem 0.35rem;
    border-radius: var(--kui-radius-lg);
    cursor: pointer;
    transition: box-shadow var(--kui-duration-base) ease, border-color var(--kui-duration-base) ease;
  }

  .kui-app-header__user-button:hover {
    box-shadow: var(--kui-shadow-sm);
    border-color: color-mix(in srgb, var(--kui-color-border) 70%, var(--kui-color-primary) 30%);
  }

  .kui-app-header__avatar {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    display: grid;
    place-items: center;
    font-weight: 700;
    overflow: hidden;
  }

  .kui-app-header__avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .kui-app-header__avatar-icon {
    width: 1.4rem;
    height: 1.4rem;
  }

  .kui-app-header__user-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .kui-app-header__user-name {
    margin: 0;
    font-weight: 600;
  }

  .kui-app-header__user-email {
    margin: 0;
    font-size: 0.85rem;
    color: var(--kui-color-muted);
  }

  .kui-app-header__chevron {
    width: 1rem;
    height: 1rem;
    color: var(--kui-color-muted);
  }

  .kui-app-header__menu {
    position: absolute;
    right: 0;
    margin-top: 0.5rem;
    min-width: 16rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-surface);
    box-shadow: var(--kui-shadow-md);
    overflow: hidden;
    z-index: 20;
  }

  .kui-app-header__menu-header {
    padding: var(--kui-spacing-sm) var(--kui-spacing-md);
    border-bottom: 1px solid var(--kui-color-border);
    background: var(--kui-color-surface-muted);
  }

  .kui-app-header__menu-title {
    margin: 0;
    font-weight: 700;
    font-size: 0.95rem;
  }

  .kui-app-header__menu-subtitle {
    margin: 0.15rem 0 0;
    color: var(--kui-color-muted);
    font-size: 0.85rem;
  }

  .kui-app-header__menu-actions {
    padding: var(--kui-spacing-sm) var(--kui-spacing-md);
  }

  .kui-app-header__signout {
    width: 100%;
    justify-content: flex-start;
    color: var(--kui-color-error);
  }

  .kui-app-header__overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: flex-start center;
    padding-top: 12vh;
    z-index: 30;
  }

  .kui-app-header__overlay-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(6px);
  }

  .kui-app-header__dialog {
    position: relative;
    z-index: 1;
    width: min(880px, calc(100% - 32px));
    background: var(--kui-color-surface);
    border-radius: var(--kui-radius-lg);
    border: 1px solid var(--kui-color-border);
    box-shadow: var(--kui-shadow-lg);
    overflow: hidden;
  }

  .kui-app-header__search-row {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    padding: var(--kui-spacing-md) var(--kui-spacing-lg);
    border-bottom: 1px solid var(--kui-color-border);
  }

  .kui-app-header__search-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 1rem;
    background: transparent;
    color: var(--kui-color-text);
  }

  .kui-app-header__results {
    max-height: 420px;
    overflow-y: auto;
    padding: var(--kui-spacing-md) var(--kui-spacing-lg);
  }

  .kui-app-header__muted-text {
    text-align: center;
    color: var(--kui-color-muted);
    margin: var(--kui-spacing-md) 0;
  }

  .kui-app-header__center {
    display: grid;
    place-items: center;
    min-height: 120px;
  }

  .kui-app-header__list {
    display: grid;
    gap: 0.5rem;
  }

  .kui-app-header__result {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    width: 100%;
    text-align: left;
    padding: 0.75rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface-muted);
    cursor: pointer;
    transition: border-color var(--kui-duration-base) ease, box-shadow var(--kui-duration-base) ease, transform var(--kui-duration-base) ease;
  }

  .kui-app-header__result:hover {
    border-color: color-mix(in srgb, var(--kui-color-primary) 35%, var(--kui-color-border) 65%);
    box-shadow: var(--kui-shadow-sm);
    transform: translateY(-1px);
  }

  .kui-app-header__result-icon {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .kui-app-header__result-body {
    display: flex;
    flex-direction: column;
  }

  .kui-app-header__result-title {
    font-weight: 700;
  }

  .kui-app-header__result-subtitle {
    font-size: 0.85rem;
    color: var(--kui-color-muted);
  }

  .kui-app-header__muted-icon {
    color: var(--kui-color-muted);
    width: 1.1rem;
    height: 1.1rem;
  }

  @media (max-width: 768px) {
    .kui-app-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--kui-spacing-sm);
    }

    .kui-app-header__actions {
      width: 100%;
      justify-content: flex-end;
    }
  }
</style>
