<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        id: string;
        label?: Snippet;
        content?: Snippet;
    }

    let { id, label, content }: Props = $props();
</script>

<!-- Reusable Drawer Widget -->
<div class="drawer drawer-end max-w-10">
    <input id="{id}" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content">
        {@render label?.()}
    </div>
    <div class="drawer-side z-50">
        <label for="{id}" aria-label="close sidebar" class="drawer-overlay"></label>
        <div class="menu !bg-base-200 text-base-content min-h-full p-4 min-w-96">
            {@render content?.()}
        </div>
    </div>
</div>