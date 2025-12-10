<script lang="ts">
    import { Loader2 } from '@lucide/svelte';

    interface FormField {
        id: string;
        type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'file';
        label: string;
        placeholder?: string;
        required: boolean;
        name: string;
        options?: { id: string; label: string; value: string }[];
        defaultValue?: string;
        helpText?: string;
        validation?: {
            min?: number;
            max?: number;
            pattern?: string;
            errorMessage?: string;
        };
        width?: '25' | '33' | '50' | '66' | '75' | '100';
    }

    interface Form {
        id: string;
        name: string;
        description?: string;
        fields: FormField[];
        settings: {
            formName: string;
            submitButtonText: string;
            successMessage: string;
            errorMessage: string;
            recipients: string[];
            autoResponder?: {
                enabled: boolean;
                subject: string;
                message: string;
                replyTo?: string;
            };
            styling?: {
                buttonColor?: string;
                buttonTextColor?: string;
                borderRadius?: string;
                spacing?: 'compact' | 'normal' | 'relaxed';
            };
            redirectUrl?: string;
            submitEndpoint?: string;
        };
        styling?: {
            buttonColor?: string;
            buttonTextColor?: string;
            borderRadius?: string;
            spacing?: 'compact' | 'normal' | 'relaxed';
        };
    }

    interface Props {
        form: Form;
        prefillData?: Record<string, any>;
        onSubmit: (data: Record<string, any>) => void | Promise<void>;
        isSubmitting?: boolean;
    }

    let { form, prefillData = {}, onSubmit, isSubmitting = false }: Props = $props();

    // Form state
    let formData = $state<Record<string, any>>({});
    let errors = $state<Record<string, string>>({});
    let touched = $state<Record<string, boolean>>({});

    // Initialize form data with defaults and prefill
    $effect(() => {
        const initial: Record<string, any> = {};
        form.fields.forEach(field => {
            // Priority: prefillData > defaultValue > empty
            initial[field.name] = prefillData[field.name] ?? field.defaultValue ?? '';
        });
        formData = initial;
    });

    // Get field width class
    function getWidthClass(width?: string): string {
        switch (width) {
            case '25': return 'form-renderer__field--w25';
            case '33': return 'form-renderer__field--w33';
            case '50': return 'form-renderer__field--w50';
            case '66': return 'form-renderer__field--w66';
            case '75': return 'form-renderer__field--w75';
            default: return 'form-renderer__field--w100';
        }
    }

    // Get spacing class
    function getSpacingClass(): string {
        const spacing = form.settings?.styling?.spacing || form.styling?.spacing || 'normal';
        return `form-renderer--${spacing}`;
    }

    // Validate a single field
    function validateField(field: FormField, value: any): string | null {
        if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
            return `${field.label} is required`;
        }

        if (value && field.validation) {
            if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                return 'Please enter a valid email address';
            }

            if (field.validation.pattern) {
                const regex = new RegExp(field.validation.pattern);
                if (!regex.test(value)) {
                    return field.validation.errorMessage || 'Invalid format';
                }
            }

            if (field.validation.min !== undefined && value.length < field.validation.min) {
                return `Minimum ${field.validation.min} characters required`;
            }

            if (field.validation.max !== undefined && value.length > field.validation.max) {
                return `Maximum ${field.validation.max} characters allowed`;
            }
        }

        return null;
    }

    // Validate all fields
    function validateForm(): boolean {
        const newErrors: Record<string, string> = {};
        let isValid = true;

        form.fields.forEach(field => {
            const error = validateField(field, formData[field.name]);
            if (error) {
                newErrors[field.name] = error;
                isValid = false;
            }
        });

        errors = newErrors;
        return isValid;
    }

    // Handle field change
    function handleChange(field: FormField, value: any) {
        formData[field.name] = value;
        
        // Clear error on change if field was touched
        if (touched[field.name]) {
            const error = validateField(field, value);
            if (error) {
                errors[field.name] = error;
            } else {
                delete errors[field.name];
                errors = { ...errors };
            }
        }
    }

    // Handle field blur
    function handleBlur(field: FormField) {
        touched[field.name] = true;
        const error = validateField(field, formData[field.name]);
        if (error) {
            errors[field.name] = error;
        }
    }

    // Handle form submission
    async function handleSubmit(e: Event) {
        e.preventDefault();
        
        // Mark all fields as touched
        form.fields.forEach(field => {
            touched[field.name] = true;
        });

        if (!validateForm()) {
            return;
        }

        await onSubmit(formData);
    }

    // Get button styles
    const buttonStyle = $derived(() => {
        const styles: string[] = [];
        const styling = form.settings?.styling || form.styling;
        
        if (styling?.buttonColor) {
            styles.push(`background-color: ${styling.buttonColor}`);
        }
        if (styling?.buttonTextColor) {
            styles.push(`color: ${styling.buttonTextColor}`);
        }
        if (styling?.borderRadius) {
            styles.push(`border-radius: ${styling.borderRadius}`);
        }
        
        return styles.join('; ');
    });
</script>

