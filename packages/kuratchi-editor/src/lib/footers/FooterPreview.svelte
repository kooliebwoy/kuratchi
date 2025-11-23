<script lang="ts">
	import type { FooterDefinition } from '../registry/footers.svelte';

	const { footer, scale = 0.35 } = $props<{
		footer: FooterDefinition;
		scale?: number;
	}>();
</script>

<div class="krt-footerPreview" aria-hidden="true" style={`--krt-footerPreview-scale: ${scale}`}>
	<div class="krt-footerPreview__frame">
		<div class="krt-footerPreview__content">
			<footer.component editable={false} />
		</div>
	</div>
</div>

<style>
	.krt-footerPreview {
		width: 100%;
		pointer-events: none;
	}

	.krt-footerPreview__frame {
		width: 100%;
		aspect-ratio: 16 / 6;
		overflow: hidden;
		padding: 0.5rem;
		border-radius: var(--krt-radius-lg, 0.75rem);
		background: var(--krt-color-surface, #ffffff);
		border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
		box-shadow: var(--krt-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.06));
	}

	.krt-footerPreview__content {
		transform: scale(var(--krt-footerPreview-scale, 0.35));
		transform-origin: top left;
		width: calc(100% / var(--krt-footerPreview-scale, 0.35));
	}

	:global(.krt-footerPreview .krt-blockActions),
	:global(.krt-footerPreview .krt-sideActions),
	:global(.krt-footerPreview .krt-editButton) {
		display: none !important;
	}

	:global(.krt-footerPreview .editor-footer-item) {
		pointer-events: none;
	}
</style>
