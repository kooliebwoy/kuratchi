<script lang="ts">
  import { X, Bell, Check, Trash2, Mail, Database, Shield, CreditCard, User, Package, AlertTriangle, Info } from 'lucide-svelte';
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
  const priorityColors: Record<string, string> = {
    urgent: 'border-l-4 border-l-error bg-error/5',
    high: 'border-l-4 border-l-warning bg-warning/5',
    normal: 'border-l-4 border-l-info bg-info/5',
    low: 'border-l-4 border-l-base-300',
  };

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

  function getPriorityClass(priority?: string) {
    return priorityColors[priority || 'normal'] || '';
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
  <!-- Drawer -->
  <div class="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-base-100 border-l border-base-200 shadow-2xl flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-base-200 px-6 py-4 bg-base-100/95 backdrop-blur">
      <div class="flex items-center gap-2">
        <Bell class="h-5 w-5 text-primary" />
        <h3 class="font-semibold text-lg">Notifications</h3>
        {#if unreadCount > 0}
          <span class="badge badge-primary badge-sm">{unreadCount}</span>
        {/if}
      </div>
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-circle"
        onclick={onClose}
      >
        <X class="h-4 w-4" />
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-base-200 px-4">
      <button
        class="flex-1 py-3 text-sm font-medium transition-colors relative {selectedTab === 'all' ? 'text-primary' : 'text-base-content/60'}"
        onclick={() => selectedTab = 'all'}
      >
        All
        {#if selectedTab === 'all'}
          <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
        {/if}
      </button>
      <button
        class="flex-1 py-3 text-sm font-medium transition-colors relative {selectedTab === 'unread' ? 'text-primary' : 'text-base-content/60'}"
        onclick={() => selectedTab = 'unread'}
      >
        Unread
        {#if unreadCount > 0}
          <span class="ml-1 text-xs">({unreadCount})</span>
        {/if}
        {#if selectedTab === 'unread'}
          <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
        {/if}
      </button>
    </div>

    <!-- Actions -->
    {#if notifications.length > 0 && unreadCount > 0}
      <div class="px-4 py-2 border-b border-base-200 bg-base-200/30">
        <button
          class="btn btn-ghost btn-xs gap-1"
          onclick={markAllAsRead}
        >
          <Check class="h-3 w-3" />
          Mark all as read
        </button>
      </div>
    {/if}

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      {#if isLoading}
        <div class="flex items-center justify-center h-full">
          <span class="loading loading-spinner loading-md text-primary"></span>
        </div>
      {:else if error}
        <div class="flex flex-col items-center justify-center h-full p-6 text-center">
          <AlertTriangle class="h-12 w-12 text-error mb-3" />
          <p class="text-sm text-error font-medium mb-1">Failed to load notifications</p>
          <p class="text-xs text-base-content/60 mb-4">{error}</p>
          <button class="btn btn-sm btn-primary" onclick={fetchNotifications}>
            Try Again
          </button>
        </div>
      {:else if notifications.length === 0}
        <div class="flex flex-col items-center justify-center h-full p-6 text-center">
          <Bell class="h-12 w-12 text-base-content/20 mb-3" />
          <p class="text-sm text-base-content/60 font-medium mb-1">
            {selectedTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p class="text-xs text-base-content/40">
            {selectedTab === 'unread' ? 'You\'re all caught up!' : 'We\'ll notify you when something happens'}
          </p>
        </div>
      {:else}
        <div class="divide-y divide-base-200">
          {#each notifications as notification (notification.id)}
            {@const Icon = getCategoryIcon(notification.category)}
            <div
              class="relative group hover:bg-base-200/50 transition-colors {getPriorityClass(notification.priority)} {notification.status !== 'read' ? 'bg-primary/5' : ''}"
            >
              <button
                class="w-full p-4 text-left cursor-pointer"
                onclick={() => handleNotificationClick(notification)}
              >
                <div class="flex gap-3">
                  <!-- Icon -->
                  <div class="flex-shrink-0 mt-0.5">
                    <div class="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon class="h-4 w-4 text-primary" />
                    </div>
                  </div>

                  <!-- Content -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-2 mb-1">
                      <p class="font-medium text-sm text-base-content">
                        {notification.title}
                      </p>
                      {#if notification.status !== 'read'}
                        <span class="flex-shrink-0 h-2 w-2 rounded-full bg-primary"></span>
                      {/if}
                    </div>

                    <p class="text-xs text-base-content/70 line-clamp-2 mb-2">
                      {notification.message}
                    </p>

                    <div class="flex items-center justify-between">
                      <p class="text-xs text-base-content/40">
                        {formatTimestamp(notification.createdAt)}
                      </p>

                      {#if notification.actionLabel}
                        <span class="text-xs text-primary font-medium">
                          {notification.actionLabel} →
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
              </button>

              <!-- Actions (on hover) -->
              <div class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                {#if notification.status !== 'read'}
                  <button
                    class="btn btn-ghost btn-xs btn-circle"
                    onclick={(e) => {
                      e.stopPropagation();
                      markAsRead(notification.id);
                    }}
                    title="Mark as read"
                  >
                    <Check class="h-3 w-3" />
                  </button>
                {/if}
                <button
                  class="btn btn-ghost btn-xs btn-circle text-error"
                  onclick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification.id);
                  }}
                  title="Delete"
                >
                  <Trash2 class="h-3 w-3" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    {#if notifications.length > 0}
      <div class="border-t border-base-200 p-4 bg-base-100">
        <a href="/notifications" class="btn btn-sm btn-ghost w-full" onclick={onClose}>
          View All Notifications
        </a>
      </div>
    {/if}
  </div>

  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
    onclick={onClose}
  ></div>
{/if}
