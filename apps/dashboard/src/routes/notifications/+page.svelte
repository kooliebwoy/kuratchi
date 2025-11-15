<script lang="ts">
  import { Bell, Send, Database, Shield, CreditCard, Package, AlertTriangle, CheckCircle, Clock, Trash2 } from 'lucide-svelte';
  import { onMount } from 'svelte';

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

  const categoryColors: Record<string, string> = {
    system: 'badge-info',
    database: 'badge-primary',
    security: 'badge-error',
    billing: 'badge-warning',
    account: 'badge-accent',
    feature: 'badge-secondary',
    monitoring: 'badge-warning',
    custom: 'badge-neutral',
  };

  const priorityBadges: Record<string, string> = {
    urgent: 'badge-error',
    high: 'badge-warning',
    normal: 'badge-info',
    low: 'badge-ghost',
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

<div class="space-y-6">
  <!-- Header -->
  <div>
    <h1 class="text-3xl font-bold">Notifications</h1>
    <p class="text-base-content/60 mt-2">Manage your notifications and preferences</p>
  </div>

  <!-- Test Notifications Section -->
  <div class="card bg-base-200/50 shadow-sm">
    <div class="card-body">
      <h2 class="card-title text-lg">
        <Send class="h-5 w-5" />
        Test Notifications
      </h2>
      <p class="text-sm text-base-content/70">Send test notifications to see how they look</p>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <button
          class="btn btn-sm gap-2"
          onclick={() => sendTestNotification('welcome')}
          disabled={isSendingTest}
        >
          <Bell class="h-4 w-4" />
          Welcome
        </button>

        <button
          class="btn btn-sm btn-primary gap-2"
          onclick={() => sendTestNotification('database')}
          disabled={isSendingTest}
        >
          <Database class="h-4 w-4" />
          Database
        </button>

        <button
          class="btn btn-sm btn-error gap-2"
          onclick={() => sendTestNotification('security')}
          disabled={isSendingTest}
        >
          <Shield class="h-4 w-4" />
          Security
        </button>

        <button
          class="btn btn-sm btn-warning gap-2"
          onclick={() => sendTestNotification('billing')}
          disabled={isSendingTest}
        >
          <CreditCard class="h-4 w-4" />
          Billing
        </button>
      </div>

      {#if isSendingTest}
        <div class="alert alert-info mt-4">
          <span class="loading loading-spinner loading-sm"></span>
          <span>Sending test notification...</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Notifications List -->
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <!-- Header with Tabs -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="card-title text-lg">
          <Bell class="h-5 w-5" />
          All Notifications
          {#if unreadCount > 0}
            <span class="badge badge-primary badge-sm">{unreadCount}</span>
          {/if}
        </h2>

        <div class="tabs tabs-boxed">
          <button
            class="tab"
            class:tab-active={selectedFilter === 'all'}
            onclick={() => selectedFilter = 'all'}
          >
            All
          </button>
          <button
            class="tab"
            class:tab-active={selectedFilter === 'unread'}
            onclick={() => selectedFilter = 'unread'}
          >
            Unread
            {#if unreadCount > 0}
              <span class="ml-1">({unreadCount})</span>
            {/if}
          </button>
        </div>
      </div>

      <!-- Loading State -->
      {#if isLoading}
        <div class="flex items-center justify-center py-12">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>

      <!-- Empty State -->
      {:else if notifications.length === 0}
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <Bell class="h-16 w-16 text-base-content/20 mb-4" />
          <p class="text-base-content/60 font-medium mb-2">
            {selectedFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p class="text-sm text-base-content/40">
            {selectedFilter === 'unread' ? 'You\'re all caught up!' : 'Try sending a test notification above'}
          </p>
        </div>

      <!-- Notifications List -->
      {:else}
        <div class="space-y-2">
          {#each notifications as notification (notification.id)}
            {@const Icon = categoryIcons[notification.category || 'custom']}
            {@const categoryColor = categoryColors[notification.category || 'custom']}
            {@const priorityBadge = priorityBadges[notification.priority || 'normal']}

            <div
              class="p-4 rounded-lg border border-base-200 hover:bg-base-200/50 transition-colors {notification.status !== 'read' ? 'bg-primary/5' : ''}"
            >
              <div class="flex gap-4">
                <!-- Icon -->
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon class="h-5 w-5 text-primary" />
                  </div>
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2 mb-2">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="font-semibold text-base-content">
                        {notification.title}
                      </h3>
                      {#if notification.status !== 'read'}
                        <span class="h-2 w-2 rounded-full bg-primary flex-shrink-0"></span>
                      {/if}
                    </div>

                    <div class="flex items-center gap-2">
                      <span class="badge {categoryColor} badge-sm">{notification.category || 'custom'}</span>
                      {#if notification.priority && notification.priority !== 'normal'}
                        <span class="badge {priorityBadge} badge-sm">{notification.priority}</span>
                      {/if}
                    </div>
                  </div>

                  <p class="text-sm text-base-content/70 mb-3">
                    {notification.message}
                  </p>

                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3 text-xs text-base-content/50">
                      <span class="flex items-center gap-1">
                        <Clock class="h-3 w-3" />
                        {formatTimestamp(notification.createdAt)}
                      </span>
                      {#if notification.readAt}
                        <span class="flex items-center gap-1 text-success">
                          <CheckCircle class="h-3 w-3" />
                          Read
                        </span>
                      {/if}
                    </div>

                    <div class="flex items-center gap-1">
                      {#if notification.actionUrl}
                        <a
                          href={notification.actionUrl}
                          class="btn btn-xs btn-ghost gap-1"
                          onclick={() => markAsRead(notification.id)}
                        >
                          {notification.actionLabel || 'View'}
                          <span>→</span>
                        </a>
                      {/if}

                      {#if notification.status !== 'read'}
                        <button
                          class="btn btn-xs btn-ghost"
                          onclick={() => markAsRead(notification.id)}
                          title="Mark as read"
                        >
                          <CheckCircle class="h-3 w-3" />
                        </button>
                      {/if}

                      <button
                        class="btn btn-xs btn-ghost text-error"
                        onclick={() => deleteNotification(notification.id)}
                        title="Delete"
                      >
                        <Trash2 class="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
