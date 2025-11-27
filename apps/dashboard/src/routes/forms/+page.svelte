<script lang="ts">
    import { Button, Loading, Card, Badge, Dialog, FormField } from '@kuratchi/ui';
    import { getForms, createForm, deleteForm, getFormSites, attachFormToSite, detachFormFromSite } from '$lib/functions/forms.remote';
    import { getSites } from '$lib/functions/sites.remote';
    import { Plus, Trash2, Edit, Link, Unlink, Users, FileText, X } from '@lucide/svelte';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    interface FormField {
        id: string;
        type: string;
        label: string;
        name: string;
        required: boolean;
    }

    interface FormSettings {
        formName: string;
        submitButtonText: string;
        successMessage: string;
        errorMessage: string;
        recipients: string[];
    }

    interface Form {
        id: string;
        name: string;
        description: string;
        fields: FormField[];
        settings: FormSettings;
        status: boolean;
        created_at: string;
    }

    interface Site {
        id: string;
        name: string;
        subdomain: string;
    }

    // State
    let forms = $state<Form[]>([]);
    let sites = $state<Site[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let successMessage = $state<string | null>(null);

    // Modals
    let createDialog: HTMLDialogElement;
    let attachDialog: HTMLDialogElement;
    let showCreateModal = $state(false);
    let showAttachModal = $state(false);
    let selectedFormForAttach = $state<Form | null>(null);
    let attachedSites = $state<Site[]>([]);
    let loadingAttachedSites = $state(false);

    // New form data
    let newFormName = $state('');
    let saving = $state(false);

    // Load data on mount
    onMount(() => {
        loadData();
    });

    async function loadData() {
        loading = true;
        error = null;
        try {
            // Load sites first (this should always work)
            const sitesQuery = getSites();
            const sitesResult = await sitesQuery;
            sites = sitesResult || [];
            
            // Try to load forms (may fail if table doesn't exist yet)
            try {
                const formsResult = await getForms();
                forms = formsResult || [];
            } catch (formsErr: any) {
                console.error('Failed to load forms:', formsErr);
                // If forms table doesn't exist, show empty state
                forms = [];
                if (formsErr?.message?.includes('no such table') || formsErr?.status === 500) {
                    console.log('Forms table may not exist yet - showing empty state');
                } else {
                    throw formsErr;
                }
            }
        } catch (err: any) {
            console.error('Failed to load data:', err);
            error = err?.body?.message || err?.message || 'Failed to load data';
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
                name: newFormName,
                description: '',
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
                    },
                    {
                        id: crypto.randomUUID(),
                        type: 'textarea',
                        label: 'Message',
                        name: 'message',
                        placeholder: 'Your message...',
                        required: false,
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
                        subject: 'Thank you',
                        message: 'We received your message.'
                    },
                    styling: {
                        buttonColor: '#3b82f6',
                        buttonTextColor: '#ffffff',
                        borderRadius: '0.375rem',
                        spacing: 'normal'
                    },
                    redirectUrl: '',
                    submitEndpoint: ''
                },
                styling: {
                    buttonColor: '#3b82f6',
                    buttonTextColor: '#ffffff',
                    borderRadius: '0.375rem',
                    spacing: 'normal'
                }
            });

            if (result.success) {
                showCreateModal = false;
                newFormName = '';
                await loadData();
                showSuccess('Form created successfully');
            }
        } catch (err: any) {
            console.error('Failed to create form:', err);
            error = err?.body?.message || err?.message || 'Failed to create form. The forms table may not exist yet - please ensure the database migration has run.';
        } finally {
            saving = false;
        }
    }

    async function handleDeleteForm(formId: string, formName: string) {
        if (!confirm(`Are you sure you want to delete "${formName}"? This will also remove all site attachments.`)) {
            return;
        }

        try {
            const result = await deleteForm({ id: formId });
            if (result.success) {
                await loadData();
                showSuccess('Form deleted successfully');
            }
        } catch (err) {
            console.error('Failed to delete form:', err);
            error = 'Failed to delete form';
        }
    }

    async function openAttachModal(form: Form) {
        selectedFormForAttach = form;
        showAttachModal = true;
        loadingAttachedSites = true;
        
        try {
            // This would need a route param, so we'll handle it differently
            // For now, we'll show all sites and let user attach/detach
            attachedSites = [];
        } catch (err) {
            console.error('Failed to load attached sites:', err);
        } finally {
            loadingAttachedSites = false;
        }
    }

    async function handleAttachToSite(siteId: string) {
        if (!selectedFormForAttach) return;

        try {
            const result = await attachFormToSite({
                formId: selectedFormForAttach.id,
                siteId
            });
            if (result.success) {
                showSuccess('Form attached to site');
                // Refresh attached sites
                attachedSites = [...attachedSites, sites.find(s => s.id === siteId)!];
            }
        } catch (err) {
            console.error('Failed to attach form:', err);
            error = 'Failed to attach form to site';
        }
    }

    async function handleDetachFromSite(siteId: string) {
        if (!selectedFormForAttach) return;

        try {
            const result = await detachFormFromSite({
                formId: selectedFormForAttach.id,
                siteId
            });
            if (result.success) {
                showSuccess('Form detached from site');
                attachedSites = attachedSites.filter(s => s.id !== siteId);
            }
        } catch (err) {
            console.error('Failed to detach form:', err);
            error = 'Failed to detach form from site';
        }
    }

    function showSuccess(message: string) {
        successMessage = message;
        setTimeout(() => {
            successMessage = null;
        }, 3000);
    }

    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
