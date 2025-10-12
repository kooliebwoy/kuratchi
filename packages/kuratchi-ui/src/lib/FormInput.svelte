<script lang="ts">
	/**
	 * FormInput - Input field for remote function forms
	 * Automatically spreads field props from remote function
	 */
	interface Props {
		field: any; // Remote function field
		type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'tel';
		placeholder?: string;
		disabled?: boolean;
		class?: string;
	}
	
	let { field, type = 'text', placeholder, disabled = false, class: className = '' }: Props = $props();
</script>

<input 
	{...field.as(type)} 
	class="input {className}"
	{placeholder}
	{disabled}
/>
