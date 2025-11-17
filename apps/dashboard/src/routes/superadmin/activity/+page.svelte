<script lang="ts">
  import { Activity } from 'lucide-svelte';
  import { getPlatformActivity } from '$lib/functions/superadmin.remote';

  const activityQuery = getPlatformActivity();

  function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  function getActionColor(action: string) {
    switch (action?.toLowerCase()) {
      case 'create':
      case 'created':
        return 'badge-success';
      case 'update':
      case 'updated':
        return 'badge-info';
      case 'delete':
      case 'deleted':
      case 'archive':
      case 'archived':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  }
</script>

<!-- Activity Feed -->
<div class="card bg-base-100 shadow-sm">
  <div class="card-body">
    {#if activityQuery.loading}
      <div class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {:else if activityQuery.current && activityQuery.current.length > 0}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {#each activityQuery.current as log}
              <tr class="hover">
                <td class="text-sm whitespace-nowrap">
                  {formatTimestamp(log.timestamp)}
                </td>
                <td class="font-medium">
                  {log.userId || 'System'}
                </td>
                <td>
                  <span class="badge {getActionColor(log.action)} badge-sm">
                    {log.action}
                  </span>
                </td>
                <td class="text-sm">
                  {log.resourceType || '-'}
                  {#if log.resourceId}
                    <code class="text-xs text-base-content/60">#{log.resourceId}</code>
                  {/if}
                </td>
                <td class="text-sm text-base-content/70 max-w-md truncate">
                  {log.details || '-'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="flex flex-col items-center justify-center py-12 gap-3">
        <Activity class="h-16 w-16 text-base-content/30" />
        <div class="text-center">
          <p class="font-medium text-base-content/70">No activity yet</p>
          <p class="text-sm text-base-content/50">Platform activity will appear here</p>
        </div>
      </div>
    {/if}
  </div>
</div>