<form class="form-renderer {getSpacingClass()}" onsubmit={handleSubmit}>
    <div class="form-renderer__fields">
        {#each form.fields as field (field.id)}
            <div class="form-renderer__field {getWidthClass(field.width)}">
                <label class="form-renderer__label" for={field.id}>
                    {field.label}
                    {#if field.required}
                        <span class="form-renderer__required">*</span>
                    {/if}
                </label>

                {#if field.type === 'textarea'}
                    <textarea
                        id={field.id}
                        name={field.name}
                        class="form-renderer__input form-renderer__textarea"
                        class:form-renderer__input--error={errors[field.name]}
                        placeholder={field.placeholder}
                        required={field.required}
                        value={formData[field.name] || ''}
                        oninput={(e) => handleChange(field, (e.target as HTMLTextAreaElement).value)}
                        onblur={() => handleBlur(field)}
                        disabled={isSubmitting}
                        rows="4"
                    ></textarea>
                {:else if field.type === 'select'}
                    <select
                        id={field.id}
                        name={field.name}
                        class="form-renderer__input form-renderer__select"
                        class:form-renderer__input--error={errors[field.name]}
                        required={field.required}
                        value={formData[field.name] || ''}
                        onchange={(e) => handleChange(field, (e.target as HTMLSelectElement).value)}
                        onblur={() => handleBlur(field)}
                        disabled={isSubmitting}
                    >
                        <option value="">{field.placeholder || 'Select an option'}</option>
                        {#each field.options || [] as option}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                {:else if field.type === 'checkbox'}
                    <label class="form-renderer__checkbox">
                        <input
                            type="checkbox"
                            id={field.id}
                            name={field.name}
                            checked={formData[field.name] || false}
                            onchange={(e) => handleChange(field, (e.target as HTMLInputElement).checked)}
                            disabled={isSubmitting}
                        />
                        <span>{field.placeholder || field.label}</span>
                    </label>
                {:else if field.type === 'radio' && field.options}
                    <div class="form-renderer__radio-group">
                        {#each field.options as option}
                            <label class="form-renderer__radio">
                                <input
                                    type="radio"
                                    name={field.name}
                                    value={option.value}
                                    checked={formData[field.name] === option.value}
                                    onchange={(e) => handleChange(field, (e.target as HTMLInputElement).value)}
                                    disabled={isSubmitting}
                                />
                                <span>{option.label}</span>
                            </label>
                        {/each}
                    </div>
                {:else}
                    <input
                        type={field.type}
                        id={field.id}
                        name={field.name}
                        class="form-renderer__input"
                        class:form-renderer__input--error={errors[field.name]}
                        placeholder={field.placeholder}
                        required={field.required}
                        value={formData[field.name] || ''}
                        oninput={(e) => handleChange(field, (e.target as HTMLInputElement).value)}
                        onblur={() => handleBlur(field)}
                        disabled={isSubmitting}
                    />
                {/if}

                {#if errors[field.name]}
                    <span class="form-renderer__error">{errors[field.name]}</span>
                {:else if field.helpText}
                    <span class="form-renderer__help">{field.helpText}</span>
                {/if}
            </div>
        {/each}
    </div>

    <button 
        type="submit" 
        class="form-renderer__submit"
        style={buttonStyle()}
        disabled={isSubmitting}
    >
        {#if isSubmitting}
            <Loader2 size={18} class="form-renderer__spinner" />
            Submitting...
        {:else}
            {form.settings?.submitButtonText || 'Submit'}
        {/if}
    </button>
</form>

<style>
    .form-renderer {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .form-renderer--compact {
        gap: 1rem;
    }

    .form-renderer--relaxed {
        gap: 2rem;
    }

    .form-renderer__fields {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .form-renderer--compact .form-renderer__fields {
        gap: 0.75rem;
    }

    .form-renderer--relaxed .form-renderer__fields {
        gap: 1.25rem;
    }

    .form-renderer__field {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .form-renderer__field--w25 {
        width: calc(25% - 0.75rem);
    }

    .form-renderer__field--w33 {
        width: calc(33.333% - 0.667rem);
    }

    .form-renderer__field--w50 {
        width: calc(50% - 0.5rem);
    }

    .form-renderer__field--w66 {
        width: calc(66.666% - 0.333rem);
    }

    .form-renderer__field--w75 {
        width: calc(75% - 0.25rem);
    }

    .form-renderer__field--w100 {
        width: 100%;
    }

    @media (max-width: 640px) {
        .form-renderer__field--w25,
        .form-renderer__field--w33,
        .form-renderer__field--w50,
        .form-renderer__field--w66,
        .form-renderer__field--w75 {
            width: 100%;
        }
    }

    .form-renderer__label {
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
    }

    .form-renderer__required {
        color: #dc2626;
        margin-left: 0.125rem;
    }

    .form-renderer__input {
        width: 100%;
        padding: 0.625rem 0.875rem;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 0.5rem;
        font-size: 0.9375rem;
        color: #0f172a;
        transition: all 0.15s ease;
    }

    .form-renderer__input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .form-renderer__input:disabled {
        background: #f3f4f6;
        cursor: not-allowed;
    }

    .form-renderer__input--error {
        border-color: #dc2626;
    }

    .form-renderer__input--error:focus {
        box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
    }

    .form-renderer__textarea {
        resize: vertical;
        min-height: 100px;
    }

    .form-renderer__select {
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.75rem center;
        padding-right: 2.5rem;
    }

    .form-renderer__checkbox,
    .form-renderer__radio {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        font-size: 0.9375rem;
        color: #374151;
    }

    .form-renderer__checkbox input,
    .form-renderer__radio input {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
    }

    .form-renderer__radio-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .form-renderer__error {
        font-size: 0.8125rem;
        color: #dc2626;
    }

    .form-renderer__help {
        font-size: 0.8125rem;
        color: #6b7280;
    }

    .form-renderer__submit {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        background: #0f172a;
        color: #ffffff;
        border: none;
        border-radius: 0.5rem;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .form-renderer__submit:hover:not(:disabled) {
        background: #1e293b;
    }

    .form-renderer__submit:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .form-renderer__submit :global(.form-renderer__spinner) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>