</script>

<svelte:head>
    <title>Forms - Kuratchi Dashboard</title>
</svelte:head>

<div class="forms-page">
    <header class="forms-page__header">
        <div>
            <p class="forms-page__eyebrow">Forms</p>
            <h1>Manage your forms</h1>
            <p class="forms-page__subtext">Create reusable forms and attach them to any of your sites.</p>
        </div>
        <Button onclick={() => showCreateModal = true}>
            <Plus size={16} />
            New Form
        </Button>
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
    {:else if forms.length === 0}
        <Card class="forms-page__empty">
            <FileText size={48} strokeWidth={1} />
            <p>No forms yet</p>
            <Button onclick={() => showCreateModal = true}>
                <Plus size={16} />
                Create Your First Form
            </Button>
        </Card>
    {:else}
        <div class="forms-page__grid">
            {#each forms as form}
                <Card class="form-card">
                    <div class="form-card__header">
                        <div class="form-card__title">
                            <FileText size={20} />
                            <h3>{form.name}</h3>
                        </div>
                        <Badge variant="ghost" size="xs">
                            {form.fields?.length || 0} fields
                        </Badge>
                    </div>

                    {#if form.description}
                        <p class="form-card__description">{form.description}</p>
                    {/if}

                    <div class="form-card__fields">
                        {#each (form.fields || []).slice(0, 3) as field}
                            <span class="form-card__field">{field.label}</span>
                        {/each}
                        {#if (form.fields?.length || 0) > 3}
                            <span class="form-card__more">+{form.fields.length - 3} more</span>
                        {/if}
                    </div>

                    <div class="form-card__meta">
                        <span>Created {formatDate(form.created_at)}</span>
                    </div>

                    <div class="form-card__actions">
                        <Button variant="ghost" size="sm" href={`/forms/${form.id}`}>
                            <Edit size={16} />
                            Edit
                        </Button>
                        <Button variant="ghost" size="sm" onclick={() => openAttachModal(form)}>
                            <Link size={16} />
                            Sites
                        </Button>
                        <Button variant="ghost" size="sm" href={`/forms/${form.id}/leads`}>
                            <Users size={16} />
                            Leads
                        </Button>
                        <Button variant="ghost" size="sm" onclick={() => handleDeleteForm(form.id, form.name)}>
                            <Trash2 size={16} />
                        </Button>
                    </div>
                </Card>
            {/each}
        </div>
    {/if}
</div>

<Dialog bind:open={showCreateModal} bind:this={createDialog} size="md">
    {#snippet header()}
        <div class="kui-modal-header">
            <h3>Create New Form</h3>
            <Button variant="ghost" size="xs" onclick={() => { showCreateModal = false; createDialog.close(); }}>
                <X size={16} />
            </Button>
        </div>
    {/snippet}
    {#snippet children()}
        <div class="kui-stack">
            <FormField label="Form Name">
                <input 
                    type="text" 
                    bind:value={newFormName} 
                    placeholder="Contact Form"
                    onkeydown={(e) => e.key === 'Enter' && handleCreateForm()}
                    class="kui-input"
                />
                <span class="kui-subtext">You can add fields and customize settings after creating the form.</span>
            </FormField>
            <div class="kui-modal-actions">
                <Button variant="ghost" onclick={() => { showCreateModal = false; createDialog.close(); }}>Cancel</Button>
                <Button onclick={handleCreateForm} disabled={saving || !newFormName.trim()}>
                    {saving ? 'Creating...' : 'Create Form'}
                </Button>
            </div>
        </div>
    {/snippet}
</Dialog>

<Dialog bind:open={showAttachModal} bind:this={attachDialog} size="md" onClose={() => { showAttachModal = false; selectedFormForAttach = null; }}>
    {#snippet header()}
        <div class="kui-modal-header">
            <h3>Attach "{selectedFormForAttach?.name}" to Sites</h3>
            <Button variant="ghost" size="xs" onclick={() => { showAttachModal = false; attachDialog.close(); selectedFormForAttach = null; }}>
                <X size={16} />
            </Button>
        </div>
    {/snippet}
    {#snippet children()}
        <div class="kui-stack">
            {#if sites.length === 0}
                <p class="kui-subtext">No sites available. Create a site first.</p>
            {:else}
                <div class="sites-list">
                    {#each sites as site}
                        {@const isAttached = attachedSites.some(s => s.id === site.id)}
                        <div class="site-row">
                            <div class="site-row__info">
                                <span class="site-row__name">{site.name}</span>
                                <span class="site-row__subdomain">{site.subdomain}.kuratchi.site</span>
                            </div>
                            {#if isAttached}
                                <Button variant="ghost" size="sm" onclick={() => handleDetachFromSite(site.id)}>
                                    <Unlink size={14} />
                                    Detach
                                </Button>
                            {:else}
                                <Button variant="outline" size="sm" onclick={() => handleAttachToSite(site.id)}>
                                    <Link size={14} />
                                    Attach
                                </Button>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
            <div class="kui-modal-actions">
                <Button onclick={() => { showAttachModal = false; attachDialog.close(); selectedFormForAttach = null; }}>Done</Button>
            </div>
        </div>
    {/snippet}
</Dialog>

<style>
    .forms-page {
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
    }

    .forms-page__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 2rem;
    }

    .forms-page__header h1 {
        margin: 0.25rem 0 0.5rem;
        font-size: 1.5rem;
        font-weight: 600;
    }

    .forms-page__eyebrow {
        margin: 0;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-primary, #3b82f6);
    }

    .forms-page__subtext {
        margin: 0;
        font-size: 0.875rem;
        color: var(--color-text-secondary, #64748b);
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
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 4rem 2rem;
        text-align: center;
        color: var(--color-text-secondary, #64748b);
    }

    .forms-page__empty p {
        margin: 0;
    }

    .forms-page__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 1.5rem;
    }

    /* Form Card */
    .form-card {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1.25rem;
    }

    .form-card__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }

    .form-card__title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--color-primary, #3b82f6);
    }

    .form-card__title h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text-primary, #0f172a);
    }

    .form-card__description {
        margin: 0;
        font-size: 0.875rem;
        color: var(--color-text-secondary, #64748b);
        line-height: 1.5;
    }

    .form-card__fields {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
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

    .form-card__meta {
        font-size: 0.75rem;
        color: var(--color-text-muted, #94a3b8);
    }

    .form-card__actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--color-border, #e2e8f0);
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
        width: 100%;
        max-width: 400px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    }

    .modal--wide {
        max-width: 500px;
    }

    .modal__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid var(--color-border, #e2e8f0);
    }

    .modal__header h2 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
    }

    .modal__close {
        padding: 0.25rem;
        background: none;
        border: none;
        color: var(--color-text-secondary, #64748b);
        cursor: pointer;
        border-radius: 0.25rem;
    }

    .modal__close:hover {
        background: var(--color-surface, #f1f5f9);
    }

    .modal__body {
        padding: 1.5rem;
    }

    .modal__field {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
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

    .modal__field input:focus {
        outline: none;
        border-color: var(--color-primary, #3b82f6);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .modal__hint {
        margin: 0.75rem 0 0;
        font-size: 0.8125rem;
        color: var(--color-text-muted, #94a3b8);
    }

    .modal__empty {
        text-align: center;
        color: var(--color-text-secondary, #64748b);
        padding: 1rem 0;
    }

    .modal__actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--color-border, #e2e8f0);
    }

    /* Sites List */
    .sites-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .site-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        background: var(--color-surface, #f8fafc);
        border-radius: 0.5rem;
    }

    .site-row__info {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }

    .site-row__name {
        font-size: 0.875rem;
        font-weight: 500;
    }

    .site-row__subdomain {
        font-size: 0.75rem;
        color: var(--color-text-muted, #94a3b8);
    }

    @media (max-width: 768px) {
        .forms-page {
            padding: 1rem;
        }

        .forms-page__header {
            flex-direction: column;
            gap: 1rem;
        }

        .forms-page__grid {
            grid-template-columns: 1fr;
        }
    }
</style>
