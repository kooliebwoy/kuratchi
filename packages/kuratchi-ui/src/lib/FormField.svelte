<script lang="ts">
	/**
	 * FormField - Wrapper component for remote function form fields
	 * Provides consistent styling and error display
	 */
	import type { Snippet } from 'svelte';
	
	interface Props {
		label: string;
		issues?: Array<{ message: string }>;
		hint?: string;
		children: Snippet;
	}
	
	let { label, issues = [], hint, children }: Props = $props();
</script>

<fieldset class="fieldset">
	<legend class="fieldset-legend">{label}</legend>
	{@render children()}
	{#if hint}
		<p class="label-text-alt text-base-content/60 mt-1">{hint}</p>
	{/if}
	{#each issues as issue}
		<p class="label text-error text-sm mt-1">{issue.message}</p>
	{/each}
</fieldset>
