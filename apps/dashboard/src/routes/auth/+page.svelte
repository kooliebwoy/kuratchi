<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const { timeline, metrics } = data;
</script>

<svelte:head>
  <title>Authentication - Kuratchi Dashboard</title>
</svelte:head>

<section class="space-y-8">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold">Authentication Insights</h1>
      <p class="text-sm text-base-content/60">Monitor auth flows and session management</p>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-2">
    <div class="card border border-base-200 bg-base-200/30">
      <div class="card-body gap-4">
        <h3 class="text-lg font-semibold">Authentication Flow</h3>
        <p class="text-xs text-base-content/60">Unified auth with sessions, magic links, OAuth, and device trust built on Kuratchi plugins.</p>
        <ul class="timeline timeline-vertical timeline-compact">
          {#each timeline as step, index (step.title)}
            <li>
              <div class="timeline-middle">
                <step.icon class="h-4 w-4 text-primary" />
              </div>
              <div class={`timeline-end timeline-box bg-base-200/50 ${index !== timeline.length - 1 ? '' : 'shadow-soft-xl'}`}>
                <p class="font-medium">{step.title}</p>
                <p class="text-xs text-base-content/50">{step.description}</p>
              </div>
              {#if index !== timeline.length - 1}
                <hr />
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    </div>

    <div class="card border border-base-200 bg-base-200/30">
      <div class="card-body gap-4">
        <h3 class="text-lg font-semibold">Auth Metrics</h3>
        <div class="stats stats-vertical shadow-soft-xl lg:stats-horizontal">
          {#each metrics as metric}
            <div class="stat">
              <div class="stat-figure text-primary">
                <metric.icon class="h-6 w-6" />
              </div>
              <div class="stat-title">{metric.label}</div>
              <div class="stat-value">{metric.value}</div>
              <div class="stat-desc">{metric.description}</div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</section>
