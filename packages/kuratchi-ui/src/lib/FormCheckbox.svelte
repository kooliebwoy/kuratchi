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

<label class={`kui-checkbox-field ${className}`.trim()}>
  <input 
    {...field.as('checkbox')} 
    type="checkbox"
    class="kui-checkbox"
  />
  <span class="kui-label">{label}</span>
</label>
