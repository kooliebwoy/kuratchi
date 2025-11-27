<script lang="ts">
    import type { PluginContext } from '../context';
    import { FileText, ExternalLink, Copy, Check } from '@lucide/svelte';

    let { ctx }: { ctx: PluginContext } = $props();

    interface AttachedForm {
        id: string;
        name: string;
        description: string;
        fields: any[];
        settings: any;
        styling: any;
    }

    // Get forms from site metadata (loaded from org database)
    const forms = $derived<AttachedForm[]>((ctx.siteMetadata.forms as AttachedForm[]) ?? []);
    
    let copiedFormId = $state<string | null>(null);

    const copyFormEmbed = (form: AttachedForm) => {
        // Copy a simple embed code or form ID that can be used in sections
        const embedCode = `{{form:${form.id}}}`;
        navigator.clipboard.writeText(embedCode);
        copiedFormId = form.id;
        setTimeout(() => {
            copiedFormId = null;
        }, 2000);
    };

    const insertFormSection = (form: AttachedForm) => {
        // Add a form section to the page
        ctx.addBlock('FormSection', {
            formId: form.id,
            formName: form.name,
            fields: form.fields,
            settings: form.settings,
            styling: form.styling
        });
    };
</script>

<div class="forms-plugin">
    <div class="forms-plugin__header">
        <h3>Site Forms</h3>
    </div>

    {#if forms.length === 0}
        <div class="forms-plugin__empty">
            <FileText size={32} strokeWidth={1.5} />
            <p>No forms attached</p>
            <p class="forms-plugin__hint">
                Create and attach forms to this site from the 
                <a href="/forms" target="_blank" rel="noopener">Forms Dashboard</a>
            </p>
        </div>
    {:else}
        <div class="forms-plugin__list">
            {#each forms as form}
                <div class="forms-plugin__card">
                    <div class="forms-plugin__cardHeader">
                        <FileText size={16} />
                        <span class="forms-plugin__cardTitle">{form.name}</span>
                    </div>
                    
                    {#if form.description}
                        <p class="forms-plugin__cardDesc">{form.description}</p>
                    {/if}
                    
                    <div class="forms-plugin__cardMeta">
                        {form.fields?.length || 0} fields
                    </div>
                    
                    <div class="forms-plugin__cardActions">
                        <button 
                            class="forms-plugin__actionButton forms-plugin__actionButton--primary"
                            onclick={() => insertFormSection(form)}
                        >
                            Add to Page
                        </button>
                        <button 
                            class="forms-plugin__actionButton"
                            onclick={() => copyFormEmbed(form)}
                            title="Copy form ID"
                        >
                            {#if copiedFormId === form.id}
                                <Check size={14} />
                            {:else}
                                <Copy size={14} />
                            {/if}
                        </button>
                    </div>
                </div>
            {/each}
        </div>
        
        <div class="forms-plugin__footer">
            <a href="/forms" target="_blank" rel="noopener" class="forms-plugin__link">
                <ExternalLink size={14} />
                Manage Forms
            </a>
        </div>
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

    .forms-plugin__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 2rem 1rem;
        text-align: center;
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .forms-plugin__empty p {
        margin: 0;
        font-size: 0.875rem;
    }

    .forms-plugin__hint {
        font-size: 0.8125rem !important;
        line-height: 1.5;
    }

    .forms-plugin__hint a {
        color: var(--krt-editor-accent, #3b82f6);
        text-decoration: none;
    }

    .forms-plugin__hint a:hover {
        text-decoration: underline;
    }

    .forms-plugin__list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .forms-plugin__card {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.875rem;
        background: var(--krt-editor-surface, #f8fafc);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
    }

    .forms-plugin__cardHeader {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--krt-editor-accent, #3b82f6);
    }

    .forms-plugin__cardTitle {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .forms-plugin__cardDesc {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--krt-editor-text-secondary, #64748b);
        line-height: 1.4;
    }

    .forms-plugin__cardMeta {
        font-size: 0.75rem;
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .forms-plugin__cardActions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.25rem;
    }

    .forms-plugin__actionButton {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        background: var(--krt-editor-bg, #ffffff);
        color: var(--krt-editor-text-secondary, #64748b);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
    }

    .forms-plugin__actionButton:hover {
        background: var(--krt-editor-surface-hover, #f1f5f9);
        border-color: var(--krt-editor-border-hover, #cbd5e1);
    }

    .forms-plugin__actionButton--primary {
        flex: 1;
        background: var(--krt-editor-accent, #3b82f6);
        border-color: var(--krt-editor-accent, #3b82f6);
        color: #ffffff;
    }

    .forms-plugin__actionButton--primary:hover {
        background: var(--krt-editor-accent-hover, #2563eb);
        border-color: var(--krt-editor-accent-hover, #2563eb);
    }

    .forms-plugin__footer {
        padding-top: 0.5rem;
        border-top: 1px solid var(--krt-editor-border, #e2e8f0);
    }

    .forms-plugin__link {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.8125rem;
        color: var(--krt-editor-text-secondary, #64748b);
        text-decoration: none;
    }

    .forms-plugin__link:hover {
        color: var(--krt-editor-accent, #3b82f6);
    }
</style>
