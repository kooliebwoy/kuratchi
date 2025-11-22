<script lang="ts">
    import { Pencil, X } from '@lucide/svelte';
    import { getContext } from 'svelte';
    import { onMount } from 'svelte';
    import { BlockActions, SideActions } from '../utils/index.js';

    interface Props {
        id?: string;
        type?: string;
        triggerText?: string;
        triggerStyle?: 'button' | 'link' | 'image';
        triggerButtonColor?: string;
        triggerButtonTextColor?: string;
        triggerImage?: string;
        contentType?: 'form' | 'image' | 'custom';
        formId?: string;
        imageUrl?: string;
        imageAlt?: string;
        customContent?: string;
        modalWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
        backgroundColor?: string;
        borderRadius?: string;
        showCloseButton?: boolean;
        closeOnBackdrop?: boolean;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'modal',
        triggerText = 'Open Modal',
        triggerStyle = 'button',
        triggerButtonColor = '#3b82f6',
        triggerButtonTextColor = '#ffffff', 
        triggerImage = '',
        contentType = 'custom',
        formId = '',
        imageUrl = '',
        imageAlt = 'Modal Image',
        customContent = '<p>Add your custom content here...</p>',
        modalWidth = 'md',
        backgroundColor = '#ffffff',
        borderRadius = '0.75rem',
        showCloseButton = true,
        closeOnBackdrop = true,
        editable = true
    }: Props = $props();

    let isOpen = $state(false);
    let siteMetadata = getContext<any>('siteMetadata');

    let content = $derived({
        id,
        type,
        triggerText,
        triggerStyle,
        triggerButtonColor,
        triggerButtonTextColor,
        triggerImage,
        contentType,
        formId,
        imageUrl,
        imageAlt,
        customContent,
        modalWidth,
        backgroundColor,
        borderRadius,
        showCloseButton,
        closeOnBackdrop
    });

    const openModal = () => {
        isOpen = true;
        if (typeof document !== 'undefined') {
            document.body.style.overflow = 'hidden';
        }
    };

    const closeModal = () => {
        isOpen = false;
        if (typeof document !== 'undefined') {
            document.body.style.overflow = '';
        }
    };

    const handleBackdropClick = (e: MouseEvent) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
            closeModal();
        }
    };

    const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isOpen) {
            closeModal();
        }
    };

    const getModalWidthClass = () => {
        const widths = {
            sm: '400px',
            md: '600px',
            lg: '800px',
            xl: '1000px',
            full: '95vw'
        };
        return widths[modalWidth];
    };

    const getFormData = () => {
        if (!formId || !siteMetadata?.forms) return null;
        return siteMetadata.forms.find((f: any) => f.id === formId);
    };

    let component: HTMLElement;
    let mounted = $state(false);
    const sideActionsId = `side-actions-${id}`;

    $effect(() => {
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', handleKeydown);
            return () => {
                window.removeEventListener('keydown', handleKeydown);
                document.body.style.overflow = '';
            };
        }
    });

    const availableForms = $derived(siteMetadata?.forms || []);

    onMount(() => {
        mounted = true;
    });
</script>

