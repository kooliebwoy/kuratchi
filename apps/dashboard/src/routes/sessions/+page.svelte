<script lang="ts">
  import { Clock, Users, Activity, Trash2, X, AlertCircle, MonitorSmartphone, MapPin, Search } from 'lucide-svelte';
  import {
    getSessions,
    getSessionStats,
    revokeSession,
    revokeAllUserSessions,
    cleanupExpiredSessions
  } from '$lib/functions/sessions.remote';

  // Data sources
  const sessions = getSessions();
  const stats = getSessionStats();

  // Derived lists
  const sessionsList = $derived(sessions.current ? (Array.isArray(sessions.current) ? sessions.current : []) : []);
  const statsData = $derived(stats.current || { totalSessions: 0, activeSessions: 0, activeUsers: 0, sessionsLast24h: 0, expiredSessions: 0 });

  // Filter state
  let searchQuery = $state('');
  let filterStatus = $state<'all' | 'active' | 'expired'>('active');
  let selectedUser = $state('');

  // Get unique users from sessions
  const uniqueUsers = $derived.by(() => {
    const usersMap: Record<string, any> = {};
    sessionsList.forEach((s: any) => {
      if (!usersMap[s.userId]) {
        usersMap[s.userId] = { id: s.userId, name: s.userName, email: s.userEmail };
      }
    });
    return Object.values(usersMap);
  });

  // Filtered sessions
  const filteredSessions = $derived.by(() => {
    let filtered = sessionsList;

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((s: any) =>
        s.userName?.toLowerCase().includes(q) ||
        s.userEmail?.toLowerCase().includes(q) ||
        s.ipAddress?.toLowerCase().includes(q)
      );
    }

    // User filter
    if (selectedUser) {
      filtered = filtered.filter((s: any) => s.userId === selectedUser);
    }

    // Status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter((s: any) => !s.isExpired);
    } else if (filterStatus === 'expired') {
      filtered = filtered.filter((s: any) => s.isExpired);
    }

    return filtered;
  });

  // Modal state
  let showRevokeConfirm = $state(false);
  let showRevokeAllConfirm = $state(false);
  let revokingSession = $state<any>(null);
  let revokingUserId = $state<string | null>(null);

  function openRevokeConfirm(session: any) {
    revokingSession = session;
    showRevokeConfirm = true;
  }

  function openRevokeAllConfirm(userId: string) {
    revokingUserId = userId;
    showRevokeAllConfirm = true;
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString();
  }

  function getTimeAgo(dateStr: string) {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function parseUserAgent(ua: string) {
    if (!ua || ua === 'Unknown') return { browser: 'Unknown', os: 'Unknown' };
    
    // Simple user agent parsing
    let browser = 'Unknown';
    let os = 'Unknown';

    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS')) os = 'iOS';

    return { browser, os };
  }

  function handleCleanup() {
    const formEl = document.getElementById('cleanup-form') as HTMLFormElement;
    formEl?.requestSubmit();
  }
</script>

<svelte:head>
  <title>Sessions Management - Kuratchi Dashboard</title>
</svelte:head>

<div class="p-8">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        <Activity class="h-6 w-6 text-primary" />
      </div>
      <div>
        <h1 class="text-2xl font-bold">Sessions Management</h1>
        <p class="text-sm text-base-content/70">Monitor and manage active user sessions</p>
      </div>
    </div>
    <button class="btn btn-outline btn-error" onclick={handleCleanup}>
      <Trash2 class="h-4 w-4" />
      Cleanup Expired
    </button>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold">Active Sessions</p>
            <p class="text-3xl font-bold text-success">{statsData.activeSessions}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
            <Activity class="h-6 w-6 text-success" />
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold">Active Users</p>
            <p class="text-3xl font-bold text-primary">{statsData.activeUsers}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users class="h-6 w-6 text-primary" />
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold">Last 24 Hours</p>
            <p class="text-3xl font-bold text-info">{statsData.sessionsLast24h}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
            <Clock class="h-6 w-6 text-info" />
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold">Expired</p>
            <p class="text-3xl font-bold text-error">{statsData.expiredSessions}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-error/10 flex items-center justify-center">
            <AlertCircle class="h-6 w-6 text-error" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="mb-6 flex flex-wrap gap-4">
    <div class="form-control">
      <div class="input-group">
        <span class="bg-base-200">
          <Search class="h-4 w-4" />
        </span>
        <input
          type="text"
          placeholder="Search sessions..."
          class="input input-bordered input-sm"
          bind:value={searchQuery}
        />
      </div>
    </div>

    <select class="select select-bordered select-sm" bind:value={selectedUser}>
      <option value="">All Users</option>
      {#each uniqueUsers as user}
        <option value={user.id}>{user.name} ({user.email})</option>
      {/each}
    </select>

    <select class="select select-bordered select-sm" bind:value={filterStatus}>
      <option value="all">All Status</option>
      <option value="active">Active Only</option>
      <option value="expired">Expired Only</option>
    </select>

    {#if selectedUser}
      <button
        class="btn btn-outline btn-error btn-sm"
        onclick={() => openRevokeAllConfirm(selectedUser)}
      >
        <Trash2 class="h-4 w-4" />
        Revoke All for User
      </button>
    {/if}
  </div>

  <!-- Sessions Table -->
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Device</th>
              <th>Location</th>
              <th>Created</th>
              <th>Last Active</th>
              <th>Expires</th>
              <th>Status</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if sessions.loading}
              <tr>
                <td colspan="8" class="text-center py-8">
                  <span class="loading loading-spinner loading-md"></span>
                </td>
              </tr>
            {:else if filteredSessions.length > 0}
              {#each filteredSessions as session}
                {@const deviceInfo = parseUserAgent(session.userAgent)}
                <tr class="hover {session.isExpired ? 'opacity-50' : ''}">
                  <td>
                    <div class="flex items-center gap-3">
                      <div class="avatar placeholder">
                        <div class="bg-primary/10 text-primary rounded-full w-10">
                          <span class="text-sm font-semibold">
                            {session.userName?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div class="font-medium">{session.userName}</div>
                        <div class="text-xs text-base-content/60">{session.userEmail}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="flex items-center gap-2">
                      <MonitorSmartphone class="h-4 w-4 text-base-content/60" />
                      <div>
                        <div class="text-sm">{deviceInfo.browser}</div>
                        <div class="text-xs text-base-content/60">{deviceInfo.os}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="flex items-center gap-2">
                      <MapPin class="h-4 w-4 text-base-content/60" />
                      <span class="text-sm">{session.ipAddress}</span>
                    </div>
                  </td>
                  <td>
                    <div class="text-sm">{getTimeAgo(session.createdAt)}</div>
                    <div class="text-xs text-base-content/60">{formatDate(session.createdAt)}</div>
                  </td>
                  <td>
                    <div class="text-sm">{getTimeAgo(session.lastAccessedAt)}</div>
                  </td>
                  <td>
                    <div class="text-sm">{formatDate(session.expiresAt)}</div>
                  </td>
                  <td>
                    {#if session.isExpired}
                      <span class="badge badge-error badge-sm">Expired</span>
                    {:else if session.isCurrent}
                      <span class="badge badge-success badge-sm">Current</span>
                    {:else}
                      <span class="badge badge-success badge-sm">Active</span>
                    {/if}
                  </td>
                  <td class="text-right">
                    {#if !session.isExpired}
                      <button
                        class="btn btn-ghost btn-sm btn-square text-error"
                        onclick={() => openRevokeConfirm(session)}
                        title="Revoke session"
                      >
                        <Trash2 class="h-4 w-4" />
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="8" class="text-center py-8">
                  <div class="flex flex-col items-center gap-2">
                    <Activity class="h-12 w-12 text-base-content/30" />
                    <p class="text-base-content/70">No sessions found</p>
                    {#if searchQuery || selectedUser || filterStatus !== 'all'}
                      <p class="text-sm text-base-content/50">Try adjusting your filters</p>
                    {/if}
                  </div>
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- Revoke Session Confirmation Modal -->
{#if showRevokeConfirm && revokingSession}
  <div class="modal modal-open">
    <div class="modal-box">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg text-error">Revoke Session</h3>
        <button class="btn btn-ghost btn-sm btn-circle" onclick={() => { showRevokeConfirm = false; revokingSession = null; }}>
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="space-y-4">
        <p class="text-base-content/70">
          Are you sure you want to revoke the session for <strong>{revokingSession.userName}</strong>?
        </p>
        <div class="bg-base-200 p-3 rounded-lg text-sm space-y-1">
          <div><strong>Email:</strong> {revokingSession.userEmail}</div>
          <div><strong>IP:</strong> {revokingSession.ipAddress}</div>
          <div><strong>Created:</strong> {formatDate(revokingSession.createdAt)}</div>
        </div>
        <p class="text-sm text-warning">The user will be logged out immediately.</p>

        <div class="flex gap-2 justify-end">
          <button type="button" class="btn btn-outline" onclick={() => { showRevokeConfirm = false; revokingSession = null; }}>
            Cancel
          </button>
          <form {...revokeSession} onsubmit={() => { showRevokeConfirm = false; revokingSession = null; }}>
            <input type="hidden" name="sessionToken" value={revokingSession.sessionToken} />
            <button type="submit" class="btn btn-error">Revoke Session</button>
          </form>
        </div>
      </div>
    </div>
    <button type="button" class="modal-backdrop" onclick={() => { showRevokeConfirm = false; revokingSession = null; }} aria-label="Close modal"></button>
  </div>
{/if}

<!-- Revoke All User Sessions Confirmation Modal -->
{#if showRevokeAllConfirm && revokingUserId}
  <div class="modal modal-open">
    <div class="modal-box">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg text-error">Revoke All Sessions</h3>
        <button class="btn btn-ghost btn-sm btn-circle" onclick={() => { showRevokeAllConfirm = false; revokingUserId = null; }}>
          <X class="h-4 w-4" />
        </button>
      </div>

      {#if revokingUserId}
        {@const user = uniqueUsers.find((u: any) => u.id === revokingUserId)}
        <div class="space-y-4">
          <p class="text-base-content/70">
            Are you sure you want to revoke <strong>ALL</strong> sessions for <strong>{user?.name}</strong>?
          </p>
          <div class="bg-base-200 p-3 rounded-lg text-sm space-y-1">
            <div><strong>Email:</strong> {user?.email}</div>
            <div><strong>Active Sessions:</strong> {sessionsList.filter((s: any) => s.userId === revokingUserId && !s.isExpired).length}</div>
          </div>
          <p class="text-sm text-error">This will log the user out from all devices.</p>

          <div class="flex gap-2 justify-end">
            <button type="button" class="btn btn-outline" onclick={() => { showRevokeAllConfirm = false; revokingUserId = null; }}>
              Cancel
            </button>
            <form {...revokeAllUserSessions} onsubmit={() => { showRevokeAllConfirm = false; revokingUserId = null; }}>
              <input type="hidden" name="userId" value={revokingUserId} />
              <button type="submit" class="btn btn-error">Revoke All Sessions</button>
            </form>
          </div>
        </div>
      {/if}
    </div>
    <button type="button" class="modal-backdrop" onclick={() => { showRevokeAllConfirm = false; revokingUserId = null; }} aria-label="Close modal"></button>
  </div>
{/if}

<!-- Hidden cleanup form -->
<form {...cleanupExpiredSessions} id="cleanup-form" style="display: none;"></form>
