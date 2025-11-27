<script lang="ts">
    import { goto } from '$app/navigation';
    import { Button, Loading, Card, Badge } from '@kuratchi/ui';
    import { getForm, updateForm, getFormSites } from '$lib/functions/forms.remote';
    import { ChevronLeft, Save, Plus, Trash2, GripVertical } from '@lucide/svelte';

    let { data } = $props();
    const { formId } = data;

    interface FormField {
        id: string;
        type: string;
        label: string;
        name: string;
        placeholder?: string;
        required: boolean;
        width?: string;
    }

    interface Form {
        id: string;
        name: string;
        description: string;
        fields: FormField[];
        settings: any;
        styling: any;
    }

    // State
    let form = $state<Form | null>(null);
    let loading = $state(true);
    let saving = $state(false);
    let error = $state<string | null>(null);
    let successMessage = $state<string | null>(null);
    let activeTab = $state<'fields' | 'settings' | 'styling'>('fields');
    let attachedSites = $state<any[]>([]);

    // Load form on mount
    $effect(() => {
        loadForm();
    });

    async function loadForm() {
        loading = true;
        error = null;
        try {
            const formData = await getForm();
            form = formData;
        } catch (err) {
            console.error('Failed to load form:', err);
            error = 'Failed to load form';
        } finally {
            loading = false;
        }
    }

    async function handleSave() {
        if (!form) return;

        saving = true;
        error = null;
        try {
            const result = await updateForm({
                id: form.id,
                name: form.name,
                description: form.description,
                fields: form.fields,
                settings: form.settings,
                styling: form.styling
            });

            if (result.success) {
                showSuccess('Form saved successfully');
            }
        } catch (err) {
            console.error('Failed to save form:', err);
            error = 'Failed to save form';
        } finally {
            saving = false;
        }
    }

    function addField() {
        if (!form) return;
        form.fields = [
            ...form.fields,
            {
                id: crypto.randomUUID(),
                type: 'text',
                label: 'New Field',
                name: `field_${form.fields.length + 1}`,
                placeholder: '',
                required: false,
                width: '100'
            }
        ];
    }

    function removeField(fieldId: string) {
        if (!form) return;
        form.fields = form.fields.filter(f => f.id !== fieldId);
    }

    function showSuccess(message: string) {
        successMessage = message;
        setTimeout(() => {
            successMessage = null;
        }, 3000);
    }
</script>

<svelte:head>
    <title>{form?.name || 'Form'} - Kuratchi Dashboard</title>
</svelte:head>

