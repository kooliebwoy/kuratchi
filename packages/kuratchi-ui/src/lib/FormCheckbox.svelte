<script lang="ts">
	/**
	 * FormCheckbox - Checkbox field for remote function forms
	 */
	interface Props {
		field: any; // Remote function field
		label: string;
		class?: string;
	}
	
	let { field, label, class: className = '' }: Props = $props();
</script>

<label class="label cursor-pointer gap-2 {className}">
	<input 
		{...field.as('checkbox')} 
		type="checkbox"
		class="checkbox checkbox-sm"
	/>
	<span class="label-text">{label}</span>
</label>
