<script lang="ts">
	import type { ThemeTemplate } from '../themes';
	import type { BlockSnapshot } from '../types';
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

<div class="krt-themePreview" aria-hidden="true" style={`--krt-themePreview-scale: ${scale}`}>
	<div class="krt-themePreview__frame">
		<div class="krt-themePreview__content">
			{#if sequence.length === 0}
				<div class="krt-themePreview__empty">No preview data</div>
			{:else}
				{#each sequence as block, index (keyFor(block, index))}
					{@const renderable = resolveBlockRender(block)}
					{#if renderable}
						<renderable.component {...renderable.props} editable={false} />
					{/if}
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.krt-themePreview {
		width: 100%;
		pointer-events: none;
	}

	.krt-themePreview__frame {
		width: 100%;
		aspect-ratio: 9 / 16;
		overflow: hidden;
		padding: 0.75rem;
		border-radius: var(--krt-radius-xl, 1rem);
		background: var(--krt-color-surface, #ffffff);
		border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
		box-shadow: var(--krt-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.06));
	}

	.krt-themePreview__content {
		display: flex;
		flex-direction: column;
		gap: var(--krt-space-sm, 0.5rem);
		transform: scale(var(--krt-themePreview-scale, 0.4));
		transform-origin: top left;
		width: calc(100% / var(--krt-themePreview-scale, 0.4));
	}

	.krt-themePreview__empty {
		font-size: 0.75rem;
		text-align: center;
		padding: 1rem 0;
		color: var(--krt-color-muted, #6b7280);
	}

	:global(.krt-themePreview .absolute.-left-14),
	:global(.krt-themePreview .drawer) {
		display: none !important;
	}

	:global(.krt-themePreview .editor-item),
	:global(.krt-themePreview .editor-header-item),
	:global(.krt-themePreview .editor-footer-item) {
		pointer-events: none;
	}
</style>
