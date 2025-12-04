<script lang="ts">
    import { DragHandle, BLOCK_SPACING_VALUES, type BlockSpacing } from "../utils/index.js";
    import { deleteElement } from "../utils/editor.svelte.js";
    import EditorToolbar from "../widgets/EditorToolbar.svelte";
    import { onMount } from "svelte";
    import { blockRegistry } from "../stores/editorSignals.svelte.js";

    interface Props {
        id?: string;
        text?: string;
        url?: string;
        type?: string;
        metadata?: {
            style?: 'primary' | 'secondary' | 'accent' | 'neutral' | 'ghost';
            size?: 'xs' | 'sm' | 'md' | 'lg';
            target?: '_blank' | '_self';
            spacingTop?: BlockSpacing;
            spacingBottom?: BlockSpacing;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        text = 'Click me',
        url = '#',
        type = 'button',
        metadata = {
            style: 'primary',
            size: 'md',
            target: '_self',
            spacingTop: 'normal',
            spacingBottom: 'normal'
        },
        editable = true
    }: Props = $props();

    let component: HTMLElement | undefined;
    const componentRef = {};
    let style = $state(metadata?.style ?? 'primary');
    let size = $state(metadata?.size ?? 'md');
    let target = $state(metadata?.target ?? '_self');
    let spacingTop = $state<BlockSpacing>(metadata?.spacingTop ?? 'normal');
    let spacingBottom = $state<BlockSpacing>(metadata?.spacingBottom ?? 'normal');

    // Computed spacing styles
    let spacingStyle = $derived(
        `margin-top: ${BLOCK_SPACING_VALUES[spacingTop]}; margin-bottom: ${BLOCK_SPACING_VALUES[spacingBottom]};`
    );

    // Block context for toolbar
    function getBlockContext() {
        return {
            type: 'generic' as const,
            blockElement: component,
            spacingTop,
            spacingBottom,
            onSpacingTopChange: (s: BlockSpacing) => { spacingTop = s; },
            onSpacingBottomChange: (s: BlockSpacing) => { spacingBottom = s; }
        };
    }

    // Selection state for toolbar
    let showToolbar = $state(false);
    let toolbarPosition = $state({ x: 0, y: 0 });

    function handleFocus() {
        if (!component) return;
        const rect = component.getBoundingClientRect();
        toolbarPosition = {
            x: rect.left + rect.width / 2,
            y: rect.top
        };
        showToolbar = true;
    }

    function handleBlur(e: FocusEvent) {
        // Don't hide if focus moved within the component or toolbar
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (component?.contains(relatedTarget)) return;
        showToolbar = false;
    }

    let content = $derived({
        id,
        type,
        text,
        url,
        metadata: {
            style,
            size,
            target,
            spacingTop,
            spacingBottom
        }
    });

    let mounted = $state(false);
    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item group relative krt-button-block" bind:this={component} style={spacingStyle}>
        {#if mounted}
            <DragHandle />
            <EditorToolbar component={component} show={showToolbar} position={toolbarPosition} blockContext={getBlockContext()} />
        {/if}
        
        <div data-type={type} {id} class="krt-button-body">
            <!-- JSON Data for this component -->
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>

            <div class="krt-button-align">
                <a 
                    href={url} 
                    {target}
                    class={`krt-button krt-button--${style} krt-button--${size}`}
                    contenteditable
                    bind:textContent={text}
                    role="button"
                    onfocus={handleFocus}
                    onblur={handleBlur}
                >
                    {text}
                </a>
            </div>
        </div>
    </div>
{:else}
    <div data-type={type} {id} class="krt-button-block krt-button-body">
        <div class="krt-button-align">
            <a
                href={url}
                target={target === '_blank' ? '_blank' : '_self'}
                rel={target === '_blank' ? 'noopener noreferrer' : undefined}
                class={`krt-button krt-button--${style} krt-button--${size}`}
            >
                {text}
            </a>
        </div>
    </div>
{/if}

<style>
    .krt-button-block {
        width: 100%;
        min-width: 100%;
    }

    .krt-button-body {
        padding-block: 1rem;
    }

    .krt-button-align {
        display: flex;
        justify-content: center;
    }

    .krt-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--krt-radius-pill, 9999px);
        padding: 0.5rem 1.5rem;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        text-decoration: none;
        background-color: var(--krt-color-primary, #111827);
        color: #f9fafb;
        box-shadow: var(--krt-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.06));
        transition:
            background-color 150ms ease,
            color 150ms ease,
            box-shadow 150ms ease,
            transform 150ms ease;
    }

    .krt-button--secondary {
        background-color: var(--krt-color-surface, #ffffff);
        color: var(--krt-color-text, #111827);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        box-shadow: none;
    }

    .krt-button--accent {
        background-color: var(--krt-color-accent, #4f46e5);
        color: #f9fafb;
    }

    .krt-button--ghost {
        background-color: transparent;
        color: var(--krt-color-primary, #111827);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        box-shadow: none;
    }

    .krt-button--xs {
        padding: 0.25rem 0.75rem;
        font-size: 0.75rem;
    }

    .krt-button--sm {
        padding: 0.4rem 1rem;
        font-size: 0.8rem;
    }

    .krt-button--md {
        padding: 0.5rem 1.25rem;
    }

    .krt-button--lg {
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
    }

    .krt-button:focus-visible {
        outline: 2px solid var(--krt-color-accent, #4f46e5);
        outline-offset: 2px;
    }

    .krt-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
    }
</style>
