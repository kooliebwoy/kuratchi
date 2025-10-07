<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const { logs } = data;
</script>

<svelte:head>
  <title>Logs - Kuratchi Dashboard</title>
</svelte:head>

<section class="space-y-8">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold">Edge Logs</h1>
      <p class="text-sm text-base-content/60">Stream logs from Workers, D1, KV, and R2</p>
    </div>
    <button class="btn btn-outline btn-sm">Open live tail</button>
  </div>

  <div class="card border border-base-200 bg-base-200/30">
    <div class="card-body gap-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold">Edge Logs</h3>
          <p class="text-xs text-base-content/60">Streaming from Workers, D1, KV, and R2</p>
        </div>
      </div>
      <div class="rounded-xl border border-base-200/60 bg-base-100/40 p-4 font-mono text-xs">
        {#each logs as log}
          <p class={`text-${log.tone}`}>[{log.timestamp}] {log.message}</p>
        {/each}
      </div>
    </div>
  </div>
</section>
