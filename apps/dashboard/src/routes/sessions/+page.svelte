<script lang="ts">
  import { Button, Card, Dialog, Loading } from '@kuratchi/ui';
  import { Clock, Users, Activity, Trash2, X, AlertCircle, MonitorSmartphone, MapPin, Search } from '@lucide/svelte';
  import {
    getSessions,
    getSessionStats,
    revokeSession,
    revokeAllUserSessions,
    cleanupExpiredSessions
  } from '$lib/functions/sessions.remote';

  const sessions = getSessions();
  const stats = getSessionStats();

  const sessionsList = $derived(sessions.current ? (Array.isArray(sessions.current) ? sessions.current : []) : []);
  const statsData = $derived(stats.current || { totalSessions: 0, activeSessions: 0, activeUsers: 0, sessionsLast24h: 0, expiredSessions: 0 });

  let searchQuery = $state('');
  let filterStatus = $state<'all' | 'active' | 'expired'>('active');
  let selectedUser = $state('');

  const uniqueUsers = $derived.by(() => {
    const usersMap: Record<string, any> = {};
    sessionsList.forEach((s: any) => {
      if (!usersMap[s.userId]) {
        usersMap[s.userId] = { id: s.userId, name: s.userName, email: s.userEmail };
      }
    });
    return Object.values(usersMap);
  });

  const filteredSessions = $derived.by(() => {
    let filtered = sessionsList;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((s: any) =>
        s.userName?.toLowerCase().includes(q) ||
        s.userEmail?.toLowerCase().includes(q) ||
        s.ipAddress?.toLowerCase().includes(q)
      );
    }

    if (selectedUser) {
      filtered = filtered.filter((s: any) => s.userId === selectedUser);
    }

    if (filterStatus === 'active') {
      filtered = filtered.filter((s: any) => !s.isExpired);
    } else if (filterStatus === 'expired') {
      filtered = filtered.filter((s: any) => s.isExpired);
    }

    return filtered;
  });

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

