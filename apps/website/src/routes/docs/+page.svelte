<script lang="ts">
  import DocPage from './DocPage.svelte';
  import type { DocContent } from '$lib/docs';

  export let data: { doc: DocContent };
</script>

<DocPage {data} />
