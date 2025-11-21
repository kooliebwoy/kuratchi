<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    hoverable?: boolean;
    zebra?: boolean;
    compact?: boolean;
    pinRows?: boolean;
    pinCols?: boolean;
    wrapperClass?: string;
    tableClass?: string;
    caption?: Snippet;
    head?: Snippet;
    body: Snippet;
    foot?: Snippet;
  }

  let {
    hoverable = true,
    zebra = false,
    compact = false,
    pinRows = false,
    pinCols = false,
    wrapperClass = '',
    tableClass = '',
    caption,
    head,
    body,
    foot
  }: Props = $props();

  const tableClasses = $derived([
    'kui-table',
    hoverable ? 'kui-table--hover' : '',
    zebra ? 'kui-table--zebra' : '',
    compact ? 'kui-table--compact' : '',
    pinRows ? 'kui-table--pin-rows' : '',
    pinCols ? 'kui-table--pin-cols' : '',
    tableClass
  ].filter(Boolean).join(' '));
</script>

<div class={`kui-table-wrapper ${wrapperClass}`.trim()}>
  <table class={tableClasses}>
    {#if caption}
      <caption class="kui-table__caption">
        {@render caption()}
      </caption>
    {/if}

    {#if head}
      <thead class="kui-table__head">
        {@render head()}
      </thead>
    {/if}

    <tbody class="kui-table__body">
      {@render body()}
    </tbody>

    {#if foot}
      <tfoot class="kui-table__foot">
        {@render foot()}
      </tfoot>
    {/if}
  </table>
</div>