<div class="form-editor">
    <header class="form-editor__header">
        <Button variant="ghost" href="/forms">
            <ChevronLeft size={20} />
            Back to Forms
        </Button>
        <div class="form-editor__headerContent">
            {#if form}
                <input 
                    type="text" 
                    class="form-editor__title" 
                    bind:value={form.name}
                    placeholder="Form Name"
                />
            {:else}
                <h1>Loading...</h1>
            {/if}
            <Button onclick={handleSave} disabled={saving || !form}>
                <Save size={16} />
                {saving ? 'Saving...' : 'Save'}
            </Button>
        </div>
    </header>

    {#if error}
        <div class="form-editor__error">{error}</div>
    {/if}

    {#if successMessage}
        <div class="form-editor__success">{successMessage}</div>
    {/if}

    {#if loading}
        <div class="form-editor__loading">
            <Loading />
        </div>
    {:else if form}
        <div class="form-editor__tabs">
            <button 
                class="form-editor__tab" 
                class:active={activeTab === 'fields'}
                onclick={() => activeTab = 'fields'}
            >
                Fields ({form.fields.length})
            </button>
            <button 
                class="form-editor__tab"
                class:active={activeTab === 'settings'}
                onclick={() => activeTab = 'settings'}
            >
                Settings
            </button>
            <button 
                class="form-editor__tab"
                class:active={activeTab === 'styling'}
                onclick={() => activeTab = 'styling'}
            >
                Styling
            </button>
        </div>

        <div class="form-editor__content">
            {#if activeTab === 'fields'}
                <div class="fields-panel">
                    <div class="fields-panel__header">
                        <h2>Form Fields</h2>
                        <Button onclick={addField}>
                            <Plus size={16} />
                            Add Field
                        </Button>
                    </div>

                    {#if form.fields.length === 0}
                        <Card class="fields-panel__empty">
                            <p>No fields yet. Add your first field to get started.</p>
                            <Button onclick={addField}>
                                <Plus size={16} />
                                Add Field
                            </Button>
                        </Card>
                    {:else}
                        <div class="fields-panel__list">
                            {#each form.fields as field, index}
                                <div class="field-card">
                                    <div class="field-card__drag">
                                        <GripVertical size={16} />
                                    </div>
                                    <div class="field-card__content">
                                        <div class="field-card__row">
                                            <label class="field-card__field">
                                                <span>Label</span>
                                                <input type="text" bind:value={field.label} />
                                            </label>
                                            <label class="field-card__field">
                                                <span>Type</span>
                                                <select bind:value={field.type}>
                                                    <option value="text">Text</option>
                                                    <option value="email">Email</option>
                                                    <option value="tel">Phone</option>
                                                    <option value="number">Number</option>
                                                    <option value="textarea">Textarea</option>
                                                    <option value="select">Dropdown</option>
                                                    <option value="checkbox">Checkbox</option>
                                                    <option value="radio">Radio</option>
                                                    <option value="date">Date</option>
                                                </select>
                                            </label>
                                            <label class="field-card__field">
                                                <span>Name (ID)</span>
                                                <input type="text" bind:value={field.name} />
                                            </label>
                                        </div>
                                        <div class="field-card__row">
                                            <label class="field-card__field field-card__field--wide">
                                                <span>Placeholder</span>
                                                <input type="text" bind:value={field.placeholder} />
                                            </label>
                                            <label class="field-card__field">
                                                <span>Width</span>
                                                <select bind:value={field.width}>
                                                    <option value="25">25%</option>
                                                    <option value="33">33%</option>
                                                    <option value="50">50%</option>
                                                    <option value="66">66%</option>
                                                    <option value="75">75%</option>
                                                    <option value="100">100%</option>
                                                </select>
                                            </label>
                                            <label class="field-card__checkbox">
                                                <input type="checkbox" bind:checked={field.required} />
                                                <span>Required</span>
                                            </label>
                                        </div>
                                    </div>
                                    <button class="field-card__remove" onclick={() => removeField(field.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {:else if activeTab === 'settings'}
                <div class="settings-panel">
                    <Card>
                        <h2>Form Settings</h2>
                        <div class="settings-panel__grid">
                            <label class="settings-panel__field settings-panel__field--full">
                                <span>Description</span>
                                <textarea bind:value={form.description} rows="2" placeholder="Optional description"></textarea>
                            </label>
                            <label class="settings-panel__field">
                                <span>Submit Button Text</span>
                                <input type="text" bind:value={form.settings.submitButtonText} />
                            </label>
                            <label class="settings-panel__field">
                                <span>Redirect URL (optional)</span>
                                <input type="text" bind:value={form.settings.redirectUrl} placeholder="https://..." />
                            </label>
                            <label class="settings-panel__field settings-panel__field--full">
                                <span>Success Message</span>
                                <textarea bind:value={form.settings.successMessage} rows="2"></textarea>
                            </label>
                            <label class="settings-panel__field settings-panel__field--full">
                                <span>Error Message</span>
                                <textarea bind:value={form.settings.errorMessage} rows="2"></textarea>
                            </label>
                        </div>
                    </Card>

                    <Card>
                        <h2>Email Notifications</h2>
                        <div class="settings-panel__recipients">
                            <p class="settings-panel__hint">Add email addresses to receive form submissions.</p>
                            {#each form.settings.recipients || [] as recipient, index}
                                <div class="recipient-row">
                                    <input 
                                        type="email" 
                                        placeholder="email@example.com"
                                        bind:value={form.settings.recipients[index]}
                                    />
                                    <button 
                                        class="recipient-row__remove" 
                                        onclick={() => form.settings.recipients = form.settings.recipients.filter((_: any, i: number) => i !== index)}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            {/each}
                            <Button variant="outline" size="sm" onclick={() => form.settings.recipients = [...(form.settings.recipients || []), '']}>
                                <Plus size={14} />
                                Add Recipient
                            </Button>
                        </div>
                    </Card>
                </div>
            {:else if activeTab === 'styling'}
                <div class="styling-panel">
                    <Card>
                        <h2>Button Styling</h2>
                        <div class="styling-panel__grid">
                            <label class="styling-panel__field">
                                <span>Button Color</span>
                                <input type="color" bind:value={form.styling.buttonColor} />
                            </label>
                            <label class="styling-panel__field">
                                <span>Button Text Color</span>
                                <input type="color" bind:value={form.styling.buttonTextColor} />
                            </label>
                            <label class="styling-panel__field">
                                <span>Border Radius</span>
                                <input type="text" bind:value={form.styling.borderRadius} placeholder="0.375rem" />
                            </label>
                            <label class="styling-panel__field">
                                <span>Field Spacing</span>
                                <select bind:value={form.styling.spacing}>
                                    <option value="compact">Compact</option>
                                    <option value="normal">Normal</option>
                                    <option value="relaxed">Relaxed</option>
                                </select>
                            </label>
                        </div>
                    </Card>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .form-editor {
        padding: 2rem;
        max-width: 900px;
        margin: 0 auto;
    }

    .form-editor__header {
        margin-bottom: 1.5rem;
    }

    .form-editor__headerContent {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 0.5rem;
    }

    .form-editor__title {
        font-size: 1.5rem;
        font-weight: 600;
        border: none;
        background: none;
        padding: 0.25rem 0;
        width: 100%;
        max-width: 400px;
    }

    .form-editor__title:focus {
        outline: none;
        border-bottom: 2px solid var(--color-primary, #3b82f6);
    }

    .form-editor__error {
        padding: 1rem;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 0.5rem;
        color: #dc2626;
        margin-bottom: 1rem;
    }

    .form-editor__success {
        padding: 1rem;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 0.5rem;
        color: #16a34a;
        margin-bottom: 1rem;
    }

    .form-editor__loading {
        display: flex;
        justify-content: center;
        padding: 4rem;
    }

    .form-editor__tabs {
        display: flex;
        gap: 0.25rem;
        border-bottom: 1px solid var(--color-border, #e2e8f0);
        margin-bottom: 1.5rem;
    }

    .form-editor__tab {
        padding: 0.75rem 1.25rem;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-secondary, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .form-editor__tab:hover {
        color: var(--color-text-primary, #0f172a);
    }

    .form-editor__tab.active {
        color: var(--color-primary, #3b82f6);
        border-bottom-color: var(--color-primary, #3b82f6);
    }

    /* Fields Panel */
    .fields-panel__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .fields-panel__header h2 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
    }

    .fields-panel__empty {
        text-align: center;
        padding: 3rem;
        color: var(--color-text-secondary, #64748b);
    }

    .fields-panel__empty p {
        margin: 0 0 1rem;
    }

    .fields-panel__list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .field-card {
        display: flex;
        gap: 0.75rem;
        background: white;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.5rem;
        padding: 1rem;
    }

    .field-card__drag {
        display: flex;
        align-items: center;
        color: var(--color-text-muted, #94a3b8);
        cursor: grab;
    }

    .field-card__content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .field-card__row {
        display: flex;
        gap: 0.75rem;
        align-items: flex-end;
    }

    .field-card__field {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .field-card__field--wide {
        flex: 2;
    }

    .field-card__field span {
        font-size: 0.7rem;
        font-weight: 500;
        color: var(--color-text-secondary, #64748b);
    }

    .field-card__field input,
    .field-card__field select {
        padding: 0.375rem 0.5rem;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.25rem;
        font-size: 0.8125rem;
        font-family: inherit;
    }

    .field-card__checkbox {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8125rem;
        white-space: nowrap;
    }

    .field-card__remove {
        padding: 0.5rem;
        background: none;
        border: none;
        color: var(--color-text-muted, #94a3b8);
        cursor: pointer;
        border-radius: 0.25rem;
    }

    .field-card__remove:hover {
        background: #fef2f2;
        color: #dc2626;
    }

    /* Settings Panel */
    .settings-panel {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .settings-panel h2 {
        margin: 0 0 1rem;
        font-size: 1rem;
        font-weight: 600;
    }

    .settings-panel__grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
    }

    .settings-panel__field {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .settings-panel__field--full {
        grid-column: 1 / -1;
    }

    .settings-panel__field span {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-text-secondary, #64748b);
    }

    .settings-panel__field input,
    .settings-panel__field select,
    .settings-panel__field textarea {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-family: inherit;
    }

    .settings-panel__recipients {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .settings-panel__hint {
        margin: 0 0 0.5rem;
        font-size: 0.875rem;
        color: var(--color-text-muted, #94a3b8);
    }

    .recipient-row {
        display: flex;
        gap: 0.5rem;
    }

    .recipient-row input {
        flex: 1;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.375rem;
        font-size: 0.875rem;
    }

    .recipient-row__remove {
        padding: 0.5rem;
        background: none;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.375rem;
        color: var(--color-text-muted, #94a3b8);
        cursor: pointer;
    }

    .recipient-row__remove:hover {
        background: #fef2f2;
        color: #dc2626;
        border-color: #fecaca;
    }

    /* Styling Panel */
    .styling-panel h2 {
        margin: 0 0 1rem;
        font-size: 1rem;
        font-weight: 600;
    }

    .styling-panel__grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
    }

    .styling-panel__field {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .styling-panel__field span {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-text-secondary, #64748b);
    }

    .styling-panel__field input,
    .styling-panel__field select {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-family: inherit;
    }

    .styling-panel__field input[type="color"] {
        padding: 0.25rem;
        height: 2.5rem;
        cursor: pointer;
    }

    @media (max-width: 768px) {
        .form-editor {
            padding: 1rem;
        }

        .settings-panel__grid,
        .styling-panel__grid {
            grid-template-columns: 1fr;
        }

        .field-card__row {
            flex-wrap: wrap;
        }
    }
</style>