<div class="kui-page">
  <header class="kui-page__header">
    <div class="kui-inline">
      <div class="kui-icon-box accent">
        <Activity />
      </div>
      <div>
        <p class="kui-eyebrow">Security</p>
        <h1>Sessions</h1>
        <p class="kui-subtext">Monitor active user sessions and revoke access quickly.</p>
      </div>
    </div>
    <Button variant="outline" class="danger-button" onclick={handleCleanup}>
      <Trash2 class="kui-icon" />
      Cleanup expired
    </Button>
  </header>

  <div class="kui-stat-grid">
    <Card class="kui-stat">
      <div>
        <p class="kui-eyebrow">Active sessions</p>
        <p class="kui-stat__number">{statsData.activeSessions}</p>
      </div>
      <div class="kui-stat__icon success">
        <Activity class="kui-icon" />
      </div>
    </Card>
    <Card class="kui-stat">
      <div>
        <p class="kui-eyebrow">Active users</p>
        <p class="kui-stat__number">{statsData.activeUsers}</p>
      </div>
      <div class="kui-stat__icon primary">
        <Users class="kui-icon" />
      </div>
    </Card>
    <Card class="kui-stat">
      <div>
        <p class="kui-eyebrow">Last 24 hours</p>
        <p class="kui-stat__number">{statsData.sessionsLast24h}</p>
      </div>
      <div class="kui-stat__icon info">
        <Clock class="kui-icon" />
      </div>
    </Card>
    <Card class="kui-stat">
      <div>
        <p class="kui-eyebrow">Expired</p>
        <p class="kui-stat__number">{statsData.expiredSessions}</p>
      </div>
      <div class="kui-stat__icon danger">
        <AlertCircle class="kui-icon" />
      </div>
    </Card>
  </div>

  <div class="kui-filters">
    <label class="kui-input-with-icon">
      <Search class="kui-icon" />
      <input
        type="text"
        placeholder="Search sessions, users, IP…"
        class="kui-input"
        bind:value={searchQuery}
      />
    </label>

    <select class="kui-select" bind:value={selectedUser}>
      <option value="">All users</option>
      {#each uniqueUsers as user}
        <option value={user.id}>{user.name} ({user.email})</option>
      {/each}
    </select>

    <select class="kui-select" bind:value={filterStatus}>
      <option value="all">All status</option>
      <option value="active">Active only</option>
      <option value="expired">Expired only</option>
    </select>

    {#if selectedUser}
      <Button variant="outline" class="danger-button" size="sm" onclick={() => openRevokeAllConfirm(selectedUser)}>
        <Trash2 class="kui-icon" />
        Revoke all for user
      </Button>
    {/if}
  </div>

  <Card class="kui-panel">
    {#if sessions.loading}
      <div class="kui-center"><Loading /></div>
    {:else}
      <div class="kui-table-scroll">
        <table class="kui-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Device</th>
              <th>Location</th>
              <th>Created</th>
              <th>Last active</th>
              <th>Expires</th>
              <th>Status</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if filteredSessions.length > 0}
              {#each filteredSessions as session}
                {@const deviceInfo = parseUserAgent(session.userAgent)}
                <tr class:is-muted={session.isExpired}>
                  <td>
                    <div class="kui-inline">
                      <div class="kui-avatar">{session.userName?.charAt(0)?.toUpperCase() || 'U'}</div>
                      <div>
                        <div class="kui-strong">{session.userName}</div>
                        <div class="kui-subtext">{session.userEmail}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="kui-inline">
                      <MonitorSmartphone class="kui-icon" />
                      <div>
                        <div>{deviceInfo.browser}</div>
                        <div class="kui-subtext">{deviceInfo.os}</div>
                      </div>
                    </div>
                  </td>
                  <td class="kui-inline">
                    <MapPin class="kui-icon" />
                    <span>{session.ipAddress}</span>
                  </td>
                  <td>
                    <div>{getTimeAgo(session.createdAt)}</div>
                    <div class="kui-subtext">{formatDate(session.createdAt)}</div>
                  </td>
                  <td>{getTimeAgo(session.lastAccessedAt)}</td>
                  <td>{formatDate(session.expiresAt)}</td>
                  <td>
                    {#if session.isExpired}
                      <span class="kui-pill danger">Expired</span>
                    {:else if session.isCurrent}
                      <span class="kui-pill info">Current</span>
                    {:else}
                      <span class="kui-pill success">Active</span>
                    {/if}
                  </td>
                  <td class="text-right">
                    {#if !session.isExpired}
                      <Button
                        variant="ghost"
                        size="xs"
                        class="danger-button"
                        onclick={() => openRevokeConfirm(session)}
                        aria-label="Revoke session"
                      >
                        <Trash2 class="kui-icon" />
                      </Button>
                    {/if}
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="8">
                  <div class="kui-empty">
                    <Activity class="kui-empty__icon" />
                    <p>No sessions found</p>
                    {#if searchQuery || selectedUser || filterStatus !== 'all'}
                      <p class="kui-subtext">Try adjusting your filters.</p>
                    {/if}
                  </div>
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    {/if}
  </Card>
</div>

<Dialog
  bind:open={showRevokeConfirm}
  size="sm"
  onClose={() => { showRevokeConfirm = false; revokingSession = null; }}
>
  {#if revokingSession}
    {#snippet header()}
      <div class="kui-modal-header">
        <div>
          <p class="kui-eyebrow danger">Session</p>
          <h3>Revoke session</h3>
        </div>
        <Button variant="ghost" size="xs" onclick={() => { showRevokeConfirm = false; revokingSession = null; }} aria-label="Close">
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}

    <div class="kui-stack">
      <p class="kui-subtext">Revoke access for <strong>{revokingSession.userName}</strong> immediately.</p>
      <div class="kui-info-box">
        <div><strong>Email:</strong> {revokingSession.userEmail}</div>
        <div><strong>IP:</strong> {revokingSession.ipAddress}</div>
        <div><strong>Created:</strong> {formatDate(revokingSession.createdAt)}</div>
      </div>
      <p class="kui-subtext warning">The user will be logged out right away.</p>

      <div class="kui-modal-actions">
        <Button variant="ghost" type="button" onclick={() => { showRevokeConfirm = false; revokingSession = null; }}>
          Cancel
        </Button>
        <form {...revokeSession} onsubmit={() => { showRevokeConfirm = false; revokingSession = null; }}>
          <input type="hidden" name="sessionToken" value={revokingSession.sessionToken} />
          <Button type="submit" variant="primary" class="danger-button">Revoke session</Button>
        </form>
      </div>
    </div>
  {/if}
</Dialog>

<Dialog
  bind:open={showRevokeAllConfirm}
  size="sm"
  onClose={() => { showRevokeAllConfirm = false; revokingUserId = null; }}
>
  {#if revokingUserId}
    {@const user = uniqueUsers.find((u: any) => u.id === revokingUserId)}
    {#snippet header()}
      <div class="kui-modal-header">
        <div>
          <p class="kui-eyebrow danger">Security</p>
          <h3>Revoke all sessions</h3>
        </div>
        <Button variant="ghost" size="xs" onclick={() => { showRevokeAllConfirm = false; revokingUserId = null; }} aria-label="Close">
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}

    <div class="kui-stack">
      <p class="kui-subtext">
        Remove every active session for <strong>{user?.name}</strong>.
      </p>
      <div class="kui-info-box">
        <div><strong>Email:</strong> {user?.email}</div>
        <div><strong>Active sessions:</strong> {sessionsList.filter((s: any) => s.userId === revokingUserId && !s.isExpired).length}</div>
      </div>
      <p class="kui-subtext warning">This logs the user out on all devices.</p>

      <div class="kui-modal-actions">
        <Button variant="ghost" type="button" onclick={() => { showRevokeAllConfirm = false; revokingUserId = null; }}>
          Cancel
        </Button>
        <form {...revokeAllUserSessions} onsubmit={() => { showRevokeAllConfirm = false; revokingUserId = null; }}>
          <input type="hidden" name="userId" value={revokingUserId} />
          <Button type="submit" variant="primary" class="danger-button">Revoke all sessions</Button>
        </form>
      </div>
    </div>
  {/if}
</Dialog>

<form {...cleanupExpiredSessions} id="cleanup-form" style="display: none;"></form>

<style>
  .kui-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .kui-page__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .kui-inline {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .kui-icon-box {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #eef2ff;
    color: #4338ca;
  }

  .kui-icon-box.accent {
    background: linear-gradient(135deg, #c7d2fe, #a5b4fc);
    color: #1d1b72;
  }

  h1 {
    margin: 0;
    font-size: 26px;
  }

  .kui-eyebrow {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--kui-muted, #6b7280);
    margin: 0 0 6px;
  }

  .kui-subtext {
    color: var(--kui-muted, #6b7280);
    margin: 0;
  }

  .kui-stat-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }

  .kui-stat {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
  }

  .kui-stat__number {
    font-size: 28px;
    font-weight: 700;
    margin: 0;
  }

  .kui-stat__icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: #f4f4f5;
    color: #18181b;
  }

  .kui-stat__icon.success {
    background: #ecfdf3;
    color: #15803d;
  }

  .kui-stat__icon.primary {
    background: #eef2ff;
    color: #4338ca;
  }

  .kui-stat__icon.info {
    background: #e0f2fe;
    color: #0284c7;
  }

  .kui-stat__icon.danger {
    background: #fef2f2;
    color: #b91c1c;
  }

  .kui-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .kui-input-with-icon {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid #e4e4e7;
    border-radius: 12px;
    background: white;
    min-width: 240px;
  }

  .kui-input {
    border: none;
    outline: none;
    width: 100%;
    font-size: 14px;
    background: transparent;
  }

  .kui-select {
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid #e4e4e7;
    background: white;
    min-width: 170px;
  }

  .kui-panel {
    padding: 16px;
  }

  .kui-table-scroll {
    overflow: auto;
  }

  .kui-table {
    width: 100%;
    border-collapse: collapse;
  }

  .kui-table th,
  .kui-table td {
    padding: 12px;
    border-bottom: 1px solid #f1f1f3;
    text-align: left;
    vertical-align: middle;
  }

  .kui-table th {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #6b7280;
  }

  .kui-table tr.is-muted {
    opacity: 0.6;
  }

  .kui-avatar {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    background: #eef2ff;
    color: #4338ca;
    display: grid;
    place-items: center;
    font-weight: 700;
  }

  .kui-strong {
    font-weight: 600;
  }

  .kui-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    background: #f4f4f5;
    color: #3f3f46;
  }

  .kui-pill.success {
    background: #ecfdf3;
    color: #15803d;
  }

  .kui-pill.info {
    background: #eff6ff;
    color: #1d4ed8;
  }

  .kui-pill.danger {
    background: #fef2f2;
    color: #b91c1c;
  }

  .text-right {
    text-align: right;
  }

  .kui-empty {
    padding: 32px 12px;
    display: grid;
    gap: 8px;
    justify-items: center;
  }

  .kui-empty__icon {
    width: 40px;
    height: 40px;
    color: #d4d4d8;
  }

  .danger-button {
    color: #b91c1c;
    border-color: rgba(239, 68, 68, 0.35);
  }

  .danger-button:hover {
    background: rgba(239, 68, 68, 0.08);
  }

  .kui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .kui-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .kui-info-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 10px 12px;
    display: grid;
    gap: 6px;
    font-size: 14px;
  }

  .kui-subtext.warning {
    color: #b91c1c;
  }

  .kui-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
