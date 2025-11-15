<script lang="ts">
  import '../app.css';
  import type { LayoutData } from './$types';
  import type { Snippet } from 'svelte';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="flex min-h-screen bg-base-100 text-base-content">
  {@render children()}
</div>
