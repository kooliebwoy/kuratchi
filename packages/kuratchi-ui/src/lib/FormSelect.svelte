<script lang="ts">
	/**
	 * FormSelect - Select field for remote function forms
	 */
	import type { Snippet } from 'svelte';
	
	interface Props {
		field: any; // Remote function field
		class?: string;
		children: Snippet;
	}
	
	let { field, class: className = '', children }: Props = $props();
</script>

<select {...field.as('select')} class="select {className}">
	{@render children()}
</select>
