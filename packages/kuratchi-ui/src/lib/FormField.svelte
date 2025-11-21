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

<fieldset class="kui-fieldset">
	<legend class="kui-fieldset__legend">{label}</legend>
	{@render children()}
	{#if hint}
		<p class="kui-helper-text kui-fieldset__hint">{hint}</p>
	{/if}
	{#each issues as issue}
		<p class="kui-error-text kui-fieldset__error">{issue.message}</p>
	{/each}
</fieldset>
