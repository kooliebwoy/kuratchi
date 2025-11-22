# LayoutBlock to BlockActions + SideActions Conversion Status

## Conversion Pattern

All components need these 3 changes:

### 1. Update imports
```typescript
// OLD
import { LayoutBlock } from '../shell/index.js';

// NEW
import { onMount } from 'svelte';
import { Pencil } from 'lucide-svelte';
import { BlockActions, SideActions } from '../shell/index.js';
```

### 2. Add state variables (before `</script>`)
```typescript
let component: HTMLElement;
let mounted = $state(false);
const sideActionsId = `side-actions-${id}`;

onMount(() => {
    mounted = true;
});
```

### 3. Replace LayoutBlock wrapper
```svelte
<!-- OLD -->
{#if editable}
<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <!-- drawer content -->
    {/snippet}
    {#snippet children()}
        <!-- main content -->
    {/snippet}
</LayoutBlock>

<!-- NEW -->
{#if editable}
<div class="editor-item" bind:this={component}>
    {#if mounted}
        <BlockActions {id} {type} element={component} />
    {/if}
    <!-- main content (moved from children snippet) -->
</div>

<SideActions triggerId={sideActionsId}>
    {#snippet label()}
        <button id={sideActionsId} class="krt-editButton" aria-label="Edit settings">
            <Pencil size={16} />
            <span>Edit Settings</span>
        </button>
    {/snippet}
    {#snippet content()}
        <!-- drawer content (moved from drawerContent snippet) -->
    {/snippet}
</SideActions>
```

## Completed (11/25)
- ✅ HeroFigure.svelte
- ✅ HeroOverlay.svelte
- ✅ BlogHero.svelte
- ✅ AboutUs.svelte
- ✅ AboutUsCard.svelte
- ✅ IconBar.svelte
- ✅ BlogPostList.svelte
- ✅ CardWithSlider.svelte
- ✅ GridCTAs.svelte

## Remaining (14/25)

### Sections (5)
- ⏳ ServicesGrid.svelte
- ⏳ SaigeBlakeHeader.svelte
- ⏳ SaigeBlakeFooter.svelte
- ⏳ TwigAndPearlHeader.svelte
- ⏳ TwigAndPearlFooter.svelte

### Blocks (9)
- ⏳ BasicCarousel.svelte
- ⏳ CardNoImage.svelte
- ⏳ CardWithImage.svelte
- ⏳ Carousel.svelte
- ⏳ FeaturedBlogs.svelte
- ⏳ HoverCard.svelte
- ⏳ Modal.svelte
- ⏳ NoMarginCarousel.svelte
- ⏳ ProductCarousel.svelte

## Next Steps
1. Convert remaining 14 files using the pattern above
2. Delete `LayoutBlock.svelte`
3. Update `shell/index.ts` to only export `BlockActions` and `SideActions`
4. Verify all imports are updated
