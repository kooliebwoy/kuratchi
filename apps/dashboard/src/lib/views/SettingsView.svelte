<script lang="ts">
  import type { EnvironmentKey, RegionStatus } from '$lib/data/dashboard';

  export let keys: EnvironmentKey[];
  export let regions: RegionStatus[];
</script>

<div class="grid gap-6 lg:grid-cols-2">
  <div class="card border border-base-200 bg-base-200/30">
    <div class="card-body gap-4">
      <h3 class="text-lg font-semibold">Environment Keys</h3>
      <div class="space-y-3 text-sm">
        {#each keys as key}
          <div class="rounded-lg border border-base-200/60 bg-base-100/40 p-4">
            <p class="text-xs text-base-content/50">{key.label}</p>
            {#if key.tone === 'primary'}
              <p class="font-mono text-xs text-primary">{key.value}</p>
            {:else if key.tone === 'warning'}
              <p class="font-mono text-xs text-warning">{key.value}</p>
            {:else}
              <p class="font-mono text-xs text-error">{key.value}</p>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <div class="card border border-base-200 bg-base-200/30">
    <div class="card-body gap-4">
      <h3 class="text-lg font-semibold">Project Regions</h3>
      <div class="space-y-3">
        {#each regions as region}
          <div class="flex items-center justify-between rounded-xl border border-base-200/60 bg-base-100/40 px-4 py-3">
            <div>
              <p class="font-medium">{region.name}</p>
              <p class="text-xs text-base-content/50">{region.description}</p>
            </div>
            {#if region.status === 'Healthy'}
              <span class="badge badge-success badge-sm">Healthy</span>
            {:else}
              <span class="badge badge-warning badge-sm">Provisioning</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
