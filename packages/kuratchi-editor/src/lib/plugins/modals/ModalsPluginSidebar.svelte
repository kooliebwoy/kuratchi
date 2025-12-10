<script lang="ts">
    import type { PluginContext } from '../context';
    import { 
        Layers, FileText, Plus, Settings, ChevronDown, ChevronRight,
        ExternalLink, Trash2, Copy, Check, MousePointerClick
    } from '@lucide/svelte';

    let { ctx }: { ctx: PluginContext } = $props();

    // Types
    interface Form {
        id: string;
        name: string;
        description?: string;
        fields: any[];
        settings: any;
        styling?: any;
    }

    interface LeadCTA {
        id: string;
        label: string;
        formId: string;
        style: 'primary' | 'secondary' | 'outline' | 'ghost';
        icon?: string;
        afterSubmitAction: 'close' | 'message' | 'redirect';
        afterSubmitMessage?: string;
        afterSubmitUrl?: string;
    }

    interface LeadCTAConfig {
        listCTAs: LeadCTA[];
        detailCTAs: LeadCTA[];
        maxListCTAs: number;
        maxDetailCTAs: number;
    }

    // Get forms from site metadata
    const forms = $derived<Form[]>((ctx.siteMetadata.forms as Form[]) ?? []);

    // Lead CTA configuration state
    let ctaConfig = $state<LeadCTAConfig>({
        listCTAs: [],
        detailCTAs: [],
        maxListCTAs: 2,
        maxDetailCTAs: 3
    });

    // UI State
    let activeSection = $state<'overview' | 'list-ctas' | 'detail-ctas'>('overview');
    let editingCTA = $state<LeadCTA | null>(null);
    let isCreatingCTA = $state(false);
    let ctaTarget = $state<'list' | 'detail'>('list');
    let copiedId = $state<string | null>(null);

    // New CTA form state
    let newCTA = $state<Partial<LeadCTA>>({
        label: 'Get Quote',
        formId: '',
        style: 'primary',
        afterSubmitAction: 'message',
        afterSubmitMessage: 'Thank you! We\'ll be in touch soon.'
    });

    // CTA style options
    const ctaStyles = [
        { value: 'primary', label: 'Primary (Filled)', preview: 'bg-primary' },
        { value: 'secondary', label: 'Secondary', preview: 'bg-secondary' },
        { value: 'outline', label: 'Outline', preview: 'border' },
        { value: 'ghost', label: 'Ghost (Text)', preview: 'text-only' }
    ];

    // After submit action options
    const afterSubmitActions = [
        { value: 'close', label: 'Close Modal' },
        { value: 'message', label: 'Show Success Message' },
        { value: 'redirect', label: 'Redirect to URL' }
    ];

    // Create a new CTA
    function createCTA() {
        if (!newCTA.formId || !newCTA.label) return;

        const cta: LeadCTA = {
            id: `cta-${Date.now()}`,
            label: newCTA.label || 'Get Quote',
            formId: newCTA.formId,
            style: newCTA.style as LeadCTA['style'] || 'primary',
            afterSubmitAction: newCTA.afterSubmitAction as LeadCTA['afterSubmitAction'] || 'message',
            afterSubmitMessage: newCTA.afterSubmitMessage,
            afterSubmitUrl: newCTA.afterSubmitUrl
        };

        if (ctaTarget === 'list') {
            if (ctaConfig.listCTAs.length < ctaConfig.maxListCTAs) {
                ctaConfig.listCTAs = [...ctaConfig.listCTAs, cta];
            }
        } else {
            if (ctaConfig.detailCTAs.length < ctaConfig.maxDetailCTAs) {
                ctaConfig.detailCTAs = [...ctaConfig.detailCTAs, cta];
            }
        }

        // Reset form
        newCTA = {
            label: 'Get Quote',
            formId: '',
            style: 'primary',
            afterSubmitAction: 'message',
            afterSubmitMessage: 'Thank you! We\'ll be in touch soon.'
        };
        isCreatingCTA = false;
    }

    // Delete a CTA
    function deleteCTA(id: string, target: 'list' | 'detail') {
        if (target === 'list') {
            ctaConfig.listCTAs = ctaConfig.listCTAs.filter(c => c.id !== id);
        } else {
            ctaConfig.detailCTAs = ctaConfig.detailCTAs.filter(c => c.id !== id);
        }
    }

    // Copy CTA configuration
    function copyCTAConfig() {
        const config = JSON.stringify(ctaConfig, null, 2);
        navigator.clipboard.writeText(config);
        copiedId = 'config';
        setTimeout(() => copiedId = null, 2000);
    }

    // Get form name by ID
    function getFormName(formId: string): string {
        const form = forms.find(f => f.id === formId);
        return form?.name || 'Unknown Form';
    }

    // Apply CTA config to selected catalog sections
    function applyCTAConfig() {
        // This would update the currently selected catalog section with the CTA config
        // For now, we'll emit an event or update context
        ctx.siteMetadata.leadCTAConfig = ctaConfig;
        
        // Could also add a block with the config
        // ctx.addBlock('lead-cta-config', ctaConfig);
    }
