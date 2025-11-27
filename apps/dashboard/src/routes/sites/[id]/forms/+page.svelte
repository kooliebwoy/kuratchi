<script lang="ts">
    import { page } from '$app/stores';
    import { Button, Loading } from '@kuratchi/ui';
    import { getForms, createForm, updateForm, deleteForm, getLeads, exportLeads } from '$lib/functions/forms.remote';
    import { Plus, Trash2, Edit, Users, Download, ChevronLeft, Eye, EyeOff } from '@lucide/svelte';

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
    const siteId = data.siteId;

    // State
    let forms = $state<FormData[]>([]);
    let selectedForm = $state<FormData | null>(null);
    let leads = $state<Lead[]>([]);
    let loading = $state(true);
    let loadingLeads = $state(false);
    let saving = $state(false);
    let error = $state<string | null>(null);
    let successMessage = $state<string | null>(null);
    let view = $state<'list' | 'edit' | 'leads'>('list');
    let showNewFormModal = $state(false);
    let newFormName = $state('');

    // Load forms on mount
    $effect(() => {
        loadForms();
    });

    async function loadForms() {
        loading = true;
        error = null;
        try {
            const formsQuery = getForms();
            forms = await formsQuery;
        } catch (err) {
            console.error('Failed to load forms:', err);
            error = 'Failed to load forms';
        } finally {
            loading = false;
        }
    }

    async function handleCreateForm() {
        if (!newFormName.trim()) return;
        
        saving = true;
        error = null;
        try {
            const result = await createForm({
                siteId,
                fields: [
                    {
                        id: crypto.randomUUID(),
                        type: 'text',
                        label: 'Full Name',
                        name: 'fullName',
                        placeholder: 'Enter your name',
                        required: true,
                        width: '100'
                    },
                    {
                        id: crypto.randomUUID(),
                        type: 'email',
                        label: 'Email',
                        name: 'email',
                        placeholder: 'your@email.com',
                        required: true,
                        width: '100'
                    }
                ],
                settings: {
                    formName: newFormName,
                    submitButtonText: 'Submit',
                    successMessage: 'Thank you for your submission!',
                    errorMessage: 'Something went wrong. Please try again.',
                    recipients: [],
                    autoResponder: {
                        enabled: false,
                        subject: 'Thank you for contacting us',
                        message: 'We received your message.'
                    },
                    styling: {
                        buttonColor: '#3b82f6',
                        buttonTextColor: '#ffffff',
                        borderRadius: '0.375rem',
                        spacing: 'normal'
                    }
                }
            });

            if (result.success) {
                showNewFormModal = false;
                newFormName = '';
                await loadForms();
                showSuccess('Form created successfully');
            }
        } catch (err) {
            console.error('Failed to create form:', err);
            error = 'Failed to create form';
        } finally {
            saving = false;
        }
    }

    async function handleDeleteForm(formId: string) {
        if (!confirm('Are you sure you want to delete this form? All leads will also be deleted.')) {
            return;
        }

        saving = true;
        error = null;
        try {
            const result = await deleteForm({ id: formId, siteId });
            if (result.success) {
                await loadForms();
                if (selectedForm?.id === formId) {
                    selectedForm = null;
                    view = 'list';
                }
                showSuccess('Form deleted successfully');
            }
        } catch (err) {
            console.error('Failed to delete form:', err);
            error = 'Failed to delete form';
        } finally {
            saving = false;
        }
    }

    async function handleUpdateForm() {
        if (!selectedForm) return;

        saving = true;
        error = null;
        try {
            const result = await updateForm({
                id: selectedForm.id,
                siteId,
                fields: selectedForm.fields,
                settings: selectedForm.settings
            });

            if (result.success) {
                await loadForms();
                showSuccess('Form updated successfully');
            }
        } catch (err) {
            console.error('Failed to update form:', err);
            error = 'Failed to update form';
        } finally {
            saving = false;
        }
    }

    async function loadLeads(formId: string) {
        loadingLeads = true;
        try {
            const leadsQuery = getLeads();
            leads = await leadsQuery;
        } catch (err) {
            console.error('Failed to load leads:', err);
            error = 'Failed to load leads';
        } finally {
            loadingLeads = false;
        }
    }

    async function handleExportLeads(formId: string) {
        try {
            const result = await exportLeads();
            if (result.success && result.csv) {
                // Download CSV
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

    function selectForm(form: FormData) {
        selectedForm = { ...form };
        view = 'edit';
    }

    function viewLeads(form: FormData) {
        selectedForm = form;
        view = 'leads';
        loadLeads(form.id);
    }

    function backToList() {
        view = 'list';
        selectedForm = null;
        leads = [];
    }

    function showSuccess(message: string) {
        successMessage = message;
        setTimeout(() => {
            successMessage = null;
        }, 3000);
    }

    function addField() {
        if (!selectedForm) return;
        selectedForm.fields = [
            ...selectedForm.fields,
            {
                id: crypto.randomUUID(),
                type: 'text',
                label: 'New Field',
                name: `field_${selectedForm.fields.length + 1}`,
                placeholder: '',
                required: false,
                width: '100'
            }
        ];
    }

    function removeField(fieldId: string) {
        if (!selectedForm) return;
        selectedForm.fields = selectedForm.fields.filter(f => f.id !== fieldId);
    }

    function addRecipient() {
        if (!selectedForm) return;
        selectedForm.settings.recipients = [...selectedForm.settings.recipients, ''];
    }

    function removeRecipient(index: number) {
        if (!selectedForm) return;
        selectedForm.settings.recipients = selectedForm.settings.recipients.filter((_, i) => i !== index);
    }
</script>

<div class="forms-page">
    <header class="forms-page__header">
        {#if view !== 'list'}
            <button class="forms-page__backBtn" onclick={backToList}>
                <ChevronLeft size={20} />
                Back to Forms
            </button>
        {/if}
        <div class="forms-page__headerContent">
            <h1>
                {#if view === 'list'}
                    Forms
                {:else if view === 'edit'}
                    Edit Form
                {:else}
                    Form Leads
                {/if}
            </h1>
            {#if view === 'list'}
                <Button onclick={() => showNewFormModal = true}>
                    <Plus size={16} />
                    New Form
                </Button>
            {:else if view === 'edit'}
                <Button onclick={handleUpdateForm} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                </Button>
            {:else if view === 'leads' && selectedForm}
                <Button onclick={() => handleExportLeads(selectedForm.id)}>
                    <Download size={16} />
                    Export CSV
                </Button>
            {/if}
        </div>
    </header>

    {#if error}
        <div class="forms-page__error">{error}</div>
    {/if}

    {#if successMessage}
        <div class="forms-page__success">{successMessage}</div>
    {/if}

    {#if loading}
        <div class="forms-page__loading">
            <Loading />
        </div>
    {:else if view === 'list'}
        <!-- Forms List -->
        {#if forms.length === 0}
            <div class="forms-page__empty">
                <p>No forms yet</p>
                <Button onclick={() => showNewFormModal = true}>
                    <Plus size={16} />
                    Create Your First Form
                </Button>
            </div>
        {:else}
            <div class="forms-page__grid">
                {#each forms as form}
                    <div class="form-card">
                        <div class="form-card__header">
                            <h3>{form.settings.formName}</h3>
                            <span class="form-card__fieldCount">{form.fields.length} fields</span>
                        </div>
                        <div class="form-card__preview">
                            {#each form.fields.slice(0, 3) as field}
                                <span class="form-card__field">{field.label}</span>
                            {/each}
                            {#if form.fields.length > 3}
                                <span class="form-card__more">+{form.fields.length - 3} more</span>
                            {/if}
                        </div>
                        <div class="form-card__actions">
                            <button class="form-card__btn" onclick={() => selectForm(form)} title="Edit">
                                <Edit size={16} />
                            </button>
                            <button class="form-card__btn" onclick={() => viewLeads(form)} title="View Leads">
                                <Users size={16} />
                            </button>
                            <button class="form-card__btn form-card__btn--danger" onclick={() => handleDeleteForm(form.id)} title="Delete">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    {:else if view === 'edit' && selectedForm}
        <!-- Form Editor -->
        <div class="form-editor">
            <section class="form-editor__section">
                <h2>Form Settings</h2>
                <div class="form-editor__grid">
                    <label class="form-editor__field">
                        <span>Form Name</span>
                        <input type="text" bind:value={selectedForm.settings.formName} />
                    </label>
                    <label class="form-editor__field">
                        <span>Submit Button Text</span>
                        <input type="text" bind:value={selectedForm.settings.submitButtonText} />
                    </label>
                    <label class="form-editor__field form-editor__field--full">
                        <span>Success Message</span>
                        <textarea bind:value={selectedForm.settings.successMessage} rows="2"></textarea>
                    </label>
                    <label class="form-editor__field form-editor__field--full">
                        <span>Error Message</span>
                        <textarea bind:value={selectedForm.settings.errorMessage} rows="2"></textarea>
                    </label>
                </div>
            </section>

            <section class="form-editor__section">
                <div class="form-editor__sectionHeader">
                    <h2>Form Fields</h2>
                    <Button onclick={addField}>
                        <Plus size={16} />
                        Add Field
                    </Button>
                </div>
                <div class="form-editor__fields">
                    {#each selectedForm.fields as field, index}
                        <div class="field-editor">
                            <div class="field-editor__header">
                                <span class="field-editor__number">{index + 1}</span>
                                <button class="field-editor__remove" onclick={() => removeField(field.id)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <div class="field-editor__grid">
                                <label class="field-editor__field">
                                    <span>Label</span>
                                    <input type="text" bind:value={field.label} />
                                </label>
                                <label class="field-editor__field">
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
                                <label class="field-editor__field">
                                    <span>Name (ID)</span>
                                    <input type="text" bind:value={field.name} />
                                </label>
                                <label class="field-editor__field">
                                    <span>Placeholder</span>
                                    <input type="text" bind:value={field.placeholder} />
                                </label>
                                <label class="field-editor__field">
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
                                <label class="field-editor__checkbox">
                                    <input type="checkbox" bind:checked={field.required} />
                                    <span>Required</span>
                                </label>
                            </div>
                        </div>
                    {/each}
                </div>
            </section>

            <section class="form-editor__section">
                <div class="form-editor__sectionHeader">
                    <h2>Email Recipients</h2>
                    <Button onclick={addRecipient}>
                        <Plus size={16} />
                        Add Recipient
                    </Button>
                </div>
                <div class="form-editor__recipients">
                    {#each selectedForm.settings.recipients as recipient, index}
                        <div class="recipient-row">
                            <input 
                                type="email" 
                                placeholder="email@example.com"
                                bind:value={selectedForm.settings.recipients[index]}
                            />
                            <button class="recipient-row__remove" onclick={() => removeRecipient(index)}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    {/each}
                    {#if selectedForm.settings.recipients.length === 0}
                        <p class="form-editor__hint">No recipients configured. Add email addresses to receive form submissions.</p>
                    {/if}
                </div>
            </section>

            <section class="form-editor__section">
                <h2>Styling</h2>
                <div class="form-editor__grid">
                    <label class="form-editor__field">
                        <span>Button Color</span>
                        <input type="color" bind:value={selectedForm.settings.styling.buttonColor} />
                    </label>
                    <label class="form-editor__field">
                        <span>Button Text Color</span>
                        <input type="color" bind:value={selectedForm.settings.styling.buttonTextColor} />
                    </label>
                    <label class="form-editor__field">
                        <span>Border Radius</span>
                        <input type="text" bind:value={selectedForm.settings.styling.borderRadius} placeholder="0.375rem" />
                    </label>
                    <label class="form-editor__field">
                        <span>Field Spacing</span>
                        <select bind:value={selectedForm.settings.styling.spacing}>
                            <option value="compact">Compact</option>
                            <option value="normal">Normal</option>
                            <option value="relaxed">Relaxed</option>
                        </select>
                    </label>
                </div>
            </section>
        </div>
    {:else if view === 'leads' && selectedForm}
        <!-- Leads View -->
        <div class="leads-view">
            <h2>{selectedForm.settings.formName} - Submissions</h2>
            {#if loadingLeads}
                <Loading />
            {:else if leads.length === 0}
                <div class="leads-view__empty">
                    <p>No submissions yet</p>
                </div>
            {:else}
                <div class="leads-view__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                {#each selectedForm.fields as field}
                                    <th>{field.label}</th>
                                {/each}
                            </tr>
                        </thead>
                        <tbody>
                            {#each leads as lead}
                                {@const leadData = typeof lead.data === 'string' ? JSON.parse(lead.data) : lead.data}
                                <tr>
                                    <td>{new Date(lead.created_at).toLocaleDateString()}</td>
                                    {#each selectedForm.fields as field}
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

<!-- New Form Modal -->
{#if showNewFormModal}
    <div class="modal-overlay" onclick={() => showNewFormModal = false}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            <h2>Create New Form</h2>
            <label class="modal__field">
                <span>Form Name</span>
                <input 
                    type="text" 
                    bind:value={newFormName} 
                    placeholder="Contact Form"
                    onkeydown={(e) => e.key === 'Enter' && handleCreateForm()}
                />
            </label>
            <div class="modal__actions">
                <Button variant="ghost" onclick={() => showNewFormModal = false}>Cancel</Button>
                <Button onclick={handleCreateForm} disabled={saving || !newFormName.trim()}>
                    {saving ? 'Creating...' : 'Create Form'}
                </Button>
            </div>
        </div>
    </div>
{/if}

<style>
    .forms-page {
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
    }

    .forms-page__header {
        margin-bottom: 2rem;
    }

    .forms-page__backBtn {
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

    .forms-page__backBtn:hover {
        color: var(--color-text-primary, #0f172a);
    }

    .forms-page__headerContent {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .forms-page__headerContent h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
    }

    .forms-page__error {
        padding: 1rem;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 0.5rem;
        color: #dc2626;
        margin-bottom: 1rem;
    }

    .forms-page__success {
        padding: 1rem;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 0.5rem;
        color: #16a34a;
        margin-bottom: 1rem;
    }

    .forms-page__loading {
        display: flex;
        justify-content: center;
        padding: 4rem;
    }

    .forms-page__empty {
        text-align: center;
        padding: 4rem 2rem;
        background: var(--color-surface, #f8fafc);
        border-radius: 0.75rem;
        border: 2px dashed var(--color-border, #e2e8f0);
    }

    .forms-page__empty p {
        margin: 0 0 1rem;
        color: var(--color-text-secondary, #64748b);
    }

    .forms-page__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.5rem;
    }

    /* Form Card */
    .form-card {
        background: white;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.75rem;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .form-card__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }

    .form-card__header h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
    }

    .form-card__fieldCount {
        font-size: 0.75rem;
        color: var(--color-text-secondary, #64748b);
        background: var(--color-surface, #f1f5f9);
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
    }

    .form-card__preview {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .form-card__field {
        font-size: 0.75rem;
        background: var(--color-surface, #f1f5f9);
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        color: var(--color-text-secondary, #64748b);
    }

    .form-card__more {
        font-size: 0.75rem;
        color: var(--color-text-muted, #94a3b8);
    }

    .form-card__actions {
        display: flex;
        gap: 0.5rem;
        margin-top: auto;
        padding-top: 0.5rem;
        border-top: 1px solid var(--color-border, #e2e8f0);
    }

    .form-card__btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        background: var(--color-surface, #f1f5f9);
        border: none;
        border-radius: 0.375rem;
        color: var(--color-text-secondary, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .form-card__btn:hover {
        background: var(--color-surface-hover, #e2e8f0);
        color: var(--color-text-primary, #0f172a);
    }

    .form-card__btn--danger:hover {
        background: #fef2f2;
        color: #dc2626;
    }

    /* Form Editor */
    .form-editor {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .form-editor__section {
        background: white;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.75rem;
        padding: 1.5rem;
    }

    .form-editor__section h2 {
        margin: 0 0 1rem;
        font-size: 1rem;
        font-weight: 600;
    }

    .form-editor__sectionHeader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .form-editor__sectionHeader h2 {
        margin: 0;
    }

    .form-editor__grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
    }

    .form-editor__field {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .form-editor__field--full {
        grid-column: 1 / -1;
    }

    .form-editor__field span {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-text-secondary, #64748b);
    }

    .form-editor__field input,
    .form-editor__field select,
    .form-editor__field textarea {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-family: inherit;
    }

    .form-editor__field input[type="color"] {
        padding: 0.25rem;
        height: 2.5rem;
        cursor: pointer;
    }

    .form-editor__fields {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .form-editor__recipients {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .form-editor__hint {
        margin: 0;
        font-size: 0.875rem;
        color: var(--color-text-muted, #94a3b8);
    }

    /* Field Editor */
    .field-editor {
        background: var(--color-surface, #f8fafc);
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.5rem;
        padding: 1rem;
    }

    .field-editor__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
    }

    .field-editor__number {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-secondary, #64748b);
        background: white;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
    }

    .field-editor__remove {
        padding: 0.375rem;
        background: none;
        border: none;
        color: var(--color-text-muted, #94a3b8);
        cursor: pointer;
        border-radius: 0.25rem;
    }

    .field-editor__remove:hover {
        background: #fef2f2;
        color: #dc2626;
    }

    .field-editor__grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
    }

    .field-editor__field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .field-editor__field span {
        font-size: 0.7rem;
        font-weight: 500;
        color: var(--color-text-secondary, #64748b);
    }

    .field-editor__field input,
    .field-editor__field select {
        padding: 0.375rem 0.5rem;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.25rem;
        font-size: 0.8125rem;
        font-family: inherit;
        background: white;
    }

    .field-editor__checkbox {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8125rem;
    }

    /* Recipient Row */
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

    /* Leads View */
    .leads-view h2 {
        margin: 0 0 1.5rem;
        font-size: 1.125rem;
    }

    .leads-view__empty {
        text-align: center;
        padding: 3rem;
        background: var(--color-surface, #f8fafc);
        border-radius: 0.75rem;
        color: var(--color-text-secondary, #64748b);
    }

    .leads-view__table {
        overflow-x: auto;
        background: white;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.75rem;
    }

    .leads-view__table table {
        width: 100%;
        border-collapse: collapse;
    }

    .leads-view__table th,
    .leads-view__table td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid var(--color-border, #e2e8f0);
    }

    .leads-view__table th {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-secondary, #64748b);
        background: var(--color-surface, #f8fafc);
    }

    .leads-view__table td {
        font-size: 0.875rem;
    }

    .leads-view__table tr:last-child td {
        border-bottom: none;
    }

    /* Modal */
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal {
        background: white;
        border-radius: 0.75rem;
        padding: 1.5rem;
        width: 100%;
        max-width: 400px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    }

    .modal h2 {
        margin: 0 0 1rem;
        font-size: 1.125rem;
    }

    .modal__field {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        margin-bottom: 1.5rem;
    }

    .modal__field span {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-text-secondary, #64748b);
    }

    .modal__field input {
        padding: 0.625rem 0.875rem;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-family: inherit;
    }

    .modal__actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
    }

    @media (max-width: 768px) {
        .forms-page {
            padding: 1rem;
        }

        .form-editor__grid {
            grid-template-columns: 1fr;
        }

        .field-editor__grid {
            grid-template-columns: 1fr 1fr;
        }
    }
</style>
