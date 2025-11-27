<script lang="ts">
    import type { PluginContext } from '../context';
    import type { FormData } from '../../types';
    import { createDefaultFormData } from '../../types';
    import FormBuilder from '../FormBuilder.svelte';
    import { Plus } from '@lucide/svelte';

    let { ctx }: { ctx: PluginContext } = $props();

    // Plugin-owned state
    let formsData = $state<FormData[]>((ctx.siteMetadata.forms as FormData[]) ?? []);
    let selectedFormId = $state<string | null>(null);
    
    $effect(() => {
        if (!selectedFormId && formsData.length > 0) {
            selectedFormId = formsData[0].id;
        }
    });

    const randomId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2));

    const addNewForm = () => {
        const newForm = createDefaultFormData();
        newForm.id = randomId();
        newForm.settings.formName = `Form ${formsData.length + 1}`;
        formsData = [...formsData, newForm];
        selectedFormId = newForm.id;
        syncToMetadata();
    };

    const deleteForm = (formId: string) => {
        formsData = formsData.filter(f => f.id !== formId);
        if (selectedFormId === formId) {
            selectedFormId = formsData[0]?.id ?? null;
        }
        syncToMetadata();
    };

    const handleFormUpdate = (updatedForm: FormData) => {
        const index = formsData.findIndex(f => f.id === updatedForm.id);
        if (index !== -1) {
            formsData[index] = updatedForm;
            formsData = [...formsData];
            syncToMetadata();
        }
    };

    const syncToMetadata = () => {
        ctx.updateSiteMetadata({ forms: formsData });
    };
</script>

<div class="forms-plugin">
    <div class="forms-plugin__header">
        <h3>Your Forms</h3>
        <button class="forms-plugin__newButton" onclick={addNewForm}>
            <Plus />
            <span>New</span>
        </button>
    </div>

    {#if formsData.length === 0}
        <div class="forms-plugin__empty">
            <p>No forms yet</p>
            <button class="forms-plugin__createButton" onclick={addNewForm}>
                <Plus />
                Create First Form
            </button>
        </div>
    {:else}
        <div class="forms-plugin__formControls">
            <label class="forms-plugin__formLabel">
                <span>Select Form</span>
                <select class="forms-plugin__select" bind:value={selectedFormId}>
                    {#each formsData as form}
                        <option value={form.id}>{form.settings.formName}</option>
                    {/each}
                </select>
            </label>
        </div>

        {#if selectedFormId}
            {@const formIndex = formsData.findIndex(f => f.id === selectedFormId)}
            {#if formIndex !== -1}
                <div class="forms-plugin__formControls">
                    <button 
                        class="forms-plugin__dangerButton"
                        onclick={() => {
                            if (confirm(`Delete form "${formsData[formIndex].settings.formName}"?`)) {
                                deleteForm(formsData[formIndex].id);
                            }
                        }}
                    >
                        Delete Form
                    </button>
                </div>
                <FormBuilder 
                    bind:formData={formsData[formIndex]}
                    onUpdateForm={handleFormUpdate}
                />
            {/if}
        {/if}
    {/if}
</div>

<style>
    .forms-plugin {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
    }

    .forms-plugin__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 0.25rem;
    }

    .forms-plugin__header h3 {
        margin: 0;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .forms-plugin__newButton {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.375rem 0.625rem;
        border: none;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        background: transparent;
        color: var(--krt-editor-text-secondary, #64748b);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
    }

    .forms-plugin__newButton:hover {
        background: var(--krt-editor-surface-hover, #f1f5f9);
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .forms-plugin__newButton :global(svg) {
        width: 0.875rem;
        height: 0.875rem;
    }

    .forms-plugin__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 2rem 1rem;
        text-align: center;
    }

    .forms-plugin__empty p {
        margin: 0;
        font-size: 0.875rem;
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .forms-plugin__createButton {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.625rem 1rem;
        border: none;
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        background: var(--krt-editor-accent, #3b82f6);
        color: #ffffff;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: var(--krt-editor-shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05));
        font-family: inherit;
    }

    .forms-plugin__createButton:hover {
        background: var(--krt-editor-accent-hover, #2563eb);
        transform: translateY(-1px);
        box-shadow: var(--krt-editor-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1));
    }

    .forms-plugin__createButton:active {
        transform: translateY(0);
    }

    .forms-plugin__createButton :global(svg) {
        width: 1rem;
        height: 1rem;
    }

    .forms-plugin__formControls {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .forms-plugin__formLabel {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .forms-plugin__formLabel span {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--krt-editor-text-secondary, #64748b);
    }

    .forms-plugin__select {
        width: 100%;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        color: var(--krt-editor-text-primary, #0f172a);
        background: var(--krt-editor-bg, #ffffff);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
    }

    .forms-plugin__select:focus {
        outline: none;
        border-color: var(--krt-editor-accent, #3b82f6);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .forms-plugin__dangerButton {
        width: 100%;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #dc2626;
        background: transparent;
        border: 1px solid rgba(220, 38, 38, 0.3);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
    }

    .forms-plugin__dangerButton:hover {
        background: rgba(220, 38, 38, 0.1);
        border-color: #dc2626;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
    }

    .forms-plugin__dangerButton:active {
        transform: translateY(0);
    }
</style>
