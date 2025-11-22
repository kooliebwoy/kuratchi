<script lang="ts">
  import { Badge, Button, Loading } from '@kuratchi/ui';
  import { X, Bell, Check, Trash2, Database, Shield, CreditCard, User, Package, AlertTriangle, Info } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  interface Notification {
    id: string;
    title: string;
    message: string;
    category?: string;
    priority?: string;
    status: string;
    readAt?: string;
    actionUrl?: string;
    actionLabel?: string;
    iconUrl?: string;
    createdAt: string;
  }

  interface Props {
    show: boolean;
    onClose: () => void;
  }

  let { show = $bindable(), onClose }: Props = $props();

  let notifications = $state<Notification[]>([]);
  let unreadCount = $state(0);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let selectedTab = $state<'all' | 'unread'>('all');

  // Category icon mapping
  const categoryIcons: Record<string, any> = {
    system: Info,
    database: Database,
    security: Shield,
    billing: CreditCard,
    account: User,
    feature: Package,
    monitoring: AlertTriangle,
    custom: Bell,
  };

  // Priority colors
  async function fetchNotifications() {
    isLoading = true;
    error = null;

    try {
      const params = new URLSearchParams({
        limit: '50',
        unreadOnly: selectedTab === 'unread' ? 'true' : 'false',
      });

      const response = await fetch(`/api/notifications?${params}`);
      const data = await response.json();

      if (data.success) {
        notifications = data.notifications || [];
        unreadCount = data.unreadCount || 0;
      } else {
        error = data.error || 'Failed to load notifications';
      }
    } catch (err: any) {
      console.error('Failed to fetch notifications:', err);
      error = 'Failed to load notifications';
    } finally {
      isLoading = false;
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        notifications = notifications.map(n =>
          n.id === notificationId ? { ...n, status: 'read', readAt: new Date().toISOString() } : n
        );
        unreadCount = Math.max(0, unreadCount - 1);
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }

  async function markAllAsRead() {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        notifications = notifications.map(n => ({ ...n, status: 'read', readAt: new Date().toISOString() }));
        unreadCount = 0;
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }

  async function deleteNotification(notificationId: string) {
    try {
      const response = await fetch(`/api/notifications/delete?id=${notificationId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        // Remove from local state
        const wasUnread = notifications.find(n => n.id === notificationId)?.status !== 'read';
        notifications = notifications.filter(n => n.id !== notificationId);
        if (wasUnread) {
          unreadCount = Math.max(0, unreadCount - 1);
        }
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  }

  function handleNotificationClick(notification: Notification) {
    // Mark as read if unread
    if (notification.status !== 'read') {
      markAsRead(notification.id);
    }

    // Navigate if there's an action URL
    if (notification.actionUrl) {
      onClose();
      goto(notification.actionUrl);
    }
  }

  function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  }

  function getCategoryIcon(category?: string) {
    return categoryIcons[category || 'custom'] || Bell;
  }

  // Fetch notifications when drawer opens or tab changes
  $effect(() => {
    if (show) {
      fetchNotifications();
    }
  });

  $effect(() => {
    if (selectedTab) {
      fetchNotifications();
    }
  });
</script>

{#if show}
  <div class="kui-notify">
    <div class="kui-notify__panel">
      <div class="kui-notify__header">
        <div class="kui-notify__title">
          <span class="kui-notify__icon">
            <Bell />
          </span>
          <div>
            <h3>Notifications</h3>
            <p class="kui-notify__subtitle">Stay on top of updates</p>
          </div>
          {#if unreadCount > 0}
            <Badge variant="primary" size="sm">{unreadCount}</Badge>
          {/if}
        </div>
        <button class="kui-notify__icon-button" type="button" onclick={onClose} aria-label="Close notifications">
          <X />
        </button>
      </div>

      <div class="kui-notify__tabs">
        <button class:selected={selectedTab === 'all'} onclick={() => selectedTab = 'all'}>All</button>
        <button class:selected={selectedTab === 'unread'} onclick={() => selectedTab = 'unread'}>
          Unread {#if unreadCount > 0}<span class="kui-notify__pill">({unreadCount})</span>{/if}
        </button>
      </div>

      {#if notifications.length > 0 && unreadCount > 0}
        <div class="kui-notify__actions">
          <Button variant="ghost" size="xs" onclick={markAllAsRead}>
            <Check class="kui-notify__small-icon" />
            Mark all as read
          </Button>
        </div>
      {/if}

      <div class="kui-notify__content">
        {#if isLoading}
          <div class="kui-notify__center">
            <Loading />
          </div>
        {:else if error}
          <div class="kui-notify__empty">
            <AlertTriangle class="kui-notify__empty-icon error" />
            <p class="kui-notify__empty-title">Failed to load notifications</p>
            <p class="kui-notify__empty-subtitle">{error}</p>
            <Button size="sm" variant="primary" onclick={fetchNotifications}>Try Again</Button>
          </div>
        {:else if notifications.length === 0}
          <div class="kui-notify__empty">
            <Bell class="kui-notify__empty-icon" />
            <p class="kui-notify__empty-title">
              {selectedTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p class="kui-notify__empty-subtitle">
              {selectedTab === 'unread' ? "You're all caught up!" : 'We will notify you when something happens'}
            </p>
          </div>
        {:else}
          <div class="kui-notify__list">
            {#each notifications as notification (notification.id)}
              {@const Icon = getCategoryIcon(notification.category)}
              <article
                class={`kui-notify__item ${notification.status !== 'read' ? 'is-unread' : ''} priority-${notification.priority || 'normal'}`}
                onclick={() => handleNotificationClick(notification)}
              >
                <div class="kui-notify__item-left">
                  <div class="kui-notify__avatar">
                    <Icon />
                  </div>
                </div>
                <div class="kui-notify__item-body">
                  <div class="kui-notify__item-row">
                    <p class="kui-notify__item-title">{notification.title}</p>
                    {#if notification.status !== 'read'}
                      <span class="kui-notify__dot" aria-label="Unread"></span>
                    {/if}
                  </div>
                  <p class="kui-notify__item-text">{notification.message}</p>
                  <div class="kui-notify__item-meta">
                    <span>{formatTimestamp(notification.createdAt)}</span>
                    {#if notification.actionLabel}
                      <span class="kui-notify__link">{notification.actionLabel} →</span>
                    {/if}
                  </div>
                </div>
                <div class="kui-notify__item-actions">
                  {#if notification.status !== 'read'}
                    <button
                      class="kui-notify__chip"
                      onclick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                      title="Mark as read"
                    >
                      <Check class="kui-notify__small-icon" />
                    </button>
                  {/if}
                  <button
                    class="kui-notify__chip is-danger"
                    onclick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 class="kui-notify__small-icon" />
                  </button>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </div>

      {#if notifications.length > 0}
        <div class="kui-notify__footer">
          <a class="kui-button kui-button--ghost kui-button--size-sm" href="/notifications" onclick={onClose}>
            View all notifications
          </a>
        </div>
      {/if}
    </div>

    <div class="kui-notify__backdrop" onclick={onClose}></div>
  </div>
{/if}

<style>
  .kui-notify {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    justify-items: end;
  }

  .kui-notify__panel {
    background: var(--kui-color-surface);
    border-left: 1px solid var(--kui-color-border);
    height: 100vh;
    width: min(460px, 100%);
    box-shadow: -12px 0 32px rgba(15, 23, 42, 0.1);
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
  }

  .kui-notify__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--kui-spacing-md) var(--kui-spacing-lg);
    border-bottom: 1px solid var(--kui-color-border);
    background: color-mix(in srgb, var(--kui-color-surface) 90%, transparent);
    backdrop-filter: blur(10px);
  }

  .kui-notify__title {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
  }

  .kui-notify__title h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .kui-notify__subtitle {
    margin: 0;
    color: var(--kui-color-muted);
    font-size: 0.85rem;
  }

  .kui-notify__icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    display: grid;
    place-items: center;
    box-shadow: var(--kui-shadow-xs);
  }

  .kui-notify__icon-button {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--kui-radius-md);
    border: 1px solid var(--kui-color-border);
    background: var(--kui-color-surface-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--kui-color-muted);
    transition: border-color var(--kui-duration-base) ease, box-shadow var(--kui-duration-base) ease;
  }

  .kui-notify__icon-button:hover {
    border-color: color-mix(in srgb, var(--kui-color-primary) 35%, var(--kui-color-border) 65%);
    box-shadow: var(--kui-shadow-xs);
  }

  .kui-notify__tabs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    border-bottom: 1px solid var(--kui-color-border);
  }

  .kui-notify__tabs button {
    padding: 0.9rem var(--kui-spacing-md);
    border: none;
    background: transparent;
    cursor: pointer;
    font-weight: 600;
    color: var(--kui-color-muted);
    position: relative;
    transition: color var(--kui-duration-base) ease;
  }

  .kui-notify__tabs button.selected {
    color: var(--kui-color-primary);
  }

  .kui-notify__tabs button.selected::after {
    content: '';
    position: absolute;
    inset-inline: var(--kui-spacing-md);
    bottom: 0;
    height: 3px;
    border-radius: 999px;
    background: var(--kui-color-primary);
  }

  .kui-notify__pill {
    color: var(--kui-color-muted);
    font-size: 0.85rem;
    margin-left: 0.3rem;
  }

  .kui-notify__actions {
    padding: 0.65rem var(--kui-spacing-lg);
    border-bottom: 1px solid var(--kui-color-border);
    background: var(--kui-color-surface-muted);
  }

  .kui-notify__content {
    flex: 1;
    overflow-y: auto;
    padding: var(--kui-spacing-md) var(--kui-spacing-lg);
  }

  .kui-notify__center {
    display: grid;
    place-items: center;
    min-height: 220px;
  }

  .kui-notify__empty {
    display: grid;
    gap: 0.6rem;
    justify-items: center;
    text-align: center;
    padding: var(--kui-spacing-lg) var(--kui-spacing-md);
  }

  .kui-notify__empty-icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  .kui-notify__empty-icon.error {
    color: var(--kui-color-error);
  }

  .kui-notify__empty-title {
    margin: 0;
    font-weight: 700;
  }

  .kui-notify__empty-subtitle {
    margin: 0;
    color: var(--kui-color-muted);
    max-width: 360px;
  }

  .kui-notify__list {
    display: grid;
    gap: 0.75rem;
  }

  .kui-notify__item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--kui-spacing-sm);
    padding: 0.85rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-surface-muted);
    cursor: pointer;
    transition: border-color var(--kui-duration-base) ease, box-shadow var(--kui-duration-base) ease, transform var(--kui-duration-base) ease;
    position: relative;
  }

  .kui-notify__item:hover {
    border-color: color-mix(in srgb, var(--kui-color-primary) 35%, var(--kui-color-border) 65%);
    box-shadow: var(--kui-shadow-sm);
    transform: translateX(2px);
  }

  .kui-notify__item.is-unread {
    border-color: color-mix(in srgb, var(--kui-color-primary) 50%, var(--kui-color-border) 50%);
    background: rgba(88, 76, 217, 0.05);
  }

  .kui-notify__item-left {
    display: grid;
    place-items: center;
  }

  .kui-notify__avatar {
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 50%;
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    display: grid;
    place-items: center;
  }

  .kui-notify__item-body {
    display: grid;
    gap: 0.35rem;
  }

  .kui-notify__item-row {
    display: flex;
    align-items: flex-start;
    gap: var(--kui-spacing-xs);
    justify-content: space-between;
  }

  .kui-notify__item-title {
    margin: 0;
    font-weight: 700;
  }

  .kui-notify__dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: var(--kui-color-primary);
    flex-shrink: 0;
    margin-top: 0.25rem;
  }

  .kui-notify__item-text {
    margin: 0;
    color: var(--kui-color-muted);
    line-height: 1.4;
  }

  .kui-notify__item-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--kui-color-muted);
    font-size: 0.9rem;
  }

  .kui-notify__link {
    color: var(--kui-color-primary);
    font-weight: 600;
  }

  .kui-notify__item-actions {
    display: grid;
    gap: 0.35rem;
  }

  .kui-notify__chip {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--kui-radius-md);
    border: 1px solid var(--kui-color-border);
    background: var(--kui-color-surface);
    color: var(--kui-color-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color var(--kui-duration-base) ease, box-shadow var(--kui-duration-base) ease;
  }

  .kui-notify__chip:hover {
    border-color: color-mix(in srgb, var(--kui-color-primary) 35%, var(--kui-color-border) 65%);
    box-shadow: var(--kui-shadow-xs);
  }

  .kui-notify__chip.is-danger {
    color: var(--kui-color-error);
  }

  .kui-notify__small-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-notify__footer {
    border-top: 1px solid var(--kui-color-border);
    padding: var(--kui-spacing-md) var(--kui-spacing-lg);
    background: var(--kui-color-surface);
  }

  .kui-notify__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.35);
    backdrop-filter: blur(4px);
  }

  /* Priority accents */
  .kui-notify__item.priority-urgent::before,
  .kui-notify__item.priority-high::before,
  .kui-notify__item.priority-normal::before,
  .kui-notify__item.priority-low::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    border-radius: var(--kui-radius-md) 0 0 var(--kui-radius-md);
  }

  .kui-notify__item.priority-urgent::before { background: var(--kui-color-error); }
  .kui-notify__item.priority-high::before { background: var(--kui-color-warning); }
  .kui-notify__item.priority-normal::before { background: var(--kui-color-info); }
  .kui-notify__item.priority-low::before { background: var(--kui-color-border); }

  @media (max-width: 640px) {
    .kui-notify__panel {
      width: 100%;
    }
  }
</style>
