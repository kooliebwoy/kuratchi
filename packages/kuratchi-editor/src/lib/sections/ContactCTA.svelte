<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { BlockActions } from '../utils/index.js';
    import { onMount } from 'svelte';

    interface Props {
        id?: string;
        type?: string;
        eyebrow?: string;
        heading?: string;
        body?: string;
        buttonLabel?: string;
        secondaryLabel?: string;
        nameLabel?: string;
        namePlaceholder?: string;
        emailLabel?: string;
        emailPlaceholder?: string;
        projectLabel?: string;
        projectPlaceholder?: string;
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
        eyebrow = $bindable('Let’s build together'),
        heading = $bindable('Ready to launch?'),
        body = $bindable('Tell us about your next page and we’ll help you build it in minutes with our editor.'),
        buttonLabel = $bindable('Book a demo'),
        secondaryLabel = $bindable('Talk to sales'),
        nameLabel = $bindable('Name'),
        namePlaceholder = $bindable('Your name'),
        emailLabel = $bindable('Email'),
        emailPlaceholder = $bindable('you@example.com'),
        projectLabel = $bindable('Project'),
        projectPlaceholder = $bindable('What are you building?'),
        submitLabel = $bindable('Send message'),
        metadata = $bindable({
            backgroundColor: '#0b1224',
            textColor: '#e2e8f0',
            accentColor: '#a855f7'
        }),
        editable = true
    }: Props = $props();

    let component = $state<HTMLElement>();
    const componentRef = {};
    let mounted = $state(false);

    const layoutStyle = $derived(
        `--krt-contact-bg: ${metadata.backgroundColor}; --krt-contact-text: ${metadata.textColor}; --krt-contact-accent: ${metadata.accentColor};`
    );

    const content = $derived({
        id,
        type,
        eyebrow,
        heading,
        body,
        buttonLabel,
        secondaryLabel,
        nameLabel,
        namePlaceholder,
        emailLabel,
        emailPlaceholder,
        projectLabel,
        projectPlaceholder,
        submitLabel,
        metadata: { ...metadata }
    });

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
                            <h3>Form labels</h3>
                            <div class="krt-contact__grid krt-contact__grid--stacked">
                                <label class="krt-contact__field">
                                    <span>Eyebrow</span>
                                    <input type="text" bind:value={eyebrow} />
                                </label>
                                <label class="krt-contact__field">
                                    <span>Name label</span>
                                    <input type="text" bind:value={nameLabel} />
                                </label>
                                <label class="krt-contact__field">
                                    <span>Name placeholder</span>
                                    <input type="text" bind:value={namePlaceholder} />
                                </label>
                                <label class="krt-contact__field">
                                    <span>Email label</span>
                                    <input type="text" bind:value={emailLabel} />
                                </label>
                                <label class="krt-contact__field">
                                    <span>Email placeholder</span>
                                    <input type="text" bind:value={emailPlaceholder} />
                                </label>
                                <label class="krt-contact__field">
                                    <span>Project label</span>
                                    <input type="text" bind:value={projectLabel} />
                                </label>
                                <label class="krt-contact__field">
                                    <span>Project placeholder</span>
                                    <input type="text" bind:value={projectPlaceholder} />
                                </label>
                                <label class="krt-contact__field">
                                    <span>Submit label</span>
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
                <label>
                    <span contenteditable bind:innerHTML={nameLabel}></span>
                    <input type="text" placeholder={namePlaceholder} oninput={(e) => namePlaceholder = e.currentTarget.placeholder} />
                </label>
                <label>
                    <span contenteditable bind:innerHTML={emailLabel}></span>
                    <input type="email" placeholder={emailPlaceholder} oninput={(e) => emailPlaceholder = e.currentTarget.placeholder} />
                </label>
                <label>
                    <span contenteditable bind:innerHTML={projectLabel}></span>
                    <textarea rows="3" placeholder={projectPlaceholder}></textarea>
                </label>
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
            <form class="krt-contact__form" aria-label="Contact form">
                <label>
                    <span>{@html nameLabel}</span>
                    <input type="text" placeholder={namePlaceholder} />
                </label>
                <label>
                    <span>{@html emailLabel}</span>
                    <input type="email" placeholder={emailPlaceholder} />
                </label>
                <label>
                    <span>{@html projectLabel}</span>
                    <textarea rows="3" placeholder={projectPlaceholder}></textarea>
                </label>
                <button class="krt-contact__primary" type="button" style:background={metadata.accentColor}>{@html submitLabel}</button>
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
</style>
