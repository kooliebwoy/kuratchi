<script lang="ts">
	/**
	 * FormTextarea - Textarea field for remote function forms
	 */
	interface Props {
		field: any; // Remote function field
		placeholder?: string;
		rows?: number;
		class?: string;
	}
	
	let { field, placeholder, rows = 3, class: className = '' }: Props = $props();
</script>

<textarea 
	{...field.as('text')} 
	class={`kui-textarea ${className}`.trim()}
	{placeholder}
	{rows}
></textarea>
