<script lang="ts">
	import type { HeaderDefinition } from '../registry/headers.svelte';

	const { header, scale = 0.35 } = $props<{
		header: HeaderDefinition;
		scale?: number;
	}>();
</script>

<div class="krt-headerPreview" aria-hidden="true" style={`--krt-headerPreview-scale: ${scale}`}>
	<div class="krt-headerPreview__frame">
		<div class="krt-headerPreview__content">
			<header.component editable={false} />
		</div>
	</div>
</div>

<style>
	.krt-headerPreview {
		width: 100%;
		pointer-events: none;
	}

	.krt-headerPreview__frame {
		width: 100%;
		aspect-ratio: 16 / 5;
		overflow: hidden;
		padding: 0.5rem;
		border-radius: var(--krt-radius-lg, 0.75rem);
		background: var(--krt-color-surface, #ffffff);
		border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
		box-shadow: var(--krt-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.06));
	}

	.krt-headerPreview__content {
		transform: scale(var(--krt-headerPreview-scale, 0.35));
		transform-origin: top left;
		width: calc(100% / var(--krt-headerPreview-scale, 0.35));
	}

	:global(.krt-headerPreview .krt-blockActions),
	:global(.krt-headerPreview .krt-sideActions),
	:global(.krt-headerPreview .krt-editButton) {
		display: none !important;
	}

	:global(.krt-headerPreview .editor-header-item) {
		pointer-events: none;
	}
</style>
