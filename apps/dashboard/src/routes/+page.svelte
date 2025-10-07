<script lang="ts">
  import type { PageData } from './$types';
  import QuickActions from '$lib/components/QuickActions.svelte';
  import { quickActions } from '$lib/data/dashboard';

  let { data }: { data: PageData } = $props();
  const { cards, traffic, activity, tables, providers, users } = data;
</script>

<svelte:head>
  <title>Cloud Control Center - Kuratchi Dashboard</title>
</svelte:head>

<section class="space-y-8">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold">Cloud Control Center</h1>
      <p class="text-sm text-base-content/60">Monitor and manage your SvelteKit projects across Kuratchi Cloud</p>
    </div>
    <QuickActions actions={quickActions} />
  </div>

  <div class="space-y-8">
    <div class="grid gap-6 lg:grid-cols-4">
      {#each cards as card}
        <div class="card border border-base-200/70 bg-base-200/40 shadow-soft-xl">
          <div class="card-body gap-4">
            <div class={`flex h-10 w-10 items-center justify-center rounded-xl ${card.accent}`}>
              <card.icon class="h-5 w-5" />
            </div>
            <div>
              <p class="text-xs uppercase tracking-widest text-base-content/40">{card.title}</p>
              <h3 class="mt-1 text-2xl font-semibold">{card.value}</h3>
              <p class="text-xs text-base-content/50">{card.change}</p>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <div class="card border border-base-200 bg-base-200/40 lg:col-span-2">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold">Edge Traffic</h3>
              <p class="text-xs text-base-content/50">Requests per region (last 24h)</p>
            </div>
            <button class="btn btn-xs btn-outline text-base-content/60">Download CSV</button>
          </div>
          <div class="mt-6 grid grid-cols-8 items-end gap-3">
            {#each traffic as value, index}
              <div class="flex flex-col items-center gap-2">
                <div
                  class="w-full rounded-xl bg-gradient-to-br from-primary/60 to-primary/30 py-3 text-center text-sm font-semibold text-primary-content"
                  style={`height: ${value}px`}
                >
                  {value}
                </div>
                <span class="text-[10px] uppercase tracking-[0.3em] text-base-content/40">{String.fromCharCode(65 + index)}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="card border border-base-200 bg-base-200/40">
        <div class="card-body gap-4">
          <h3 class="text-lg font-semibold">Recent Activity</h3>
          <div class="space-y-4">
            {#each activity as item}
              <div class="rounded-xl border border-base-200/60 bg-base-100/40 px-4 py-3">
                <p class="text-sm font-medium">{item.action}</p>
                <p class="text-xs text-base-content/60">{item.project}</p>
                <div class="mt-2 flex items-center justify-between text-xs text-base-content/50">
                  <span>{item.time}</span>
                  <span class="badge badge-ghost badge-sm border-primary/40 text-primary">{item.status}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <div class="card border border-base-200 bg-base-200/40 lg:col-span-2">
        <div class="card-body">
          <h3 class="text-lg font-semibold">Database Tables</h3>
          <div class="mt-4 overflow-hidden rounded-xl border border-base-200/60">
            <table class="table table-zebra table-sm">
              <thead>
                <tr class="text-xs uppercase tracking-widest text-base-content/50">
                  <th>Table</th>
                  <th>Rows</th>
                  <th>Writes/min</th>
                  <th>Status</th>
                  <th>Replication</th>
                </tr>
              </thead>
              <tbody>
                {#each tables as table}
                  <tr>
                    <td class="font-medium">{table.name}</td>
                    <td>{table.rows}</td>
                    <td>{table.writes}</td>
                    <td>
                      <span class={`badge badge-sm ${table.status === 'Online' ? 'badge-success' : 'badge-warning'}`}>{table.status}</span>
                    </td>
                    <td>{table.replication}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card border border-base-200 bg-base-200/40">
        <div class="card-body gap-4">
          <h3 class="text-lg font-semibold">Auth Providers</h3>
          <div class="space-y-3">
            {#each providers as provider}
              <div class="flex items-center justify-between rounded-xl border border-base-200/60 bg-base-100/40 px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="rounded-lg bg-primary/15 p-2 text-primary">
                    <provider.icon class="h-4 w-4" />
                  </div>
                  <div>
                    <p class="text-sm font-medium">{provider.name}</p>
                    <p class="text-xs text-base-content/50">{provider.status}</p>
                  </div>
                </div>
                <span class="text-xs text-base-content/50">Success {provider.success}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <div class="card border border-base-200 bg-base-200/40">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">Team Activity</h3>
          <button class="btn btn-outline btn-xs">Manage members</button>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {#each users as user}
            <div class="rounded-xl border border-base-200/60 bg-base-100/40 px-4 py-4">
              <div class="flex items-center justify-between">
                <div class="h-10 w-10 rounded-full bg-primary/20 text-center text-sm font-semibold leading-10 text-primary">
                  {user.avatar}
                </div>
                <span class="badge badge-ghost badge-xs text-base-content/60">{user.role}</span>
              </div>
              <div class="mt-3 text-sm">
                <p class="font-medium">{user.name}</p>
                <p class="text-xs text-base-content/50">{user.email}</p>
              </div>
              <p class="mt-3 text-xs text-base-content/40">Activity {user.activity}</p>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</section>
