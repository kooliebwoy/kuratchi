<script lang="ts">
	import type { Component } from 'svelte';

	const { component, scale = 0.3 } = $props<{
		component: Component<any>;
		scale?: number;
	}>();

	// Wrap in object like ThemePreview does
	const item = $derived({ component });
</script>

<div class="krt-sectionPreview" aria-hidden="true" style={`--krt-sectionPreview-scale: ${scale}`}>
	<div class="krt-sectionPreview__frame">
		<div class="krt-sectionPreview__content">
			{#if item.component}
				<item.component editable={false} />
			{/if}
		</div>
	</div>
</div>

<style>
	.krt-sectionPreview {
		width: 100%;
		pointer-events: none;
	}

	.krt-sectionPreview__frame {
		width: 100%;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		padding: 0.5rem;
		border-radius: var(--krt-radius-lg, 0.75rem);
		background: #f8f9fa;
		border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
		box-shadow: var(--krt-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.06));
	}

	.krt-sectionPreview__content {
		transform: scale(var(--krt-sectionPreview-scale, 0.3));
		transform-origin: top left;
		width: calc(100% / var(--krt-sectionPreview-scale, 0.3));
		height: calc(100% / var(--krt-sectionPreview-scale, 0.3));
		background: #ffffff;
	}

	:global(.krt-sectionPreview .absolute.-left-14),
	:global(.krt-sectionPreview .drawer),
	:global(.krt-sectionPreview .krt-editButton),
	:global(.krt-sectionPreview [id^="side-actions-"]) {
		display: none !important;
	}

	:global(.krt-sectionPreview .editor-item) {
		pointer-events: none;
	}
</style>
