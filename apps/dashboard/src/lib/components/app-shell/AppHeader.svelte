<script lang="ts">
  import { Button, Loading } from '@kuratchi/ui';
  import { goto, invalidateAll } from '$app/navigation';
  import { signOut } from '$lib/functions/auth.remote';
  import NotificationDrawer from '$lib/components/NotificationDrawer.svelte';
  import { Bell, Command, LogOut, ChevronDown } from '@lucide/svelte';
  import type { AppUser } from './types';

  interface Props {
    workspace: string;
    user: AppUser;
    isSuperadmin?: boolean;
  }

  let { workspace, user, isSuperadmin = false }: Props = $props();

  let showNotificationDrawer = $state(false);
  let showUserMenu = $state(false);


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
        <span class="kui-app-header__user-name">{user?.name || 'User'}</span>
        <ChevronDown class="kui-app-header__chevron" />
      </button>

      {#if showUserMenu}
        <div class="kui-app-header__menu" role="menu">
          <div class="kui-app-header__menu-header">
            <p class="kui-app-header__menu-title">{user?.name || 'User'}</p>
            <p class="kui-app-header__menu-subtitle">{user?.email || ''}</p>
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
    gap: 0.5rem;
    border: 1px solid var(--kui-color-border);
    background: var(--kui-color-surface);
    padding: 0.5rem 0.75rem;
    border-radius: var(--kui-radius-md);
    cursor: pointer;
    transition: box-shadow var(--kui-duration-base) ease, border-color var(--kui-duration-base) ease;
    font-weight: 600;
  }

  .kui-app-header__user-button:hover {
    box-shadow: var(--kui-shadow-sm);
    border-color: color-mix(in srgb, var(--kui-color-border) 70%, var(--kui-color-primary) 30%);
  }

  .kui-app-header__user-name {
    margin: 0;
    font-weight: 600;
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
