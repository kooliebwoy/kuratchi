<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { BlockActions } from '../utils/index.js';
    import { onMount, getContext } from 'svelte';

    interface FormField {
        id: string;
        type: string;
        label: string;
        name: string;
        placeholder?: string;
        required?: boolean;
    }

    interface AttachedForm {
        id: string;
        name: string;
        fields: FormField[];
        settings: {
            formName?: string;
            submitButtonText?: string;
            successMessage?: string;
        };
        styling?: any;
    }

    interface Props {
        id?: string;
        type?: string;
        formId?: string;
        eyebrow?: string;
        heading?: string;
        body?: string;
        buttonLabel?: string;
        secondaryLabel?: string;
        submitLabel?: string;
        metadata?: {
            backgroundColor?: string;
            textColor?: string;
            accentColor?: string;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'contact-cta',
        formId = $bindable(''),
        eyebrow = $bindable('Let\'s build together'),
        heading = $bindable('Ready to launch?'),
        body = $bindable('Tell us about your next page and we\'ll help you build it in minutes with our editor.'),
        buttonLabel = $bindable('Book a demo'),
        secondaryLabel = $bindable('Talk to sales'),
        submitLabel = $bindable('Send message'),
        metadata = $bindable({
            backgroundColor: '#0b1224',
            textColor: '#e2e8f0',
            accentColor: '#a855f7'
        }),
        editable = true
    }: Props = $props();

    // Get forms from site metadata context (works in both editor and site-renderer)
    const siteMetadata = getContext<any>('siteMetadata');
    const availableForms = $derived<AttachedForm[]>(siteMetadata?.forms || []);
    
    // Get selected form data from context
    const selectedForm = $derived(() => {
        if (!formId) return null;
        return availableForms.find(f => f.id === formId) || null;
    });

    let component = $state<HTMLElement>();
    const componentRef = {};
    let mounted = $state(false);
    let formSubmitting = $state(false);
    let formSuccess = $state(false);
    let formError = $state<string | null>(null);

    const layoutStyle = $derived(
        `--krt-contact-bg: ${metadata.backgroundColor}; --krt-contact-text: ${metadata.textColor}; --krt-contact-accent: ${metadata.accentColor};`
    );

    // Only save formId - form data comes from context at runtime
    const content = $derived({
        id,
        type,
        formId,
        eyebrow,
        heading,
        body,
        buttonLabel,
        secondaryLabel,
        submitLabel,
        metadata: { ...metadata }
    });

    // Handle form submission (for non-editable mode)
    const handleSubmit = async (e: SubmitEvent) => {
        e.preventDefault();
        if (!formId || !selectedForm()) return;
        
        formSubmitting = true;
        formError = null;
        
        const formElement = e.target as HTMLFormElement;
        const formData = new FormData(formElement);
        const data: Record<string, string> = {};
        
        formData.forEach((value, key) => {
            data[key] = value.toString();
        });
        
        try {
            const response = await fetch('/api/forms/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ formId, data })
            });
            
            if (response.ok) {
                formSuccess = true;
                formElement.reset();
            } else {
                const result = await response.json();
                formError = result.message || 'Submission failed';
            }
        } catch (err) {
            formError = 'Network error. Please try again.';
        } finally {
            formSubmitting = false;
        }
    };

    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item krt-contact" bind:this={component} style={layoutStyle}>
        {#if mounted}
            <BlockActions id={id} type={type} element={component} inspectorTitle="Contact CTA settings">
                {#snippet inspector()}
                    <div class="krt-contact__drawer">
                        <section class="krt-contact__section">
                            <h3>Colors</h3>
                            <div class="krt-contact__grid">
                                <label class="krt-contact__field">
                                    <span>Background</span>
                                    <input type="color" bind:value={metadata.backgroundColor} />
                                </label>
                                <label class="krt-contact__field">
                                    <span>Text</span>
                                    <input type="color" bind:value={metadata.textColor} />
                                </label>
                                <label class="krt-contact__field">
                                    <span>Accent</span>
                                    <input type="color" bind:value={metadata.accentColor} />
                                </label>
                            </div>
                        </section>
                        <section class="krt-contact__section">
                            <h3>Form</h3>
                            <div class="krt-contact__grid krt-contact__grid--stacked">
                                {#if availableForms.length > 0}
                                    <label class="krt-contact__field">
                                        <span>Select Form</span>
                                        <select bind:value={formId} class="krt-contact__select">
                                            <option value="">Choose a form...</option>
                                            {#each availableForms as form}
                                                <option value={form.id}>{form.name}</option>
                                            {/each}
                                        </select>
                                    </label>
                                    {#if formId && selectedForm()}
                                        <div class="krt-contact__formInfo">
                                            <span class="krt-contact__formInfoLabel">✓ Using "{selectedForm()?.name}"</span>
                                            <span class="krt-contact__formInfoMeta">{selectedForm()?.fields?.length || 0} fields</span>
                                        </div>
                                    {/if}
                                {:else}
                                    <div class="krt-contact__noForms">
                                        <p>No forms attached to this site.</p>
                                        <a href="/forms" target="_blank" rel="noopener">Create & attach forms →</a>
                                    </div>
                                {/if}
                            </div>
                        </section>
                        <section class="krt-contact__section">
                            <h3>Content</h3>
                            <div class="krt-contact__grid krt-contact__grid--stacked">
                                <label class="krt-contact__field">
                                    <span>Eyebrow</span>
                                    <input type="text" bind:value={eyebrow} />
                                </label>
                                <label class="krt-contact__field">
                                    <span>Submit button</span>
                                    <input type="text" bind:value={submitLabel} />
                                </label>
                            </div>
                        </section>
                    </div>
                {/snippet}
            </BlockActions>
        {/if}
        <div id={`metadata-${id}`} style="display: none;">{JSON.stringify(content)}</div>
        <div class="krt-contact__inner">
            <div class="krt-contact__copy">
                <p class="krt-contact__eyebrow" contenteditable bind:innerHTML={eyebrow}></p>
                <h2 class="krt-contact__title" contenteditable bind:innerHTML={heading}></h2>
                <p class="krt-contact__body" contenteditable bind:innerHTML={body}></p>
                <div class="krt-contact__actions">
                    <button class="krt-contact__primary" type="button" style:background={metadata.accentColor}>
                        <span contenteditable bind:innerHTML={buttonLabel}></span>
                    </button>
                    <button class="krt-contact__secondary" type="button">
                        <span contenteditable bind:innerHTML={secondaryLabel}></span>
                    </button>
                </div>
            </div>
            <form class="krt-contact__form" aria-label="Contact form">
                {#if formId && selectedForm()}
                    {#each selectedForm()?.fields || [] as field}
                        <label>
                            <span>{field.label}{field.required ? ' *' : ''}</span>
                            {#if field.type === 'textarea'}
                                <textarea name={field.name} rows="3" placeholder={field.placeholder || ''} required={field.required}></textarea>
                            {:else if field.type === 'email'}
                                <input type="email" name={field.name} placeholder={field.placeholder || ''} required={field.required} />
                            {:else if field.type === 'tel'}
                                <input type="tel" name={field.name} placeholder={field.placeholder || ''} required={field.required} />
                            {:else}
                                <input type="text" name={field.name} placeholder={field.placeholder || ''} required={field.required} />
                            {/if}
                        </label>
                    {/each}
                {:else}
                    <div class="krt-contact__placeholder">
                        <p>Select a form in the settings panel</p>
                    </div>
                {/if}
                <button class="krt-contact__primary" type="button" style:background={metadata.accentColor}>
                    <span contenteditable bind:innerHTML={submitLabel}></span>
                </button>
            </form>
        </div>
    </div>
{:else}
    <section class="krt-contact" id={id} data-type={type} style={layoutStyle}>
        <div class="krt-contact__inner">
            <div class="krt-contact__copy">
                <p class="krt-contact__eyebrow">{@html eyebrow}</p>
                <h2 class="krt-contact__title">{@html heading}</h2>
                <p class="krt-contact__body">{@html body}</p>
                <div class="krt-contact__actions">
                    <button class="krt-contact__primary" type="button" style:background={metadata.accentColor}>{@html buttonLabel}</button>
                    <button class="krt-contact__secondary" type="button">{@html secondaryLabel}</button>
                </div>
            </div>
            <form class="krt-contact__form" aria-label="Contact form" onsubmit={handleSubmit}>
                {#if formSuccess}
                    <div class="krt-contact__success">
                        <p>{selectedForm()?.settings?.successMessage || 'Thank you for your submission!'}</p>
                    </div>
                {:else if formId && selectedForm()}
                    {#each selectedForm()?.fields || [] as field}
                        <label>
                            <span>{field.label}{field.required ? ' *' : ''}</span>
                            {#if field.type === 'textarea'}
                                <textarea name={field.name} rows="3" placeholder={field.placeholder || ''} required={field.required}></textarea>
                            {:else if field.type === 'email'}
                                <input type="email" name={field.name} placeholder={field.placeholder || ''} required={field.required} />
                            {:else if field.type === 'tel'}
                                <input type="tel" name={field.name} placeholder={field.placeholder || ''} required={field.required} />
                            {:else}
                                <input type="text" name={field.name} placeholder={field.placeholder || ''} required={field.required} />
                            {/if}
                        </label>
                    {/each}
                    {#if formError}
                        <div class="krt-contact__error">{formError}</div>
                    {/if}
                    <button class="krt-contact__primary" type="submit" style:background={metadata.accentColor} disabled={formSubmitting}>
                        {formSubmitting ? 'Sending...' : (selectedForm()?.settings?.submitButtonText || submitLabel)}
                    </button>
                {:else}
                    <div class="krt-contact__placeholder">
                        <p>No form configured</p>
                    </div>
                {/if}
            </form>
        </div>
    </section>
{/if}

<style>
    .krt-contact {
        width: 100%;
        background: var(--krt-contact-bg);
        color: var(--krt-contact-text);
        border-radius: 24px;
        padding: 48px 40px;
    }

    .krt-contact__inner {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
        align-items: start;
    }

    .krt-contact__copy {
        display: grid;
        gap: 12px;
    }

    .krt-contact__eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.8rem;
        color: color-mix(in srgb, var(--krt-contact-text) 70%, transparent);
    }

    .krt-contact__title {
        margin: 0;
        font-size: 1.9rem;
        line-height: 1.2;
    }

    .krt-contact__body {
        margin: 0;
        color: color-mix(in srgb, var(--krt-contact-text) 82%, transparent);
        line-height: 1.6;
    }

    .krt-contact__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    .krt-contact__primary {
        border: none;
        color: #0b1224;
        padding: 12px 16px;
        border-radius: 12px;
        font-weight: 700;
        cursor: pointer;
    }

    .krt-contact__secondary {
        border: 1px solid color-mix(in srgb, var(--krt-contact-text) 30%, transparent);
        background: transparent;
        color: var(--krt-contact-text);
        padding: 12px 16px;
        border-radius: 12px;
        font-weight: 700;
        cursor: pointer;
    }

    .krt-contact__form {
        background: color-mix(in srgb, var(--krt-contact-bg) 90%, black 10%);
        border: 1px solid color-mix(in srgb, var(--krt-contact-text) 14%, transparent);
        border-radius: 16px;
        padding: 16px;
        display: grid;
        gap: 12px;
    }

    .krt-contact__form label {
        display: grid;
        gap: 6px;
        font-weight: 600;
        color: var(--krt-contact-text);
    }

    .krt-contact__form input,
    .krt-contact__form textarea {
        width: 100%;
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--krt-contact-text) 16%, transparent);
        padding: 10px;
        background: transparent;
        color: var(--krt-contact-text);
    }

    .krt-contact__form textarea {
        resize: vertical;
    }

    .krt-contact__drawer {
        display: grid;
        gap: 16px;
        min-width: 280px;
    }

    .krt-contact__section {
        display: grid;
        gap: 10px;
    }

    .krt-contact__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 10px;
    }

    .krt-contact__grid--stacked {
        grid-template-columns: 1fr;
    }

    .krt-contact__field {
        display: grid;
        gap: 4px;
        font-size: 0.9rem;
    }

    .krt-contact__field input[type='color'] {
        width: 100%;
        height: 36px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
    }

    .krt-contact__select {
        width: 100%;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        background: white;
        cursor: pointer;
    }

    .krt-contact__formInfo {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.75rem;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 0.5rem;
    }

    .krt-contact__formInfoLabel {
        font-size: 0.875rem;
        font-weight: 500;
        color: #15803d;
    }

    .krt-contact__formInfoMeta {
        font-size: 0.75rem;
        color: #16a34a;
    }

    .krt-contact__noForms {
        padding: 1rem;
        background: #fef3c7;
        border: 1px solid #fcd34d;
        border-radius: 0.5rem;
        text-align: center;
    }

    .krt-contact__noForms p {
        margin: 0 0 0.5rem;
        font-size: 0.875rem;
        color: #92400e;
    }

    .krt-contact__noForms a {
        font-size: 0.8125rem;
        color: #b45309;
    }

    .krt-contact__placeholder {
        padding: 2rem;
        text-align: center;
        color: color-mix(in srgb, var(--krt-contact-text) 50%, transparent);
        border: 1px dashed color-mix(in srgb, var(--krt-contact-text) 20%, transparent);
        border-radius: 0.5rem;
    }

    .krt-contact__placeholder p {
        margin: 0;
        font-size: 0.875rem;
    }

    .krt-contact__success {
        padding: 2rem;
        text-align: center;
        background: color-mix(in srgb, #22c55e 15%, transparent);
        border-radius: 0.5rem;
    }

    .krt-contact__success p {
        margin: 0;
        color: var(--krt-contact-text);
        font-weight: 500;
    }

    .krt-contact__error {
        padding: 0.75rem;
        background: color-mix(in srgb, #ef4444 15%, transparent);
        border-radius: 0.375rem;
        font-size: 0.875rem;
        color: #fecaca;
    }
</style>
