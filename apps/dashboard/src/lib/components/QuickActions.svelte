<script lang="ts">
  import type { ComponentType } from 'svelte';
  import { Button } from '@kuratchi/ui';

  type QuickAction = {
    icon: ComponentType;
    label: string;
    variant?: 'primary' | 'outline' | 'ghost';
    emphasis?: 'solid' | 'subtle';
    href?: string;
    onclick?: () => void;
  };

  export let actions: QuickAction[] = [];
</script>

<div class="kui-quick-actions">
  {#each actions as action}
    <Button
      variant={action.variant || 'outline'}
      size="xs"
      href={action.href}
      onclick={action.onclick}
    >
      <svelte:component this={action.icon} class="kui-icon" />
      {action.label}
    </Button>
  {/each}
</div>

<style>
  .kui-quick-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .kui-icon {
    width: 14px;
    height: 14px;
  }
</style>
