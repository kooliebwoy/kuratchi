<script lang="ts">
  import type { StorageBucket } from '$lib/data/dashboard';

  export let buckets: StorageBucket[];
</script>

<div class="grid gap-6 lg:grid-cols-2">
  {#each buckets as bucket}
    <div class="card border border-base-200 bg-base-200/30">
      <div class="card-body gap-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold">{bucket.name}</h3>
            <p class="text-xs text-base-content/50">Region {bucket.region}</p>
          </div>
          <span class="badge badge-outline badge-sm text-accent">{bucket.status}</span>
        </div>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-xs text-base-content/50">Size</p>
            <p class="text-lg font-semibold">{bucket.size}</p>
          </div>
          <div>
            <p class="text-xs text-base-content/50">Objects</p>
            <p class="text-lg font-semibold">{bucket.objects}</p>
          </div>
        </div>
        <button class="btn btn-outline btn-sm">View Files</button>
      </div>
    </div>
  {/each}
</div>
