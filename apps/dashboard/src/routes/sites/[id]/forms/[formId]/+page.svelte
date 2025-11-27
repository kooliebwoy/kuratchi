<script lang="ts">
    import { goto } from '$app/navigation';
    import { Button, Loading } from '@kuratchi/ui';
    import { getForm, getLeads, updateForm, exportLeads } from '$lib/functions/forms.remote';
    import { ChevronLeft, Download, Trash2, Plus, Save } from '@lucide/svelte';

    interface FormField {
        id: string;
        type: string;
        label: string;
        placeholder?: string;
        required: boolean;
        name: string;
        options?: { id: string; label: string; value: string }[];
        width?: string;
    }

    interface FormSettings {
        formName: string;
        submitButtonText: string;
        successMessage: string;
        errorMessage: string;
        recipients: string[];
        autoResponder: {
            enabled: boolean;
            subject: string;
            message: string;
        };
        styling: {
            buttonColor?: string;
            buttonTextColor?: string;
            borderRadius?: string;
            spacing?: string;
        };
    }

    interface FormData {
        id: string;
        fields: FormField[];
        settings: FormSettings;
    }

    interface Lead {
        id: string;
        formId: string;
        data: Record<string, any>;
        status: boolean;
        created_at: string;
    }

    let { data } = $props();
    const { siteId, formId } = data;

    // State
    let form = $state<FormData | null>(null);
    let leads = $state<Lead[]>([]);
    let loading = $state(true);
    let loadingLeads = $state(false);
    let saving = $state(false);
    let error = $state<string | null>(null);
    let successMessage = $state<string | null>(null);
    let activeTab = $state<'settings' | 'fields' | 'leads'>('settings');

    // Load form on mount
    $effect(() => {
        loadFormData();
    });

    async function loadFormData() {
        loading = true;
        error = null;
        try {
            const formQuery = getForm();
            form = await formQuery;
            await loadLeadsData();
        } catch (err) {
            console.error('Failed to load form:', err);
            error = 'Failed to load form';
        } finally {
            loading = false;
        }
    }

    async function loadLeadsData() {
        loadingLeads = true;
        try {
            const leadsQuery = getLeads();
            leads = await leadsQuery;
        } catch (err) {
            console.error('Failed to load leads:', err);
        } finally {
            loadingLeads = false;
        }
    }

    async function handleSave() {
        if (!form) return;

        saving = true;
        error = null;
        try {
            const result = await updateForm({
                id: form.id,
                siteId,
                fields: form.fields,
                settings: form.settings
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

    async function handleExport() {
        try {
            const result = await exportLeads();
            if (result.success && result.csv) {
                const blob = new Blob([result.csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.filename || 'leads.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Failed to export leads:', err);
            error = 'Failed to export leads';
        }
    }

    function showSuccess(message: string) {
        successMessage = message;
        setTimeout(() => {
            successMessage = null;
        }, 3000);
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

    function addRecipient() {
        if (!form) return;
        form.settings.recipients = [...form.settings.recipients, ''];
    }

    function removeRecipient(index: number) {
        if (!form) return;
        form.settings.recipients = form.settings.recipients.filter((_, i) => i !== index);
    }

    function goBack() {
        goto(`/sites/${siteId}/forms`);
    }
</script>

<div class="form-detail">
    <header class="form-detail__header">
        <button class="form-detail__backBtn" onclick={goBack}>
            <ChevronLeft size={20} />
            Back to Forms
        </button>
        <div class="form-detail__headerContent">
            <h1>{form?.settings.formName || 'Loading...'}</h1>
            <div class="form-detail__actions">
                {#if activeTab === 'leads'}
                    <Button variant="outline" onclick={handleExport}>
                        <Download size={16} />
                        Export CSV
                    </Button>
                {/if}
                <Button onclick={handleSave} disabled={saving}>
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save'}
                </Button>
            </div>
        </div>
    </header>

    {#if error}
        <div class="form-detail__error">{error}</div>
    {/if}

    {#if successMessage}
        <div class="form-detail__success">{successMessage}</div>
    {/if}

    {#if loading}
        <div class="form-detail__loading">
            <Loading />
        </div>
    {:else if form}
        <div class="form-detail__tabs">
            <button 
                class="form-detail__tab" 
                class:active={activeTab === 'settings'}
                onclick={() => activeTab = 'settings'}
            >
                Settings
            </button>
            <button 
                class="form-detail__tab"
                class:active={activeTab === 'fields'}
                onclick={() => activeTab = 'fields'}
            >
                Fields ({form.fields.length})
            </button>
            <button 
                class="form-detail__tab"
                class:active={activeTab === 'leads'}
                onclick={() => activeTab = 'leads'}
            >
                Leads ({leads.length})
            </button>
        </div>

        <div class="form-detail__content">
            {#if activeTab === 'settings'}
                <div class="settings-panel">
                    <section class="settings-panel__section">
                        <h2>General</h2>
                        <div class="settings-panel__grid">
                            <label class="settings-panel__field">
                                <span>Form Name</span>
                                <input type="text" bind:value={form.settings.formName} />
                            </label>
                            <label class="settings-panel__field">
                                <span>Submit Button Text</span>
                                <input type="text" bind:value={form.settings.submitButtonText} />
                            </label>
                        </div>
                    </section>

                    <section class="settings-panel__section">
                        <h2>Messages</h2>
                        <div class="settings-panel__grid">
                            <label class="settings-panel__field settings-panel__field--full">
                                <span>Success Message</span>
                                <textarea bind:value={form.settings.successMessage} rows="2"></textarea>
                            </label>
                            <label class="settings-panel__field settings-panel__field--full">
                                <span>Error Message</span>
                                <textarea bind:value={form.settings.errorMessage} rows="2"></textarea>
                            </label>
                        </div>
                    </section>

                    <section class="settings-panel__section">
                        <div class="settings-panel__sectionHeader">
                            <h2>Email Recipients</h2>
                            <Button size="sm" onclick={addRecipient}>
                                <Plus size={14} />
                                Add
                            </Button>
                        </div>
                        <div class="settings-panel__recipients">
                            {#each form.settings.recipients as recipient, index}
                                <div class="recipient-row">
                                    <input 
                                        type="email" 
                                        placeholder="email@example.com"
                                        bind:value={form.settings.recipients[index]}
                                    />
                                    <button class="recipient-row__remove" onclick={() => removeRecipient(index)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            {/each}
                            {#if form.settings.recipients.length === 0}
                                <p class="settings-panel__hint">Add email addresses to receive form submissions.</p>
                            {/if}
                        </div>
                    </section>

                    <section class="settings-panel__section">
                        <h2>Styling</h2>
                        <div class="settings-panel__grid settings-panel__grid--4">
                            <label class="settings-panel__field">
                                <span>Button Color</span>
                                <input type="color" bind:value={form.settings.styling.buttonColor} />
                            </label>
                            <label class="settings-panel__field">
                                <span>Button Text</span>
                                <input type="color" bind:value={form.settings.styling.buttonTextColor} />
                            </label>
                            <label class="settings-panel__field">
                                <span>Border Radius</span>
                                <input type="text" bind:value={form.settings.styling.borderRadius} />
                            </label>
                            <label class="settings-panel__field">
                                <span>Spacing</span>
                                <select bind:value={form.settings.styling.spacing}>
                                    <option value="compact">Compact</option>
                                    <option value="normal">Normal</option>
                                    <option value="relaxed">Relaxed</option>
                                </select>
                            </label>
                        </div>
                    </section>
                </div>
            {:else if activeTab === 'fields'}
                <div class="fields-panel">
                    <div class="fields-panel__header">
                        <Button onclick={addField}>
                            <Plus size={16} />
                            Add Field
                        </Button>
                    </div>
                    <div class="fields-panel__list">
                        {#each form.fields as field, index}
                            <div class="field-card">
                                <div class="field-card__header">
                                    <span class="field-card__number">{index + 1}</span>
                                    <button class="field-card__remove" onclick={() => removeField(field.id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div class="field-card__grid">
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
                                    <label class="field-card__field">
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
                        {/each}
                    </div>
                </div>
            {:else if activeTab === 'leads'}
                <div class="leads-panel">
                    {#if loadingLeads}
                        <Loading />
                    {:else if leads.length === 0}
                        <div class="leads-panel__empty">
                            <p>No submissions yet</p>
                        </div>
                    {:else}
                        <div class="leads-panel__table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        {#each form.fields as field}
                                            <th>{field.label}</th>
                                        {/each}
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each leads as lead}
                                        {@const leadData = typeof lead.data === 'string' ? JSON.parse(lead.data) : lead.data}
                                        <tr>
                                            <td>{new Date(lead.created_at).toLocaleString()}</td>
                                            {#each form.fields as field}
                                                <td>{leadData[field.name] || '-'}</td>
                                            {/each}
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .form-detail {
        padding: 2rem;
        max-width: 1000px;
        margin: 0 auto;
    }

    .form-detail__header {
        margin-bottom: 1.5rem;
    }

    .form-detail__backBtn {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.5rem 0;
        background: none;
        border: none;
        color: var(--color-text-secondary, #64748b);
        font-size: 0.875rem;
        cursor: pointer;
        margin-bottom: 0.5rem;
    }

    .form-detail__backBtn:hover {
        color: var(--color-text-primary, #0f172a);
    }

    .form-detail__headerContent {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .form-detail__headerContent h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
    }

    .form-detail__actions {
        display: flex;
        gap: 0.75rem;
    }

    .form-detail__error {
        padding: 1rem;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 0.5rem;
        color: #dc2626;
        margin-bottom: 1rem;
    }

    .form-detail__success {
        padding: 1rem;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 0.5rem;
        color: #16a34a;
        margin-bottom: 1rem;
    }

    .form-detail__loading {
        display: flex;
        justify-content: center;
        padding: 4rem;
    }

    .form-detail__tabs {
        display: flex;
        gap: 0.25rem;
        border-bottom: 1px solid var(--color-border, #e2e8f0);
        margin-bottom: 1.5rem;
    }

    .form-detail__tab {
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

    .form-detail__tab:hover {
        color: var(--color-text-primary, #0f172a);
    }

    .form-detail__tab.active {
        color: var(--color-primary, #3b82f6);
        border-bottom-color: var(--color-primary, #3b82f6);
    }

    /* Settings Panel */
    .settings-panel {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .settings-panel__section {
        background: white;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.75rem;
        padding: 1.25rem;
    }

    .settings-panel__section h2 {
        margin: 0 0 1rem;
        font-size: 0.875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-secondary, #64748b);
    }

    .settings-panel__sectionHeader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .settings-panel__sectionHeader h2 {
        margin: 0;
    }

    .settings-panel__grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
    }

    .settings-panel__grid--4 {
        grid-template-columns: repeat(4, 1fr);
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

    .settings-panel__field input[type="color"] {
        padding: 0.25rem;
        height: 2.25rem;
        cursor: pointer;
    }

    .settings-panel__recipients {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .settings-panel__hint {
        margin: 0;
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

    /* Fields Panel */
    .fields-panel__header {
        margin-bottom: 1rem;
    }

    .fields-panel__list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .field-card {
        background: white;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.5rem;
        padding: 1rem;
    }

    .field-card__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
    }

    .field-card__number {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-secondary, #64748b);
        background: var(--color-surface, #f1f5f9);
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
    }

    .field-card__remove {
        padding: 0.375rem;
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

    .field-card__grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
    }

    .field-card__field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
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
    }

    /* Leads Panel */
    .leads-panel__empty {
        text-align: center;
        padding: 3rem;
        background: var(--color-surface, #f8fafc);
        border-radius: 0.75rem;
        color: var(--color-text-secondary, #64748b);
    }

    .leads-panel__table {
        overflow-x: auto;
        background: white;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.75rem;
    }

    .leads-panel__table table {
        width: 100%;
        border-collapse: collapse;
    }

    .leads-panel__table th,
    .leads-panel__table td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid var(--color-border, #e2e8f0);
    }

    .leads-panel__table th {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-secondary, #64748b);
        background: var(--color-surface, #f8fafc);
    }

    .leads-panel__table td {
        font-size: 0.875rem;
    }

    .leads-panel__table tr:last-child td {
        border-bottom: none;
    }

    @media (max-width: 768px) {
        .form-detail {
            padding: 1rem;
        }

        .settings-panel__grid,
        .settings-panel__grid--4 {
            grid-template-columns: 1fr;
        }

        .field-card__grid {
            grid-template-columns: 1fr 1fr;
        }
    }
</style>