{#if editable}
    <div class="editor-item group relative" bind:this={component}>
        {#if mounted}
            <BlockActions {id} {type} element={component} />
        {/if}
        <div class="modal-trigger-wrapper" {id} data-type={type}>
            <script type="application/json" id="metadata-{id}">{JSON.stringify(content)}</script>
            {#if triggerStyle === 'button'}
                <button
                    class="modal-trigger-button"
                    style="background-color: {triggerButtonColor}; color: {triggerButtonTextColor};"
                >
                    {triggerText}
                </button>
            {:else if triggerStyle === 'link'}
                <button class="modal-trigger-link">
                    {triggerText}
                </button>
            {:else if triggerStyle === 'image' && triggerImage}
                <button class="modal-trigger-image">
                    <img src={triggerImage} alt="Open modal" />
                </button>
            {:else}
                <div class="editor-placeholder">
                    <p>Click to configure modal trigger</p>
                </div>
            {/if}
        </div>
    </div>

    <SideActions triggerId={sideActionsId}>
        {#snippet label()}
            <button id={sideActionsId} class="krt-editButton" aria-label="Edit modal settings" type="button">
                <Pencil size={16} />
                <span>Edit Settings</span>
            </button>
        {/snippet}
        {#snippet content()}
            <div class="space-y-4">
                <label class="form-control">
                    <span class="label-text text-xs">Content Type</span>
                    <select class="select select-sm select-bordered" bind:value={contentType}>
                        <option value="form">Form</option>
                        <option value="image">Image</option>
                        <option value="custom">Custom HTML</option>
                    </select>
                </label>

                {#if contentType === 'form'}
                    {#if availableForms.length > 0}
                        <label class="form-control">
                            <span class="label-text text-xs">Select Form</span>
                            <select class="select select-sm select-bordered" bind:value={formId}>
                                <option value="">Choose a form...</option>
                                {#each availableForms as form}
                                    <option value={form.id}>{form.settings.formName}</option>
                                {/each}
                            </select>
                        </label>
                    {:else}
                        <div class="text-xs text-gray-500 p-2">No forms created yet. Create one in the Forms tab.</div>
                    {/if}
                {:else if contentType === 'image'}
                    <label class="form-control">
                        <span class="label-text text-xs">Image URL</span>
                        <input type="text" class="input input-sm input-bordered" placeholder="https://..." bind:value={imageUrl} />
                    </label>
                    <label class="form-control">
                        <span class="label-text text-xs">Alt Text</span>
                        <input type="text" class="input input-sm input-bordered" placeholder="Alt text" bind:value={imageAlt} />
                    </label>
                {:else if contentType === 'custom'}
                    <label class="form-control">
                        <span class="label-text text-xs">Custom HTML</span>
                        <textarea class="textarea textarea-sm textarea-bordered" rows="4" placeholder="<p>Your HTML here...</p>" bind:value={customContent}></textarea>
                    </label>
                {/if}

                <div class="divider my-1"></div>

                <label class="form-control">
                    <span class="label-text text-xs">Trigger Style</span>
                    <select class="select select-sm select-bordered" bind:value={triggerStyle}>
                        <option value="button">Button</option>
                        <option value="link">Link</option>
                        <option value="image">Image</option>
                    </select>
                </label>

                <label class="form-control">
                    <span class="label-text text-xs">Trigger Text</span>
                    <input type="text" class="input input-sm input-bordered" bind:value={triggerText} />
                </label>

                {#if triggerStyle === 'button'}
                    <div class="grid grid-cols-2 gap-2">
                        <label class="form-control">
                            <span class="label-text text-xs">Button Color</span>
                            <input type="color" class="input input-sm w-full" bind:value={triggerButtonColor} />
                        </label>
                        <label class="form-control">
                            <span class="label-text text-xs">Text Color</span>
                            <input type="color" class="input input-sm w-full" bind:value={triggerButtonTextColor} />
                        </label>
                    </div>
                {:else if triggerStyle === 'image'}
                    <label class="form-control">
                        <span class="label-text text-xs">Trigger Image URL</span>
                        <input type="text" class="input input-sm input-bordered" placeholder="https://..." bind:value={triggerImage} />
                    </label>
                {/if}

                <div class="divider my-1"></div>

                <label class="form-control">
                    <span class="label-text text-xs">Modal Width</span>
                    <select class="select select-sm select-bordered" bind:value={modalWidth}>
                        <option value="sm">Small</option>
                        <option value="md">Medium</option>
                        <option value="lg">Large</option>
                        <option value="xl">Extra Large</option>
                        <option value="full">Full Width</option>
                    </select>
                </label>

                <div class="form-control">
                    <label class="label cursor-pointer justify-start gap-2">
                        <input type="checkbox" class="checkbox checkbox-sm" bind:checked={showCloseButton} />
                        <span class="label-text text-xs">Show close button</span>
                    </label>
                </div>

                <div class="form-control">
                    <label class="label cursor-pointer justify-start gap-2">
                        <input type="checkbox" class="checkbox checkbox-sm" bind:checked={closeOnBackdrop} />
                        <span class="label-text text-xs">Close on backdrop click</span>
                    </label>
                </div>
            </div>
        {/snippet}
    </SideActions>
{:else}
    <!-- Non-editable mode (actual website) -->
    <section id={id} data-type={type}>
        <script type="application/json" id="metadata-{id}">{JSON.stringify(content)}</script>
        <div class="modal-trigger-wrapper">
        {#if triggerStyle === 'button'}
            <button
                class="modal-trigger-button"
                onclick={openModal}
                style="background-color: {triggerButtonColor}; color: {triggerButtonTextColor};"
            >
                {triggerText}
            </button>
        {:else if triggerStyle === 'link'}
            <button class="modal-trigger-link" onclick={openModal}>
                {triggerText}
            </button>
        {:else if triggerStyle === 'image' && triggerImage}
            <button class="modal-trigger-image" onclick={openModal}>
                <img src={triggerImage} alt="Open modal" />
            </button>
        {/if}
    </div>

    <!-- Modal Overlay & Content -->
    {#if isOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="modal-overlay" onclick={handleBackdropClick}>
            <div
                class="modal-content"
                style="max-width: {getModalWidthClass()}; background-color: {backgroundColor}; border-radius: {borderRadius};"
            >
                {#if showCloseButton}
                    <button class="modal-close" onclick={closeModal} aria-label="Close modal">
                        <X size={24} />
                    </button>
                {/if}

                <div class="modal-body">
                    {#if contentType === 'image' && imageUrl}
                        <img src={imageUrl} alt={imageAlt} class="modal-image" />
                    {:else if contentType === 'form' && formId}
                        {@const formData = getFormData()}
                        {#if formData}
                            <div class="modal-form">
                                <h2>{formData.settings.formName}</h2>
                                <form class="form-preview" style="--field-spacing: {formData.settings.styling.spacing === 'compact' ? '0.75rem' : formData.settings.styling.spacing === 'relaxed' ? '1.5rem' : '1rem'}">
                                    <div class="form-fields">
                                        {#each formData.fields as field}
                                            <div class="form-field" style="width: {field.width}%">
                                                <!-- svelte-ignore a11y_label_has_associated_control -->
                                                <label class="form-label">
                                                    {field.label}
                                                    {#if field.required}
                                                        <span class="required-mark">*</span>
                                                    {/if}
                                                </label>
                                                
                                                {#if field.type === 'textarea'}
                                                    <textarea
                                                        class="form-input form-textarea"
                                                        placeholder={field.placeholder}
                                                        required={field.required}
                                                        rows="4"
                                                        style="border-radius: {formData.settings.styling.borderRadius}"
                                                    ></textarea>
                                                {:else if field.type === 'select'}
                                                    <select
                                                        class="form-input form-select"
                                                        required={field.required}
                                                        style="border-radius: {formData.settings.styling.borderRadius}"
                                                    >
                                                        <option value="">{field.placeholder || 'Choose...'}</option>
                                                        {#each field.options || [] as option}
                                                            <option value={option.value}>{option.label}</option>
                                                        {/each}
                                                    </select>
                                                {:else if field.type === 'checkbox'}
                                                    <div class="form-options">
                                                        {#each field.options || [] as option}
                                                            <label class="form-option-label">
                                                                <input type="checkbox" class="form-checkbox" value={option.value} />
                                                                <span>{option.label}</span>
                                                            </label>
                                                        {/each}
                                                    </div>
                                                {:else if field.type === 'radio'}
                                                    <div class="form-options">
                                                        {#each field.options || [] as option}
                                                            <label class="form-option-label">
                                                                <input type="radio" class="form-radio" name={field.name} value={option.value} />
                                                                <span>{option.label}</span>
                                                            </label>
                                                        {/each}
                                                    </div>
                                                {:else}
                                                    <input
                                                        type={field.type}
                                                        class="form-input"
                                                        placeholder={field.placeholder}
                                                        required={field.required}
                                                        style="border-radius: {formData.settings.styling.borderRadius}"
                                                    />
                                                {/if}
                                                
                                                {#if field.helpText}
                                                    <p class="form-help">{field.helpText}</p>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>

                                    <button
                                        type="submit"
                                        class="form-submit"
                                        style="background-color: {formData.settings.styling.buttonColor}; color: {formData.settings.styling.buttonTextColor}; border-radius: {formData.settings.styling.borderRadius}"
                                    >
                                        {formData.settings.submitButtonText}
                                    </button>
                                </form>
                            </div>
                        {:else}
                            <p class="error-message">Form not found. Please select a valid form.</p>
                        {/if}
                    {:else if contentType === 'custom'}
                        <div class="modal-custom-content">
                            {@html customContent}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
    </section>
{/if}

<style>
    .editor-placeholder {
        padding: 2rem;
        text-align: center;
        background: #f3f4f6;
        border: 2px dashed #d1d5db;
        border-radius: 0.5rem;
        color: #6b7280;
    }

    /* ===== TRIGGER STYLES ===== */
    .modal-trigger-wrapper {
        display: inline-block;
    }

    .modal-trigger-button {
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        font-weight: 500;
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
    }

    .modal-trigger-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .modal-trigger-button:active {
        transform: translateY(0);
    }

    .modal-trigger-link {
        background: transparent;
        border: none;
        color: #3b82f6;
        text-decoration: underline;
        cursor: pointer;
        font-size: 1rem;
        font-family: inherit;
        padding: 0;
    }

    .modal-trigger-link:hover {
        color: #2563eb;
    }

    .modal-trigger-image {
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        transition: transform 0.2s ease;
    }

    .modal-trigger-image:hover {
        transform: scale(1.05);
    }

    .modal-trigger-image img {
        display: block;
        max-width: 100%;
        height: auto;
    }

    /* ===== MODAL OVERLAY ===== */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 1rem;
        animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    /* ===== MODAL CONTENT ===== */
    .modal-content {
        position: relative;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .modal-close {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: rgba(0, 0, 0, 0.1);
        border: none;
        border-radius: 50%;
        width: 2.5rem;
        height: 2.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        z-index: 10;
        color: #1f2937;
    }

    .modal-close:hover {
        background: rgba(0, 0, 0, 0.2);
        transform: rotate(90deg);
    }

    .modal-body {
        padding: 2rem;
    }

    /* ===== CONTENT TYPES ===== */
    .modal-image {
        width: 100%;
        height: auto;
        display: block;
        border-radius: 0.5rem;
    }

    .modal-custom-content {
        font-size: 1rem;
        line-height: 1.6;
        color: #1f2937;
    }

    .error-message {
        color: #dc2626;
        text-align: center;
        padding: 2rem;
        font-size: 1rem;
    }

    /* ===== FORM STYLES ===== */
    .modal-form h2 {
        margin: 0 0 1.5rem 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: #1f2937;
    }

    .form-preview {
        display: flex;
        flex-direction: column;
        gap: var(--field-spacing, 1rem);
    }

    .form-fields {
        display: flex;
        flex-wrap: wrap;
        margin: 0 -0.5rem;
    }

    .form-field {
        padding: 0 0.5rem var(--field-spacing, 1rem) 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .form-label {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
    }

    .required-mark {
        color: #dc2626;
        margin-left: 0.25rem;
    }

    .form-input,
    .form-textarea,
    .form-select {
        width: 100%;
        padding: 0.625rem 0.875rem;
        font-size: 0.9375rem;
        color: #1f2937;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-family: inherit;
        transition: border-color 0.2s ease;
    }

    .form-input:focus,
    .form-textarea:focus,
    .form-select:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .form-textarea {
        resize: vertical;
        min-height: 100px;
    }

    .form-select {
        cursor: pointer;
    }

    .form-options {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .form-option-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #1f2937;
        cursor: pointer;
    }

    .form-checkbox,
    .form-radio {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
        accent-color: #3b82f6;
    }

    .form-help {
        font-size: 0.75rem;
        color: #6b7280;
        margin: 0.25rem 0 0 0;
    }

    .form-submit {
        width: 100%;
        padding: 0.875rem 1.5rem;
        font-size: 1rem;
        font-weight: 500;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
    }

    .form-submit:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .form-submit:active {
        transform: translateY(0);
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 640px) {
        .modal-body {
            padding: 1.5rem;
        }

        .modal-close {
            top: 0.5rem;
            right: 0.5rem;
            width: 2rem;
            height: 2rem;
        }

        .form-field {
            width: 100% !important;
        }
    }
</style>
