<script lang="ts">
import type { BlockPresetDefinition, BlockSnapshot } from './types';
import { resolveBlockRender } from '../render';

const { preset, scale = 0.45 } = $props<{ preset: BlockPresetDefinition; scale?: number }>();

const blocks = $derived(preset.create());

	function keyFor(block: BlockSnapshot, index: number) {
		if (typeof block.id === 'string' && block.id.length > 0) return block.id;
		return `${block.type}-${index}`;
	}
</script>

<div class="preset-preview pointer-events-none" aria-hidden="true" style={`--preview-scale: ${scale ?? 0.45}`}>
	<div class="preview-frame bg-base-200 border border-base-300 rounded-lg">
		<div class="preview-content space-y-2">
			{#each blocks as block, index (keyFor(block, index))}
				{@const renderable = resolveBlockRender(block)}
				{#if renderable}
					<svelte:component this={renderable.component} {...renderable.props} editable={false} />
				{:else}
					<div class="text-xs text-error">Unable to preview block {block.type}</div>
				{/if}
			{/each}
		</div>
	</div>
</div>

<style>
	.preset-preview {
		width: 100%;
	}

	.preview-frame {
		width: 100%;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		padding: 0.75rem;
	}

	.preview-content {
		transform: scale(var(--preview-scale));
		transform-origin: top left;
		width: calc(100% / var(--preview-scale));
	}

	:global(.preset-preview .absolute.-left-14),
	:global(.preset-preview .drawer) {
		display: none !important;
	}

	:global(.preset-preview .editor-item),
	:global(.preset-preview .editor-header-item),
	:global(.preset-preview .editor-footer-item) {
		pointer-events: none;
	}
</style>
