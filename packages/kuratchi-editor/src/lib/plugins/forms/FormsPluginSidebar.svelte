<script lang="ts">
    import type { PluginContext } from '../types';
    import type { FormData } from '../../types';
    import { createDefaultFormData } from '../../types';
    import FormBuilder from '../FormBuilder.svelte';
    import { Plus } from '@lucide/svelte';

    interface Props {
        context: PluginContext;
    }

    let { context }: Props = $props();

    // Plugin-owned state
    let formsData = $state<FormData[]>((context.siteMetadata.forms as FormData[]) ?? []);
    let selectedFormId = $state<string | null>(null);
    
    // Initialize selectedFormId reactively
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
        context.updateSiteMetadata({ forms: formsData });
    };
</script>

<div class="krt-editor__sidebarSection">
    <div class="krt-editor__sidebarSectionHeader">
        <h3>Your Forms</h3>
        <button 
            class="krt-editor__ghostButton"
            onclick={addNewForm}
        >
            <Plus />
            <span>New</span>
        </button>
    </div>

    {#if formsData.length === 0}
        <div class="krt-editor__emptyState">
            <p>No forms yet</p>
            <button 
                class="krt-editor__primaryButton"
                onclick={addNewForm}
            >
                <Plus />
                Create First Form
            </button>
        </div>
    {:else}
        <div class="krt-editor__formControls">
            <label class="krt-editor__formLabel">
                <span>Select Form</span>
                <select 
                    class="krt-editor__select"
                    bind:value={selectedFormId}
                >
                    {#each formsData as form}
                        <option value={form.id}>{form.settings.formName}</option>
                    {/each}
                </select>
            </label>
        </div>

        {#if selectedFormId}
            {@const formIndex = formsData.findIndex(f => f.id === selectedFormId)}
            {#if formIndex !== -1}
                <div class="krt-editor__formControls">
                    <button 
                        class="krt-editor__dangerButton"
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
