<script lang="ts">
  import type { DatabaseTable } from '$lib/data/dashboard';

  export let tables: DatabaseTable[];
</script>

<div class="card border border-base-200 bg-base-200/30">
  <div class="card-body gap-6">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">Database Explorer</h3>
        <p class="text-xs text-base-content/60">Live replica metrics from multi-region D1 clusters</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm">Run Query</button>
        <button class="btn btn-primary btn-sm text-primary-content">New Table</button>
      </div>
    </div>
    <div class="overflow-hidden rounded-xl border border-base-200/60">
      <table class="table">
        <thead class="bg-base-200/50 text-xs uppercase tracking-widest text-base-content/40">
          <tr>
            <th>Table</th>
            <th>Columns</th>
            <th>Indexes</th>
            <th>Read Latency</th>
            <th>Replication</th>
            <th>Maintained By</th>
          </tr>
        </thead>
        <tbody>
          {#each tables as table}
            <tr class="text-sm">
              <td class="font-semibold text-primary">{table.name}</td>
              <td>12</td>
              <td>4</td>
              <td>85 ms</td>
              <td>{table.replication}</td>
              <td class="text-base-content/50">Kuratchi Autoscaler</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
