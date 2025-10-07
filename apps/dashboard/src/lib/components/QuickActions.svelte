<script lang="ts">
  import type { ComponentType } from 'svelte';

  type QuickAction = {
    icon: ComponentType;
    label: string;
    variant: string;
    emphasis: string;
  };

  export let actions: QuickAction[] = [];
</script>

<div class="flex gap-2">
  {#each actions as action}
    <button class={`btn btn-sm ${action.variant} ${action.emphasis}`}>
      <svelte:component this={action.icon} class="h-4 w-4" />
      {action.label}
    </button>
  {/each}
</div>
