<script lang="ts">
  interface Props {
    totalItems: number;
    pageSize?: number;
    currentPage?: number;
    maxPages?: number;
    class?: string;
    showInfo?: boolean;
    urlParam?: string;
    onPageChange?: (page: number) => void;
  }
  
  let {
    totalItems,
    pageSize = 10,
    currentPage = $bindable(1),
    maxPages = 7,
    class: className = '',
    showInfo = true,
    urlParam = 'page',
    onPageChange
  }: Props = $props();
  
  // Calculate total pages
  const totalPages = $derived(Math.ceil(totalItems / pageSize));
  
  // Calculate items range
  const startItem = $derived((currentPage - 1) * pageSize + 1);
  const endItem = $derived(Math.min(currentPage * pageSize, totalItems));
  
  // Get current page from URL on mount
  $effect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const urlPage = url.searchParams.get(urlParam);
    if (urlPage) {
      const pageNum = parseInt(urlPage, 10);
      if (!isNaN(pageNum) && pageNum > 0 && pageNum <= totalPages) {
        currentPage = pageNum;
      }
    }
  });
  
  // Generate page numbers to display
  const pageNumbers = $derived.by(() => {
    const pages: (number | 'ellipsis')[] = [];
    
    if (totalPages <= maxPages) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      const startPage = Math.max(2, currentPage - Math.floor(maxPages / 2));
      const endPage = Math.min(totalPages - 1, startPage + maxPages - 3);
      
      if (startPage > 2) {
        pages.push('ellipsis');
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (endPage < totalPages - 1) {
        pages.push('ellipsis');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
  });
  
  function updateUrl(pageNum: number) {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set(urlParam, pageNum.toString());
    window.history.replaceState({}, '', url);
  }
  
  function goToPage(pageNum: number) {
    if (pageNum < 1 || pageNum > totalPages || pageNum === currentPage) return;
    
    currentPage = pageNum;
    updateUrl(pageNum);
    onPageChange?.(pageNum);
  }
  
  function previousPage() {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }
  
  function nextPage() {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }
</script>

{#if totalPages > 1}
  <div class={`kui-pagination ${className}`.trim()}>
    {#if showInfo}
      <div class="kui-pagination__info">
        Showing <span class="font-medium">{startItem}</span> to <span class="font-medium">{endItem}</span> of{' '}
        <span class="font-medium">{totalItems}</span> results
      </div>
    {/if}
    
    <div class="kui-pagination__controls" role="group" aria-label="Table pagination">
      <button
        type="button"
        class="kui-pagination__button"
        disabled={currentPage === 1}
        onclick={previousPage}
        aria-label="Previous page"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="m15 19-7-7 7-7" />
        </svg>
      </button>
      
      {#each pageNumbers as pageNum}
        {#if pageNum === 'ellipsis'}
          <button type="button" class="kui-pagination__button" disabled aria-hidden="true">
            ...
          </button>
        {:else}
          <button
            type="button"
            class={`kui-pagination__button ${pageNum === currentPage ? 'kui-pagination__button--active' : ''}`.trim()}
            onclick={() => goToPage(pageNum)}
          >
            {pageNum}
          </button>
        {/if}
      {/each}
      
      <button
        type="button"
        class="kui-pagination__button"
        disabled={currentPage === totalPages}
        onclick={nextPage}
        aria-label="Next page"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7" />
        </svg>
      </button>
    </div>
  </div>
{/if}