</script>

<div class="modals-plugin">
    <div class="modals-plugin__header">
        <h3>Lead CTAs & Modals</h3>
    </div>

    <!-- Navigation Tabs -->
    <div class="modals-plugin__tabs">
        <button 
            class="modals-plugin__tab"
            class:modals-plugin__tab--active={activeSection === 'overview'}
            onclick={() => activeSection = 'overview'}
        >
            Overview
        </button>
        <button 
            class="modals-plugin__tab"
            class:modals-plugin__tab--active={activeSection === 'list-ctas'}
            onclick={() => activeSection = 'list-ctas'}
        >
            List CTAs
        </button>
        <button 
            class="modals-plugin__tab"
            class:modals-plugin__tab--active={activeSection === 'detail-ctas'}
            onclick={() => activeSection = 'detail-ctas'}
        >
            Detail CTAs
        </button>
    </div>

    <!-- Overview Section -->
    {#if activeSection === 'overview'}
        <div class="modals-plugin__section">
            <div class="modals-plugin__info">
                <Layers size={24} />
                <div>
                    <h4>Configure Lead Capture</h4>
                    <p>Add call-to-action buttons to your catalog views that open forms in modals.</p>
                </div>
            </div>

            <div class="modals-plugin__stats">
                <div class="modals-plugin__stat">
                    <span class="modals-plugin__statValue">{forms.length}</span>
                    <span class="modals-plugin__statLabel">Forms Available</span>
                </div>
                <div class="modals-plugin__stat">
                    <span class="modals-plugin__statValue">{ctaConfig.listCTAs.length}</span>
                    <span class="modals-plugin__statLabel">List View CTAs</span>
                </div>
                <div class="modals-plugin__stat">
                    <span class="modals-plugin__statValue">{ctaConfig.detailCTAs.length}</span>
                    <span class="modals-plugin__statLabel">Detail View CTAs</span>
                </div>
            </div>

            {#if forms.length === 0}
                <div class="modals-plugin__empty">
                    <FileText size={32} strokeWidth={1.5} />
                    <p>No forms available</p>
                    <p class="modals-plugin__hint">
                        Create forms in the <a href="/forms" target="_blank">Forms Dashboard</a> first.
                    </p>
                </div>
            {:else}
                <div class="modals-plugin__actions">
                    <button 
                        class="modals-plugin__actionBtn modals-plugin__actionBtn--primary"
                        onclick={() => { activeSection = 'list-ctas'; isCreatingCTA = true; ctaTarget = 'list'; }}
                    >
                        <Plus size={16} />
                        Add List CTA
                    </button>
                    <button 
                        class="modals-plugin__actionBtn modals-plugin__actionBtn--primary"
                        onclick={() => { activeSection = 'detail-ctas'; isCreatingCTA = true; ctaTarget = 'detail'; }}
                    >
                        <Plus size={16} />
                        Add Detail CTA
                    </button>
                </div>
            {/if}
        </div>
    {/if}

    <!-- List CTAs Section -->
    {#if activeSection === 'list-ctas'}
        <div class="modals-plugin__section">
            <div class="modals-plugin__sectionHeader">
                <h4>List/Grid View CTAs</h4>
                <span class="modals-plugin__count">{ctaConfig.listCTAs.length}/{ctaConfig.maxListCTAs}</span>
            </div>

            <p class="modals-plugin__desc">
                These CTAs appear on each vehicle card in list and grid views.
            </p>

            {#if ctaConfig.listCTAs.length > 0}
                <div class="modals-plugin__ctaList">
                    {#each ctaConfig.listCTAs as cta (cta.id)}
                        <div class="modals-plugin__ctaItem">
                            <div class="modals-plugin__ctaInfo">
                                <MousePointerClick size={16} />
                                <div>
                                    <span class="modals-plugin__ctaLabel">{cta.label}</span>
                                    <span class="modals-plugin__ctaForm">{getFormName(cta.formId)}</span>
                                </div>
                            </div>
                            <div class="modals-plugin__ctaActions">
                                <span class="modals-plugin__ctaStyle modals-plugin__ctaStyle--{cta.style}">
                                    {cta.style}
                                </span>
                                <button 
                                    class="modals-plugin__iconBtn"
                                    onclick={() => deleteCTA(cta.id, 'list')}
                                    title="Delete CTA"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}

            {#if ctaConfig.listCTAs.length < ctaConfig.maxListCTAs}
                {#if isCreatingCTA && ctaTarget === 'list'}
                    <div class="modals-plugin__createForm">
                        <div class="modals-plugin__formGroup">
                            <label>Button Label</label>
                            <input 
                                type="text" 
                                bind:value={newCTA.label}
                                placeholder="e.g., Get Quote"
                            />
                        </div>

                        <div class="modals-plugin__formGroup">
                            <label>Form to Open</label>
                            <select bind:value={newCTA.formId}>
                                <option value="">Select a form...</option>
                                {#each forms as form}
                                    <option value={form.id}>{form.name}</option>
                                {/each}
                            </select>
                        </div>

                        <div class="modals-plugin__formGroup">
                            <label>Button Style</label>
                            <select bind:value={newCTA.style}>
                                {#each ctaStyles as style}
                                    <option value={style.value}>{style.label}</option>
                                {/each}
                            </select>
                        </div>

                        <div class="modals-plugin__formGroup">
                            <label>After Submission</label>
                            <select bind:value={newCTA.afterSubmitAction}>
                                {#each afterSubmitActions as action}
                                    <option value={action.value}>{action.label}</option>
                                {/each}
                            </select>
                        </div>

                        {#if newCTA.afterSubmitAction === 'message'}
                            <div class="modals-plugin__formGroup">
                                <label>Success Message</label>
                                <textarea 
                                    bind:value={newCTA.afterSubmitMessage}
                                    placeholder="Thank you! We'll be in touch soon."
                                    rows="2"
                                ></textarea>
                            </div>
                        {/if}

                        {#if newCTA.afterSubmitAction === 'redirect'}
                            <div class="modals-plugin__formGroup">
                                <label>Redirect URL</label>
                                <input 
                                    type="text" 
                                    bind:value={newCTA.afterSubmitUrl}
                                    placeholder="/thank-you"
                                />
                            </div>
                        {/if}

                        <div class="modals-plugin__formActions">
                            <button 
                                class="modals-plugin__btn modals-plugin__btn--secondary"
                                onclick={() => isCreatingCTA = false}
                            >
                                Cancel
                            </button>
                            <button 
                                class="modals-plugin__btn modals-plugin__btn--primary"
                                onclick={createCTA}
                                disabled={!newCTA.formId || !newCTA.label}
                            >
                                Add CTA
                            </button>
                        </div>
                    </div>
                {:else}
                    <button 
                        class="modals-plugin__addBtn"
                        onclick={() => { isCreatingCTA = true; ctaTarget = 'list'; }}
                    >
                        <Plus size={16} />
                        Add List CTA
                    </button>
                {/if}
            {/if}
        </div>
    {/if}

    <!-- Detail CTAs Section -->
    {#if activeSection === 'detail-ctas'}
        <div class="modals-plugin__section">
            <div class="modals-plugin__sectionHeader">
                <h4>Detail/Modal View CTAs</h4>
                <span class="modals-plugin__count">{ctaConfig.detailCTAs.length}/{ctaConfig.maxDetailCTAs}</span>
            </div>

            <p class="modals-plugin__desc">
                These CTAs appear in the vehicle detail modal or page.
            </p>

            {#if ctaConfig.detailCTAs.length > 0}
                <div class="modals-plugin__ctaList">
                    {#each ctaConfig.detailCTAs as cta (cta.id)}
                        <div class="modals-plugin__ctaItem">
                            <div class="modals-plugin__ctaInfo">
                                <MousePointerClick size={16} />
                                <div>
                                    <span class="modals-plugin__ctaLabel">{cta.label}</span>
                                    <span class="modals-plugin__ctaForm">{getFormName(cta.formId)}</span>
                                </div>
                            </div>
                            <div class="modals-plugin__ctaActions">
                                <span class="modals-plugin__ctaStyle modals-plugin__ctaStyle--{cta.style}">
                                    {cta.style}
                                </span>
                                <button 
                                    class="modals-plugin__iconBtn"
                                    onclick={() => deleteCTA(cta.id, 'detail')}
                                    title="Delete CTA"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}

            {#if ctaConfig.detailCTAs.length < ctaConfig.maxDetailCTAs}
                {#if isCreatingCTA && ctaTarget === 'detail'}
                    <div class="modals-plugin__createForm">
                        <div class="modals-plugin__formGroup">
                            <label>Button Label</label>
                            <input 
                                type="text" 
                                bind:value={newCTA.label}
                                placeholder="e.g., Request Info"
                            />
                        </div>

                        <div class="modals-plugin__formGroup">
                            <label>Form to Open</label>
                            <select bind:value={newCTA.formId}>
                                <option value="">Select a form...</option>
                                {#each forms as form}
                                    <option value={form.id}>{form.name}</option>
                                {/each}
                            </select>
                        </div>

                        <div class="modals-plugin__formGroup">
                            <label>Button Style</label>
                            <select bind:value={newCTA.style}>
                                {#each ctaStyles as style}
                                    <option value={style.value}>{style.label}</option>
                                {/each}
                            </select>
                        </div>

                        <div class="modals-plugin__formGroup">
                            <label>After Submission</label>
                            <select bind:value={newCTA.afterSubmitAction}>
                                {#each afterSubmitActions as action}
                                    <option value={action.value}>{action.label}</option>
                                {/each}
                            </select>
                        </div>

                        {#if newCTA.afterSubmitAction === 'message'}
                            <div class="modals-plugin__formGroup">
                                <label>Success Message</label>
                                <textarea 
                                    bind:value={newCTA.afterSubmitMessage}
                                    placeholder="Thank you! We'll be in touch soon."
                                    rows="2"
                                ></textarea>
                            </div>
                        {/if}

                        {#if newCTA.afterSubmitAction === 'redirect'}
                            <div class="modals-plugin__formGroup">
                                <label>Redirect URL</label>
                                <input 
                                    type="text" 
                                    bind:value={newCTA.afterSubmitUrl}
                                    placeholder="/thank-you"
                                />
                            </div>
                        {/if}

                        <div class="modals-plugin__formActions">
                            <button 
                                class="modals-plugin__btn modals-plugin__btn--secondary"
                                onclick={() => isCreatingCTA = false}
                            >
                                Cancel
                            </button>
                            <button 
                                class="modals-plugin__btn modals-plugin__btn--primary"
                                onclick={createCTA}
                                disabled={!newCTA.formId || !newCTA.label}
                            >
                                Add CTA
                            </button>
                        </div>
                    </div>
                {:else}
                    <button 
                        class="modals-plugin__addBtn"
                        onclick={() => { isCreatingCTA = true; ctaTarget = 'detail'; }}
                    >
                        <Plus size={16} />
                        Add Detail CTA
                    </button>
                {/if}
            {/if}
        </div>
    {/if}

    <!-- Apply Button -->
    {#if ctaConfig.listCTAs.length > 0 || ctaConfig.detailCTAs.length > 0}
        <div class="modals-plugin__footer">
            <button 
                class="modals-plugin__applyBtn"
                onclick={applyCTAConfig}
            >
                Apply to Catalog Sections
            </button>
            <button 
                class="modals-plugin__copyBtn"
                onclick={copyCTAConfig}
                title="Copy configuration"
            >
                {#if copiedId === 'config'}
                    <Check size={16} />
                {:else}
                    <Copy size={16} />
                {/if}
            </button>
        </div>
    {/if}
</div>

<style>
    .modals-plugin {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .modals-plugin__header {
        padding: 1rem;
        border-bottom: 1px solid var(--krt-editor-border, #e2e8f0);
    }

    .modals-plugin__header h3 {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .modals-plugin__tabs {
        display: flex;
        border-bottom: 1px solid var(--krt-editor-border, #e2e8f0);
    }

    .modals-plugin__tab {
        flex: 1;
        padding: 0.75rem 0.5rem;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        font-size: 0.8125rem;
        color: var(--krt-editor-text-secondary, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .modals-plugin__tab:hover {
        color: var(--krt-editor-text-primary, #0f172a);
        background: var(--krt-editor-surface, #f8fafc);
    }

    .modals-plugin__tab--active {
        color: var(--krt-editor-accent, #3b82f6);
        border-bottom-color: var(--krt-editor-accent, #3b82f6);
    }

    .modals-plugin__section {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .modals-plugin__info {
        display: flex;
        gap: 0.75rem;
        padding: 1rem;
        background: var(--krt-editor-surface, #f8fafc);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        color: var(--krt-editor-accent, #3b82f6);
    }

    .modals-plugin__info h4 {
        margin: 0 0 0.25rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .modals-plugin__info p {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--krt-editor-text-secondary, #64748b);
        line-height: 1.4;
    }

    .modals-plugin__stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
    }

    .modals-plugin__stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0.75rem;
        background: var(--krt-editor-surface, #f8fafc);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
    }

    .modals-plugin__statValue {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .modals-plugin__statLabel {
        font-size: 0.6875rem;
        color: var(--krt-editor-text-muted, #94a3b8);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .modals-plugin__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 2rem;
        text-align: center;
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .modals-plugin__empty p {
        margin: 0;
        font-size: 0.875rem;
    }

    .modals-plugin__hint {
        font-size: 0.8125rem !important;
    }

    .modals-plugin__hint a {
        color: var(--krt-editor-accent, #3b82f6);
        text-decoration: none;
    }

    .modals-plugin__hint a:hover {
        text-decoration: underline;
    }

    .modals-plugin__actions {
        display: flex;
        gap: 0.5rem;
    }

    .modals-plugin__actionBtn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        padding: 0.625rem;
        background: var(--krt-editor-surface, #f8fafc);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        font-size: 0.8125rem;
        color: var(--krt-editor-text-primary, #0f172a);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .modals-plugin__actionBtn:hover {
        background: var(--krt-editor-surface-hover, #f1f5f9);
    }

    .modals-plugin__actionBtn--primary {
        background: var(--krt-editor-accent, #3b82f6);
        border-color: var(--krt-editor-accent, #3b82f6);
        color: #ffffff;
    }

    .modals-plugin__actionBtn--primary:hover {
        background: var(--krt-editor-accent-hover, #2563eb);
    }

    .modals-plugin__sectionHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .modals-plugin__sectionHeader h4 {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .modals-plugin__count {
        font-size: 0.75rem;
        color: var(--krt-editor-text-muted, #94a3b8);
        background: var(--krt-editor-surface, #f8fafc);
        padding: 0.25rem 0.5rem;
        border-radius: 9999px;
    }

    .modals-plugin__desc {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--krt-editor-text-secondary, #64748b);
        line-height: 1.4;
    }

    .modals-plugin__ctaList {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .modals-plugin__ctaItem {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem;
        background: var(--krt-editor-surface, #f8fafc);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
    }

    .modals-plugin__ctaInfo {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        color: var(--krt-editor-accent, #3b82f6);
    }

    .modals-plugin__ctaInfo > div {
        display: flex;
        flex-direction: column;
    }

    .modals-plugin__ctaLabel {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .modals-plugin__ctaForm {
        font-size: 0.75rem;
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .modals-plugin__ctaActions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .modals-plugin__ctaStyle {
        font-size: 0.6875rem;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        text-transform: uppercase;
        letter-spacing: 0.025em;
    }

    .modals-plugin__ctaStyle--primary {
        background: var(--krt-editor-accent, #3b82f6);
        color: #ffffff;
    }

    .modals-plugin__ctaStyle--secondary {
        background: #64748b;
        color: #ffffff;
    }

    .modals-plugin__ctaStyle--outline {
        background: transparent;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .modals-plugin__ctaStyle--ghost {
        background: transparent;
        color: var(--krt-editor-accent, #3b82f6);
    }

    .modals-plugin__iconBtn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        background: transparent;
        border: none;
        border-radius: var(--krt-editor-radius-sm, 0.25rem);
        color: var(--krt-editor-text-muted, #94a3b8);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .modals-plugin__iconBtn:hover {
        background: var(--krt-editor-surface-hover, #f1f5f9);
        color: #dc2626;
    }

    .modals-plugin__addBtn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        padding: 0.75rem;
        background: transparent;
        border: 2px dashed var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        font-size: 0.8125rem;
        color: var(--krt-editor-text-secondary, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .modals-plugin__addBtn:hover {
        border-color: var(--krt-editor-accent, #3b82f6);
        color: var(--krt-editor-accent, #3b82f6);
        background: var(--krt-editor-surface, #f8fafc);
    }

    .modals-plugin__createForm {
        display: flex;
        flex-direction: column;
        gap: 0.875rem;
        padding: 1rem;
        background: var(--krt-editor-surface, #f8fafc);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
    }

    .modals-plugin__formGroup {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .modals-plugin__formGroup label {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .modals-plugin__formGroup input,
    .modals-plugin__formGroup select,
    .modals-plugin__formGroup textarea {
        padding: 0.5rem 0.75rem;
        background: #ffffff;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.25rem);
        font-size: 0.875rem;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .modals-plugin__formGroup input:focus,
    .modals-plugin__formGroup select:focus,
    .modals-plugin__formGroup textarea:focus {
        outline: none;
        border-color: var(--krt-editor-accent, #3b82f6);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }

    .modals-plugin__formGroup textarea {
        resize: vertical;
        min-height: 60px;
    }

    .modals-plugin__formActions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }

    .modals-plugin__btn {
        padding: 0.5rem 1rem;
        border-radius: var(--krt-editor-radius-sm, 0.25rem);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .modals-plugin__btn--primary {
        background: var(--krt-editor-accent, #3b82f6);
        border: none;
        color: #ffffff;
    }

    .modals-plugin__btn--primary:hover:not(:disabled) {
        background: var(--krt-editor-accent-hover, #2563eb);
    }

    .modals-plugin__btn--primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .modals-plugin__btn--secondary {
        background: transparent;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        color: var(--krt-editor-text-secondary, #64748b);
    }

    .modals-plugin__btn--secondary:hover {
        background: var(--krt-editor-surface, #f8fafc);
    }

    .modals-plugin__footer {
        display: flex;
        gap: 0.5rem;
        padding: 1rem;
        border-top: 1px solid var(--krt-editor-border, #e2e8f0);
        margin-top: auto;
    }

    .modals-plugin__applyBtn {
        flex: 1;
        padding: 0.75rem;
        background: var(--krt-editor-accent, #3b82f6);
        border: none;
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        font-size: 0.875rem;
        font-weight: 500;
        color: #ffffff;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .modals-plugin__applyBtn:hover {
        background: var(--krt-editor-accent-hover, #2563eb);
    }

    .modals-plugin__copyBtn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        padding: 0;
        background: var(--krt-editor-surface, #f8fafc);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        color: var(--krt-editor-text-secondary, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .modals-plugin__copyBtn:hover {
        background: var(--krt-editor-surface-hover, #f1f5f9);
        color: var(--krt-editor-accent, #3b82f6);
    }
</style>
