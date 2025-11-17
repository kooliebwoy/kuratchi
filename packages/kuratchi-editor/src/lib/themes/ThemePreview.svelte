<script lang="ts">
	import type { ThemeTemplate } from '../themes';
	import type { BlockSnapshot } from '../presets/types';
	import { resolveBlockRender } from '../render';

	const { theme, maxBodyBlocks = 3, scale = 0.4 } = $props<{
		theme: ThemeTemplate;
		maxBodyBlocks?: number;
		scale?: number;
	}>();

	const headerBlocks = $derived(theme.siteHeader?.blocks ?? []);
	const footerBlocks = $derived(theme.siteFooter?.blocks ?? []);
	const bodyBlocks = $derived((theme.defaultHomepage?.content ?? []).slice(0, maxBodyBlocks));

	const sequence = $derived([...headerBlocks, ...bodyBlocks, ...footerBlocks]);

	function keyFor(block: BlockSnapshot, index: number) {
		if (typeof block.id === 'string' && block.id.length > 0) return block.id;
		return `${block.type}-${index}`;
	}
</script>

<div class="theme-preview pointer-events-none" aria-hidden="true" style={`--preview-scale: ${scale}`}>
	<div class="preview-frame bg-base-200 border border-base-300 rounded-lg">
		<div class="preview-content space-y-2">
			{#if sequence.length === 0}
				<div class="text-xs text-base-content/70 text-center py-4">No preview data</div>
			{:else}
				{#each sequence as block, index (keyFor(block, index))}
					{@const renderable = resolveBlockRender(block)}
					{#if renderable}
						<svelte:component this={renderable.component} {...renderable.props} editable={false} />
					{/if}
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.theme-preview {
		width: 100%;
	}

	.preview-frame {
		width: 100%;
		aspect-ratio: 9 / 16;
		overflow: hidden;
		padding: 0.75rem;
	}

	.preview-content {
		transform: scale(var(--preview-scale));
		transform-origin: top left;
		width: calc(100% / var(--preview-scale));
	}

	:global(.theme-preview .absolute.-left-14),
	:global(.theme-preview .drawer) {
		display: none !important;
	}

	:global(.theme-preview .editor-item),
	:global(.theme-preview .editor-header-item),
	:global(.theme-preview .editor-footer-item) {
		pointer-events: none;
	}
</style>
