<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const { buckets } = data;
</script>

<svelte:head>
  <title>Storage - Kuratchi Dashboard</title>
</svelte:head>

<section class="space-y-8">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold">Storage Buckets</h1>
      <p class="text-sm text-base-content/60">Manage R2 storage buckets and objects</p>
    </div>
    <button class="btn btn-primary btn-sm text-primary-content">New Bucket</button>
  </div>

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
</section>
