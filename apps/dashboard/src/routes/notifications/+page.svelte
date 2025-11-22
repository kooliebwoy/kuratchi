<script lang="ts">
  import { Bell, Send, Database, Shield, CreditCard, Package, AlertTriangle, CheckCircle, Clock, Trash2 } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { Badge, Button, Card, Loading } from '@kuratchi/ui';

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
    createdAt: string;
  }

  let notifications = $state<Notification[]>([]);
  let unreadCount = $state(0);
  let isLoading = $state(true);
  let isSendingTest = $state(false);
  let selectedFilter = $state<'all' | 'unread'>('all');

  const categoryIcons: Record<string, any> = {
    system: AlertTriangle,
    database: Database,
    security: Shield,
    billing: CreditCard,
    account: Bell,
    feature: Package,
    monitoring: AlertTriangle,
    custom: Bell,
  };

  const categoryVariants: Record<string, 'primary' | 'secondary' | 'accent' | 'info' | 'warning' | 'error' | 'neutral'> = {
    system: 'info',
    database: 'primary',
    security: 'error',
    billing: 'warning',
    account: 'accent',
    feature: 'secondary',
    monitoring: 'warning',
    custom: 'neutral',
  };

  const priorityVariants: Record<string, 'error' | 'warning' | 'info' | 'neutral'> = {
    urgent: 'error',
    high: 'warning',
    normal: 'info',
    low: 'neutral',
  };

  async function fetchNotifications() {
    isLoading = true;
    try {
      const params = new URLSearchParams({
        limit: '100',
        unreadOnly: selectedFilter === 'unread' ? 'true' : 'false',
      });

      const response = await fetch(`/api/notifications?${params}`);
      const data = await response.json();

      if (data.success) {
        notifications = data.notifications || [];
        unreadCount = data.unreadCount || 0;
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      isLoading = false;
    }
  }

  async function sendTestNotification(type: string) {
    isSendingTest = true;
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh notifications list
        await fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
    } finally {
      isSendingTest = false;
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });

      if (response.ok) {
        notifications = notifications.map(n =>
          n.id === notificationId ? { ...n, status: 'read', readAt: new Date().toISOString() } : n
        );
        unreadCount = Math.max(0, unreadCount - 1);
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }

  async function deleteNotification(notificationId: string) {
    try {
      const response = await fetch(`/api/notifications/delete?id=${notificationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const wasUnread = notifications.find(n => n.id === notificationId)?.status !== 'read';
        notifications = notifications.filter(n => n.id !== notificationId);
        if (wasUnread) {
          unreadCount = Math.max(0, unreadCount - 1);
        }
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
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

  onMount(() => {
    fetchNotifications();
  });

  $effect(() => {
    if (selectedFilter) {
      fetchNotifications();
    }
  });
</script>

<svelte:head>
  <title>Notifications - Kuratchi</title>
</svelte:head>

<div class="kui-notifications-page">
  <header class="kui-notifications__header">
    <div>
      <p class="kui-eyebrow">Notifications</p>
      <h1>Stay on top of updates</h1>
      <p class="kui-subtext">Manage alerts, mark items read, and test delivery</p>
    </div>
  </header>

  <Card class="kui-panel" title="Send Test Notifications">
    <p class="kui-subtext">Send test notifications to see how they look</p>

    <div class="kui-grid">
      <Button variant="neutral" size="sm" onclick={() => sendTestNotification('welcome')} disabled={isSendingTest}>
        <Bell class="kui-icon" />
        Welcome
      </Button>
      <Button variant="primary" size="sm" onclick={() => sendTestNotification('database')} disabled={isSendingTest}>
        <Database class="kui-icon" />
        Database
      </Button>
      <Button variant="error" size="sm" onclick={() => sendTestNotification('security')} disabled={isSendingTest}>
        <Shield class="kui-icon" />
        Security
      </Button>
      <Button variant="warning" size="sm" onclick={() => sendTestNotification('billing')} disabled={isSendingTest}>
        <CreditCard class="kui-icon" />
        Billing
      </Button>
    </div>

    {#if isSendingTest}
      <div class="kui-inline-alert">
        <Loading size="sm" />
        <span>Sending test notification...</span>
      </div>
    {/if}
  </Card>

  <Card class="kui-panel">
    <div class="kui-panel__header">
      <div class="kui-panel__title">
        <span class="kui-panel__icon"><Bell /></span>
        <div>
          <h2>All Notifications</h2>
          <p class="kui-subtext">Filter and manage your delivery</p>
        </div>
        {#if unreadCount > 0}
          <Badge variant="primary" size="sm">{unreadCount}</Badge>
        {/if}
      </div>

      <div class="kui-segment">
        <button class:selected={selectedFilter === 'all'} onclick={() => selectedFilter = 'all'}>All</button>
        <button class:selected={selectedFilter === 'unread'} onclick={() => selectedFilter = 'unread'}>
          Unread {#if unreadCount > 0}<span class="kui-pill">({unreadCount})</span>{/if}
        </button>
      </div>
    </div>

    {#if isLoading}
      <div class="kui-center">
        <Loading size="lg" />
      </div>
    {:else if notifications.length === 0}
      <div class="kui-empty">
        <Bell class="kui-empty__icon" />
        <p class="kui-empty__title">
          {selectedFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
        </p>
        <p class="kui-empty__subtitle">
          {selectedFilter === 'unread' ? "You're all caught up!" : 'Try sending a test notification above'}
        </p>
      </div>
    {:else}
      <div class="kui-notification-list">
        {#each notifications as notification (notification.id)}
          {@const Icon = categoryIcons[notification.category || 'custom']}
          {@const categoryVariant = categoryVariants[notification.category || 'custom']}
          {@const priorityVariant = priorityVariants[notification.priority || 'normal']}

          <article class={`kui-notification ${notification.status !== 'read' ? 'is-unread' : ''}`}>
            <div class="kui-notification__icon">
              <Icon />
            </div>
            <div class="kui-notification__body">
              <div class="kui-notification__row">
                <div class="kui-notification__title">
                  <h3>{notification.title}</h3>
                  {#if notification.status !== 'read'}
                    <span class="kui-dot" aria-label="Unread"></span>
                  {/if}
                </div>
                <div class="kui-notification__badges">
                  <Badge variant={categoryVariant} size="xs">{notification.category || 'custom'}</Badge>
                  {#if notification.priority && notification.priority !== 'normal'}
                    <Badge variant={priorityVariant} size="xs">{notification.priority}</Badge>
                  {/if}
                </div>
              </div>

              <p class="kui-notification__message">{notification.message}</p>

              <div class="kui-notification__footer">
                <div class="kui-notification__meta">
                  <span class="kui-inline">
                    <Clock class="kui-icon" />
                    {formatTimestamp(notification.createdAt)}
                  </span>
                  {#if notification.readAt}
                    <span class="kui-inline success">
                      <CheckCircle class="kui-icon" />
                      Read
                    </span>
                  {/if}
                </div>
                <div class="kui-notification__actions">
                  {#if notification.actionUrl}
                    <a
                      class="kui-button kui-button--ghost kui-button--size-xs"
                      href={notification.actionUrl}
                      onclick={() => markAsRead(notification.id)}
                    >
                      {notification.actionLabel || 'View'}
                    </a>
                  {/if}
                  {#if notification.status !== 'read'}
                    <Button variant="ghost" size="xs" onclick={() => markAsRead(notification.id)} aria-label="Mark as read">
                      <CheckCircle class="kui-icon" />
                    </Button>
                  {/if}
                  <Button variant="ghost" size="xs" onclick={() => deleteNotification(notification.id)} aria-label="Delete">
                    <Trash2 class="kui-icon error" />
                  </Button>
                </div>
              </div>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </Card>
</div>

<style>
  .kui-notifications-page {
    display: grid;
    gap: var(--kui-spacing-lg);
  }

  .kui-notifications__header h1 {
    margin: 0.25rem 0 0.35rem;
    font-size: 1.6rem;
    font-weight: 700;
  }

  .kui-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--kui-color-muted);
    font-weight: 700;
    font-size: 0.8rem;
    margin: 0;
  }

  .kui-subtext {
    margin: 0;
    color: var(--kui-color-muted);
  }

  .kui-panel .kui-card__body {
    gap: var(--kui-spacing-md);
  }

  .kui-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--kui-spacing-sm);
  }

  .kui-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-inline-alert {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    font-weight: 600;
  }

  .kui-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
  }

  .kui-panel__title {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
  }

  .kui-panel__title h2 {
    margin: 0;
  }

  .kui-panel__icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    display: grid;
    place-items: center;
  }

  .kui-segment {
    display: inline-flex;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    overflow: hidden;
  }

  .kui-segment button {
    padding: 0.55rem 0.9rem;
    border: none;
    background: transparent;
    cursor: pointer;
    font-weight: 600;
    color: var(--kui-color-muted);
    transition: background var(--kui-duration-base) ease, color var(--kui-duration-base) ease;
  }

  .kui-segment button.selected {
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
  }

  .kui-pill {
    color: var(--kui-color-muted);
    font-size: 0.9rem;
    margin-left: 0.25rem;
  }

  .kui-center {
    display: grid;
    place-items: center;
    min-height: 220px;
  }

  .kui-empty {
    display: grid;
    gap: 0.4rem;
    justify-items: center;
    text-align: center;
    padding: var(--kui-spacing-lg) var(--kui-spacing-md);
  }

  .kui-empty__icon {
    width: 3.5rem;
    height: 3.5rem;
    color: var(--kui-color-muted);
  }

  .kui-empty__title {
    margin: 0;
    font-weight: 700;
  }

  .kui-empty__subtitle {
    margin: 0;
    color: var(--kui-color-muted);
  }

  .kui-notification-list {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-notification {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--kui-spacing-sm);
    padding: 0.9rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-surface-muted);
    transition: border-color var(--kui-duration-base) ease, box-shadow var(--kui-duration-base) ease, transform var(--kui-duration-base) ease;
  }

  .kui-notification:hover {
    border-color: color-mix(in srgb, var(--kui-color-primary) 35%, var(--kui-color-border) 65%);
    box-shadow: var(--kui-shadow-xs);
    transform: translateY(-1px);
  }

  .kui-notification.is-unread {
    border-color: color-mix(in srgb, var(--kui-color-primary) 50%, var(--kui-color-border) 50%);
    background: rgba(88, 76, 217, 0.05);
  }

  .kui-notification__icon {
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 50%;
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    display: grid;
    place-items: center;
  }

  .kui-notification__row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--kui-spacing-sm);
    flex-wrap: wrap;
  }

  .kui-notification__title {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .kui-notification__title h3 {
    margin: 0;
    font-weight: 700;
  }

  .kui-dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: var(--kui-color-primary);
  }

  .kui-notification__badges {
    display: inline-flex;
    gap: 0.35rem;
  }

  .kui-notification__message {
    margin: 0.35rem 0 0.2rem;
    color: var(--kui-color-muted);
    line-height: 1.5;
  }

  .kui-notification__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-sm);
    flex-wrap: wrap;
    margin-top: 0.35rem;
  }

  .kui-notification__meta {
    display: inline-flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    color: var(--kui-color-muted);
    font-size: 0.9rem;
  }

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .kui-inline.success {
    color: var(--kui-color-success);
  }

  .kui-notification__actions {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  @media (max-width: 640px) {
    .kui-panel__header {
      align-items: flex-start;
    }

    .kui-notification {
      grid-template-columns: 1fr;
    }

    .kui-notification__icon {
      width: 2.2rem;
      height: 2.2rem;
    }
  }
</style>
